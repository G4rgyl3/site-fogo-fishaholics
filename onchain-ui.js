// onchain-ui.js
// Extracted from the inline <script type="module"> block in fish.html.
// Wires the "Load from chain" button to fetch current state + start subscriptions.

// NOTE: Player-level subscriptions are intentionally disabled.
// We only load the current player snapshot during a manual sync, and rely on
// program-level subscriptions (e.g., ProcessFish) for live activity.
import {
  loadChainState,
  subscribeFishCaught,
  fetchGlobalState,
} from "./chain.js";
import { Connection, PublicKey } from "https://esm.sh/@solana/web3.js@1.98.0";
import { createYieldContext } from "./yield-context.js";
import { createProcessFishWatcher } from "./process-fish-watcher.js";
import { decodePlayerState } from "./chain-decoders.js";
import { DISC_PLAYER } from "./chain-discriminators.js";
import bs58 from "https://esm.sh/bs58@5";

import { shortAddr } from "./onchain-ui-utils.js";
import { fmtBig, formatTokenAmount, formatFishFromRaw, formatPercentOf, fmtTimeFromI64 } from "./onchain-ui-formatters.js";

import { savePlayerScan, loadPlayerScan } from "./player-scan-store.js";

// ✅ NEW: renderers
import { renderChainSnapshot } from "./ui/render-snapshot.js";
import { renderProcessingRow } from "./ui/render-processing-row.js";
import { renderScanRow } from "./ui/render-scan-row.js";

// Fishing program (from explorer logs)
const FOGO_FISHING_PROGRAM_ID = new PublicKey("SEAyjT1FUx3JyXJnWt5NtjELDwuU9XsoZeZVPVvweU4");

// Fish Processing detection is ALWAYS global.
// It starts automatically on page load and is controlled only by the Live toggle.
const PROC_RPC = "https://mainnet.fogo.io";
const procConn = new Connection(PROC_RPC, "confirmed");

// Chain-only state for "me" (active player) and yield calculations.
const yieldCtx = createYieldContext({
  connection: procConn,
  storageKey: "fogo.activeOwner",
  minRefreshMs: 10_000,
});

// Chain-only ProcessFish watcher (global only).
const processWatcher = createProcessFishWatcher({
  connection: procConn,
  programId: FOGO_FISHING_PROGRAM_ID,
});

function setProcStatus(s) {
  const el = document.getElementById("procStatus");
  if (el) el.textContent = s;
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function setSnapshotHTML(html) {
  const snap = document.getElementById("chainSnapshot");
  if (snap) snap.innerHTML = html;
  const upd = document.getElementById("chainUpdated");
  if (upd) upd.textContent = new Date().toLocaleTimeString();
}

function requireGlobals() {
  const { els, recalc } = window;
  if (!els || typeof recalc !== "function") {
    throw new Error(
      "UI globals not ready. Ensure calc-ui.js sets window.els and window.recalc before loading onchain-ui.js"
    );
  }
  return { els, recalc };
}

function applyPlayerToCalcUI({ els, player }) {
  if (!els || !player) return;

  // Only set if the durability controls exist (card present)
  const hasDur = els.durCurNum && els.durMaxNum;
  if (!hasDur) return;

  // Values from chain snapshot
  const cur = Number(player.currentDurability ?? 0);
  const max = Number(player.maxDurability ?? 0);

  if (Number.isFinite(max) && max > 0) {
    els.durMaxNum.value = String(max);
    if (els.durMaxRange) els.durMaxRange.value = String(max);
  }

  if (Number.isFinite(cur) && cur >= 0) {
    els.durCurNum.value = String(cur);
    if (els.durCurRange) {
      // keep slider max aligned with max durability
      if (Number.isFinite(max) && max > 0) els.durCurRange.max = String(max);
      els.durCurRange.value = String(cur);
    }
  }
}

const statusEl = document.getElementById("chainStatus");
const setStatus = (s) => {
  if (statusEl) statusEl.textContent = s;
};

function setActiveMePill() {
  const pill = document.getElementById("activeMe");
  if (!pill) return;
  const { activeOwner, playerSnapshot, globalSnapshot } = yieldCtx.getState();
  if (!activeOwner) {
    pill.textContent = "me: —";
    return;
  }
  const up = playerSnapshot?.unprocessedFish;
  const totalUp = globalSnapshot?.totalUnprocessedFish;

  const upStr = up != null ? formatFishFromRaw(up, { maxFrac: 6 }) : "—";
  const pctStr =
    up != null && totalUp != null ? ` (${formatPercentOf(up, totalUp, { dp: 4 })})` : "";

  pill.textContent = `me: ${shortAddr(activeOwner)} · unproc ${upStr}${pctStr}`;
}

function triggerSyncForOwner(ownerStr) {
  const v = (ownerStr || "").trim();
  if (!v) return;
  const ownerInput = document.getElementById("ownerAddr");
  if (ownerInput) ownerInput.value = v;

  const syncBtn = document.getElementById("syncChain");
  if (syncBtn) syncBtn.click();
}

function makeMePillClickable() {
  const pill = document.getElementById("activeMe");
  if (!pill) return;

  // NOTE: Phase 2 will remove direct style mutations (class toggle instead)
  pill.style.cursor = "pointer";
  pill.style.userSelect = "none";
  pill.setAttribute("role", "button");
  pill.tabIndex = 0;
  pill.title = "Click to load this player from chain";

  const activate = () => {
    const { activeOwner } = yieldCtx.getState();
    if (!activeOwner) return;
    triggerSyncForOwner(activeOwner);
  };

  pill.addEventListener("click", activate);
  pill.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      activate();
    }
  });
}

// Init "me" state on page load
setActiveMePill();
makeMePillClickable();
(async () => {
  await yieldCtx.refresh({ force: true });
  setActiveMePill();
})().catch(() => {});

// Wire buttons
const setAsMeBtn = document.getElementById("setAsMe");
const clearMeBtn = document.getElementById("clearMe");

if (setAsMeBtn) {
  setAsMeBtn.addEventListener("click", async () => {
    const ownerStr = (document.getElementById("ownerAddr")?.value || "").trim();
    if (!ownerStr) return;
    yieldCtx.setActiveOwner(ownerStr);
    await yieldCtx.refresh({ force: true });
    setActiveMePill();
  });
}

if (clearMeBtn) {
  clearMeBtn.addEventListener("click", () => {
    yieldCtx.clearActiveOwner();
    setActiveMePill();
  });
}

// ----------------------------
// Global ProcessFish watcher
// ----------------------------

function addProcessFeedRowRendered({
  signature,
  playerStr,
  netStr,
  grossStr,
  feeStr,
  myYieldStr,
}) {
  const ul = document.getElementById("processedFeed");
  if (!ul) return;

  const timeStr = new Date().toLocaleTimeString();

  // ✅ Rendered row (HTML)
  const html = renderProcessingRow({
    signature,
    timeStr,
    player: playerStr,
    playerShort: shortAddr(playerStr),
    net: netStr,
    gross: grossStr,
    fee: feeStr,
    myYield: myYieldStr || "",
  });

  ul.insertAdjacentHTML("afterbegin", html);

  while (ul.children.length > 25) ul.removeChild(ul.lastChild);
}

async function startProcessFishWatcher() {
  if (processWatcher.isLive) return; // already live

  const feed = document.getElementById("processedFeed");
  if (feed && feed.childElementCount === 0) {
    feed.innerHTML = "";
  }

  setProcStatus("listening (process_fish)…");

  await processWatcher.start({
    onEvent: async (evt) => {
      const { signature } = evt;

      if (!evt.decoded) {
        addProcessFeedRowRendered({
          signature,
          playerStr: "—",
          netStr: "—",
          grossStr: "—",
          feeStr: "—",
          myYieldStr: "",
        });
        setProcStatus("seen ✓");
        return;
      }

      const playerStr = evt.owner || "—";
      const netStr = formatTokenAmount(evt.netRaw, evt.decimals, { maxFrac: 6 });
      const grossStr = formatTokenAmount(evt.grossRaw, evt.decimals, { maxFrac: 6 });
      const feeStr = formatTokenAmount(evt.feeRaw, evt.decimals, { maxFrac: 6 });

      let myYieldStr = "";
      try {
        await yieldCtx.refresh();
        const myYieldRaw = yieldCtx.computeYieldFromFeeRaw(evt.feeRaw);
        if (myYieldRaw != null) {
          myYieldStr = formatTokenAmount(myYieldRaw, evt.decimals, { maxFrac: 6 });
        }
      } catch {}

      addProcessFeedRowRendered({
        signature,
        playerStr,
        netStr,
        grossStr,
        feeStr,
        myYieldStr,
      });
      setProcStatus("seen ✓");
    },
  });
}

async function stopProcessFishWatcher() {
  await processWatcher.stop();
  setProcStatus("paused");
}

// Auto-start on page load (global-only) and wire toggle
const procToggle = document.getElementById("procLiveToggle");
if (procToggle) {
  if (procToggle.checked) startProcessFishWatcher();
  else setProcStatus("paused");

  procToggle.addEventListener("change", async () => {
    if (procToggle.checked) await startProcessFishWatcher();
    else await stopProcessFishWatcher();
  });
} else {
  startProcessFishWatcher();
}

// ----------------------------
// Player Scanner (dedicated card)
// ----------------------------

function setScanStatus(s) {
  const el = document.getElementById("scanStatus");
  if (el) el.textContent = s;
}

function setScanBarPct(pct) {
  const el = document.getElementById("scanBar");
  if (!el) return;
  const p = Math.max(0, Math.min(100, Number(pct) || 0));
  el.style.width = `${p}%`; // Phase 2: class toggle
}

function setScanCount(s) {
  const el = document.getElementById("scanCount");
  if (el) el.textContent = s;
}

// ---- Player scan store (full decoded states) ----
window.playerStore = window.playerStore || {
  // array of decoded PlayerState objects (whatever decodePlayerState returns)
  players: [],
  // maps owner base58 -> decoded PlayerState
  byOwner: new Map(),
  // maps account pubkey base58 -> decoded PlayerState (optional, if you track it)
  byAccount: new Map(),
  lastUpdatedMs: 0,
};

function setPlayerStore(players, { byAccountPairs = null } = {}) {
  const byOwner = new Map();
  for (const p of players) {
    const owner = p?.owner?.toBase58?.();
    if (owner) byOwner.set(owner, p);
  }

  window.playerStore.players = players;
  window.playerStore.byOwner = byOwner;

  if (byAccountPairs) {
    const m = new Map();
    for (const [acct, p] of byAccountPairs) m.set(acct, p);
    window.playerStore.byAccount = m;
  }

  window.playerStore.lastUpdatedMs = Date.now();
}

function playerToJSON(p) {
  return {
    owner: p?.owner?.toBase58?.() || null,
    unprocessedFish: p?.unprocessedFish?.toString?.() ?? null,
    // add other fields you care about:
    // rodLevel: p.rodLevel ?? null,
    // durability: p.durability ?? null,
    // isHoneypot: p.isHoneypot ?? null,
    // lastActionTs: p.lastActionTs ?? null,
  };
}

function savePlayersCache() {
  try {
    const payload = {
      v: 1,
      ts: Date.now(),
      players: window.playerStore.players.map(playerToJSON),
    };
    localStorage.setItem("players_cache_v1", JSON.stringify(payload));
  } catch (e) {
    console.warn("savePlayersCache failed", e);
  }
}

function loadPlayersCache() {
  try {
    const raw = localStorage.getItem("players_cache_v1");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// Convenience for calculations
window.getPlayerByOwner = (ownerBase58) => window.playerStore.byOwner.get(ownerBase58) || null;
window.getAllPlayers = () => window.playerStore.players.slice();

async function scanPlayersOnce() {
  const topUl = document.getElementById("scanTop");
  if (topUl) topUl.innerHTML = "";

  setScanStatus("scanning…");
  setScanCount("—");
  setScanBarPct(2);

  const discB58 = bs58.encode(DISC_PLAYER);

  // Anchor discriminator is 8 bytes; owner Pubkey is very commonly the next field.
  // If your layout differs, change this offset.
  const OWNER_OFFSET = 8;

  const chunk = (arr, size) => {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  };

  // Promise pool helper to avoid spamming RPC with 256 concurrent requests
  async function runPool(items, worker, concurrency = 6) {
    const results = [];
    let idx = 0;
    const runners = Array.from({ length: concurrency }, async () => {
      while (idx < items.length) {
        const i = idx++;
        results[i] = await worker(items[i], i);
      }
    });
    await Promise.all(runners);
    return results;
  }

  try {
    // 1) Sharded pubkey discovery (avoids "accumulated scan results exceeded the limit")
    const bytes0to255 = Array.from({ length: 256 }, (_, i) => i);

    setScanCount("discovering players (sharded)…");
    setScanBarPct(5);

    const shardResults = await runPool(
      bytes0to255,
      async (b, i) => {
        // memcmp bytes expects base58 of the raw bytes you're matching
        const oneByte = bs58.encode(Uint8Array.from([b]));

        const keyed = await procConn.getProgramAccounts(FOGO_FISHING_PROGRAM_ID, {
          commitment: "confirmed",
          filters: [
            { memcmp: { offset: 0, bytes: discB58 } },
            { memcmp: { offset: OWNER_OFFSET, bytes: oneByte } },
          ],
          dataSlice: { offset: 0, length: 0 },
        });

        // progress through discovery: 5% -> 35%
        if (i % 4 === 0) setScanBarPct(5 + Math.floor((30 * (i + 1)) / 256));
        return keyed.map((x) => x.pubkey);
      },
      6 // concurrency; raise to 8 if your RPC is strong, lower to 3 if it rate-limits
    );

    const pubkeys = shardResults.flat();
    setScanCount(`${pubkeys.length.toLocaleString()} players (loading…)`);

    // 2) Load global state (optional)
    let global = null;
    try {
      global = await fetchGlobalState({ connection: procConn });
    } catch {}

    // 3) Batch fetch full datas and decode
    const rows = [];
    const batches = chunk(pubkeys, 100);

    for (let i = 0; i < batches.length; i++) {
      const infos = await procConn.getMultipleAccountsInfo(batches[i], "confirmed");
      for (const info of infos) {
        if (!info?.data) continue;
        try {
          rows.push(decodePlayerState(info.data));
        } catch {}
      }

      // progress through loading: 35% -> 95%
      const prog = 35 + Math.floor((60 * (i + 1)) / batches.length);
      setScanBarPct(Math.min(95, prog));
    }

    setPlayerStore(rows /*, { byAccountPairs }*/);
    savePlayersCache();
    
    // 4) Sort + render top 10
    rows.sort((a, b) => {
      const aa = a?.unprocessedFish ?? 0n;
      const bb = b?.unprocessedFish ?? 0n;
      return bb > aa ? 1 : bb < aa ? -1 : 0;
    });

    setScanCount(`${rows.length.toLocaleString()} players`);

    const totalUp = global?.totalUnprocessedFish ?? null;
    const top = rows.slice(0, 10);

    if (topUl) {
      for (const p of top) {
        const owner = p?.owner?.toBase58?.() || "—";
        const up = p?.unprocessedFish ?? 0n;
        const upStr = formatFishFromRaw(up, { maxFrac: 6 });
        const pctStr = totalUp != null ? formatPercentOf(up, totalUp, { dp: 4 }) : "";

        topUl.insertAdjacentHTML(
          "beforeend",
          renderScanRow({
            owner,
            ownerShort: shortAddr(owner),
            unprocessed: upStr,
            pct: pctStr,
          })
        );
      }
    }

    setScanStatus("done ✓");
    setScanBarPct(100);
  } catch (err) {
    console.error("scanPlayersOnce failed", err);
    setScanStatus("error");
    setScanBarPct(100);
    setScanCount("scan failed (see console)");
  }
}

const scanBtn = document.getElementById("scanPlayers");
if (scanBtn) scanBtn.addEventListener("click", () => scanPlayersOnce());

let unsubscribeFishCaught = null;

const btn = document.getElementById("syncChain");
if (btn) {
  btn.addEventListener("click", async () => {
    try {
      const { els, recalc } = requireGlobals();

      setStatus("loading…");

      const ownerStr = (document.getElementById("ownerAddr")?.value || "").trim();
      const ownerPubkey = ownerStr ? new PublicKey(ownerStr) : null;

      const { difficulty, rodLevel, connection, player, global: globalState } = await loadChainState({
        ownerPubkey,
      });

      // ✅ NEW: populate durability throughput card from loaded player
      applyPlayerToCalcUI({ els, player });

      if (setAsMeBtn) setAsMeBtn.disabled = !player || !ownerStr;

      if (Number.isFinite(difficulty)) {
        els.diffNum.value = String(difficulty);
        els.diffRange.value = String(difficulty);
      }
      if (Number.isFinite(rodLevel)) {
        els.levelNum.value = String(rodLevel);
        els.levelRange.value = String(rodLevel);
      }

      recalc();
      setStatus("synced ✓");

      // ✅ Snapshot rendering moved to renderer
      setSnapshotHTML(
        renderChainSnapshot({
          global: globalState,
          player,
          // pass helpers so renderer stays pure
          fmtBig,
          formatFishFromRaw,
          formatPercentOf,
          fmtTimeFromI64,
        })
      );

      // If loaded owner is active "me", refresh yield context
      {
        const { activeOwner } = yieldCtx.getState();
        if (activeOwner && ownerStr && activeOwner === ownerStr) {
          await yieldCtx.refresh({ force: true });
          setActiveMePill();
        }
      }

      // Start event stream after first successful sync
      if (unsubscribeFishCaught) await unsubscribeFishCaught();
      unsubscribeFishCaught = subscribeFishCaught({
        connection,
        onEvent: (evt, sig) => {
          console.log("FishCaught", sig, {
            evt: evt?.evt,
            player: evt.player.toBase58(),
            amount: evt.amount.toString(),
            castCount: evt.castCount.toString(),
            timestamp: evt.timestamp.toString(),
          });
        },
      });
    } catch (err) {
      console.error(err);
      setStatus("error");
      alert("Failed to load chain state (see console)");
    }
  });
}
