// chain-scan.js
// Program-wide scans (expensive). Intended for periodic background refresh + dashboards.
//
// Features:
// - Best-effort in-memory caching (TTL) so repeated scans don’t hammer RPC.
// - Chunked decoding + progress callback + yielding to keep the UI responsive.

import bs58 from "https://esm.sh/bs58@5";
import { PublicKey } from "https://esm.sh/@solana/web3.js@1.98.0";
import { makeConnection, PROGRAM_ID } from "./chain-config.js";
import { DISC_PLAYER } from "./chain-discriminators.js";
import { decodePlayerState } from "./chain-decoders.js";

// ----------------------------
// Cache
// ----------------------------

// Cache decoded results in-memory. (UI can still add its own caching; this is a safety net.)
let _cache = {
  at: 0,
  ttlMs: 0,
  commitment: "confirmed",
  players: null, // array
  owners: null, // array
};

function nowMs() {
  return Date.now();
}

function isCacheValid({ commitment, cacheMs }) {
  if (!_cache.at) return false;
  if ((_cache.commitment || "confirmed") !== commitment) return false;
  if (cacheMs <= 0) return false;
  return nowMs() - _cache.at < cacheMs;
}

function setCache({ commitment, cacheMs, players, owners }) {
  _cache = {
    at: nowMs(),
    ttlMs: cacheMs,
    commitment,
    players,
    owners,
  };
}

function sleep0() {
  return new Promise((r) => setTimeout(r, 0));
}

// Yield to the browser for a paint/layout pass when available.
// This keeps progress bars/text responsive during large loops.
async function yieldFrame() {
  try {
    if (typeof requestAnimationFrame === "function") {
      await new Promise((r) => requestAnimationFrame(() => r()));
      return;
    }
  } catch {
    // ignore
  }
  await sleep0();
}

// ----------------------------
// Scanning
// ----------------------------

function getConn(connection) {
  return connection ?? makeConnection();
}

function playerDiscB58() {
  // Anchor account discriminator (8 bytes) encoded for memcmp filter.
  return bs58.encode(DISC_PLAYER);
}

// Some RPC nodes impose a limit on *accumulated scan results* for getProgramAccounts
// when returning lots of account data (13k+ accounts can trip it).
// To stay under limits, we scan for keys with an empty dataSlice, then fetch
// account data in batches via getMultipleAccountsInfo.

async function scanPlayerAccountKeys({ connection, commitment = "confirmed" } = {}) {
  const conn = getConn(connection);
  const discB58 = playerDiscB58();

  // Fast path: single call.
  try {
    const res = await conn.getProgramAccounts(PROGRAM_ID, {
      commitment,
      // Only return pubkeys (no data) to reduce payload.
      dataSlice: { offset: 0, length: 0 },
      filters: [{ memcmp: { offset: 0, bytes: discB58 } }],
    });
    return res.map(({ pubkey }) => pubkey);
  } catch (e) {
    // Some RPC nodes still abort large scans even with dataSlice.
    const msg = String(e?.message || e || "");
    if (!/exceeded the limit|scan aborted/i.test(msg)) throw e;
  }

  // Fallback: partition by the first byte of the owner pubkey (offset 8).
  // This turns 1 huge response into up to 256 small responses.
  const keys = [];
  for (let b = 0; b < 256; b++) {
    const b58 = bs58.encode(Uint8Array.from([b]));
    const res = await conn.getProgramAccounts(PROGRAM_ID, {
      commitment,
      dataSlice: { offset: 0, length: 0 },
      filters: [
        { memcmp: { offset: 0, bytes: discB58 } },
        { memcmp: { offset: 8, bytes: b58 } },
      ],
    });
    for (const { pubkey } of res) keys.push(pubkey);
    // small yield between partitions to be nice to the RPC/node + UI
    await sleep0();
  }

  // De-dupe (shouldn't be necessary, but safe).
  const uniq = new Map();
  for (const k of keys) uniq.set(k.toBase58(), k);
  return Array.from(uniq.values());
}

async function scanPlayerOwnersSlice({ connection, commitment = "confirmed" } = {}) {
  const conn = getConn(connection);
  const discB58 = playerDiscB58();

  // PlayerState layout: [8 disc][32 owner]...
  const OWNER_OFFSET = 8;
  const OWNER_LEN = 32;

  try {
    return await conn.getProgramAccounts(PROGRAM_ID, {
      commitment,
      // Only return owner bytes.
      dataSlice: { offset: OWNER_OFFSET, length: OWNER_LEN },
      filters: [{ memcmp: { offset: 0, bytes: discB58 } }],
    });
  } catch (e) {
    const msg = String(e?.message || e || "");
    if (!/exceeded the limit|scan aborted/i.test(msg)) throw e;
  }

  // Fallback partitioned scan (see scanPlayerAccountKeys).
  const out = [];
  for (let b = 0; b < 256; b++) {
    const b58 = bs58.encode(Uint8Array.from([b]));
    const res = await conn.getProgramAccounts(PROGRAM_ID, {
      commitment,
      dataSlice: { offset: OWNER_OFFSET, length: OWNER_LEN },
      filters: [
        { memcmp: { offset: 0, bytes: discB58 } },
        { memcmp: { offset: 8, bytes: b58 } },
      ],
    });
    out.push(...res);
    await sleep0();
  }
  return out;
}

async function getMultipleAccountsInfoBatched(conn, pubkeys, { commitment = "confirmed", batchSize = 100 } = {}) {
  const out = [];
  for (let i = 0; i < pubkeys.length; i += batchSize) {
    const batch = pubkeys.slice(i, i + batchSize);
    const infos = await conn.getMultipleAccountsInfo(batch, { commitment });
    for (let j = 0; j < batch.length; j++) {
      out.push({ pubkey: batch[j], account: infos[j] });
    }
    // yield a bit between RPC batches
    await sleep0();
  }
  return out;
}

/**
 * Fetch and decode *all* PlayerState accounts for the program.
 *
 * Options:
 * - cacheMs: number (default 0)  Best-effort in-memory cache TTL.
 * - chunkSize: number (default 250)  Call onProgress every chunk.
 * - yieldEvery: number (default 250) Yield to event loop every N decodes.
 * - onProgress: ({ done, total, ok, skipped }) => void
 *
 * Returns:
 *   [{ playerPda: string, player: DecodedPlayerState }, ...]
 */
export async function fetchAllPlayerStates({
  connection,
  commitment = "confirmed",
  cacheMs = 0,
  chunkSize = 250,
  yieldEvery = 250,
  onProgress,
} = {}) {
  if (isCacheValid({ commitment, cacheMs })) {
    onProgress?.({ done: _cache.players.length, total: _cache.players.length, ok: _cache.players.length, skipped: 0, cached: true });
    return _cache.players;
  }

  const conn = getConn(connection);
  const keys = await scanPlayerAccountKeys({ connection: conn, commitment });
  const total = keys.length;

  const out = [];
  let ok = 0;
  let skipped = 0;

  // initial progress
  onProgress?.({ done: 0, total, ok: 0, skipped: 0, cached: false });

  // Fetch data in batches to avoid getProgramAccounts size limits.
  // We still decode in a chunked/yielding loop for UI responsiveness.
  const batchSize = 100;
  const fetched = await getMultipleAccountsInfoBatched(conn, keys, { commitment, batchSize });

  for (let i = 0; i < fetched.length; i++) {
    const { pubkey, account } = fetched[i];
    try {
      if (!account?.data) throw new Error("missing");
      const player = decodePlayerState(account.data);
      out.push({ playerPda: pubkey.toBase58(), player });
      ok++;
    } catch {
      skipped++;
    }

    const done = i + 1;

    if (chunkSize > 0 && (done % chunkSize === 0 || done === total)) {
      onProgress?.({ done, total, ok, skipped, cached: false });
      // Ensure the UI can paint progress updates.
      await yieldFrame();
    }

    if (yieldEvery > 0 && done % yieldEvery === 0) {
      await sleep0();
    }
  }

  // compute owners once, for cheap reuse
  const ownersSet = new Set();
  for (const s of out) ownersSet.add(s.player.owner.toBase58());
  const owners = Array.from(ownersSet);

  setCache({ commitment, cacheMs, players: out, owners });

  return out;
}

/**
 * Fetch all unique player owners (base58) for the program.
 *
 * Notes:
 * - Uses the same scan+decode path, but returns a much smaller payload.
 * - Benefits from the same cache TTL.
 */
export async function fetchAllPlayerOwners({
  connection,
  commitment = "confirmed",
  cacheMs = 0,
  chunkSize = 250,
  yieldEvery = 250,
  onProgress,
} = {}) {
  if (isCacheValid({ commitment, cacheMs }) && _cache.owners) {
    onProgress?.({ done: _cache.owners.length, total: _cache.owners.length, ok: _cache.owners.length, skipped: 0, cached: true });
    return _cache.owners;
  }

  // Fast path: only fetch owner bytes via dataSlice.
  // This avoids pulling full account data and is less likely to hit RPC scan limits.
  const accs = await scanPlayerOwnersSlice({ connection, commitment });
  const total = accs.length;
  let ok = 0;
  let skipped = 0;
  const set = new Set();

  onProgress?.({ done: 0, total, ok: 0, skipped: 0, cached: false });

  for (let i = 0; i < total; i++) {
    const { account } = accs[i];
    try {
      const bytes = account?.data;
      if (!bytes || bytes.length < 32) throw new Error("short");
      const owner = new PublicKey(bytes.subarray(0, 32));
      set.add(owner.toBase58());
      ok++;
    } catch {
      skipped++;
    }

    const done = i + 1;
    if (chunkSize > 0 && (done % chunkSize === 0 || done === total)) {
      onProgress?.({ done, total, ok, skipped, cached: false });
      // Ensure the UI can paint progress updates.
      await yieldFrame();
    }
    if (yieldEvery > 0 && done % yieldEvery === 0) {
      await sleep0();
    }
  }

  const owners = Array.from(set);
  // cache owners; don't overwrite players cache unless already present
  setCache({ commitment, cacheMs, players: _cache.players, owners });
  return owners;
}

// Optional: allow callers to explicitly clear cache.
export function clearScanCache() {
  _cache = { at: 0, ttlMs: 0, commitment: "confirmed", players: null, owners: null };
}
