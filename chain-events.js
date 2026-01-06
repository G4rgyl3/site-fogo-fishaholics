// chain-events.js
// Program-level streaming helpers.

import { Connection, PublicKey } from "https://esm.sh/@solana/web3.js@1.98.0";
import { makeConnection, PROGRAM_ID } from "./chain-config.js";
import { playerStatePda } from "./chain-pdas.js";
import { bytesEq, Reader } from "./chain-binary.js";
import { decodePlayerState } from "./chain-decoders.js";
import { DISC_FISH_CAUGHT } from "./chain-discriminators.js";

const RARITY = ["Common", "Uncommon", "Rare", "Mythical", "Legendary", "Lunker"];

function decodeFishCaughtEvent(bytes) {
  const r = new Reader(bytes);
  r.skip(8);

  const player = r.pubkey();
  const rarityIdx = r.u8v();
  const amount = r.u64();
  const castCount = r.u64();
  const timestamp = r.i64();

  return {
    player,
    rarity: RARITY[rarityIdx] ?? `Unknown(${rarityIdx})`,
    amount,
    castCount,
    timestamp,
  };
}

export function subscribePlayerState({ connection, ownerPubkey, onChange }) {
  const conn = connection ?? makeConnection();
  if (!ownerPubkey) throw new Error("ownerPubkey required");

  const owner = typeof ownerPubkey === "string" ? new PublicKey(ownerPubkey) : ownerPubkey;
  const pda = playerStatePda(owner);

  const subId = conn.onAccountChange(
    pda,
    (accInfo) => {
      try {
        const player = decodePlayerState(accInfo.data);
        onChange?.(player);
      } catch {
        // ignore decode errors
      }
    },
    "confirmed"
  );

  return async () => {
    await conn.removeAccountChangeListener(subId);
  };
}

// Parse "Program data: <base64>" logs for the FishCaught event.
export function subscribeFishCaught({ connection, onEvent }) {
  const conn = connection ?? makeConnection();

  const subId = conn.onLogs(
    PROGRAM_ID,
    (logInfo) => {
      for (const line of logInfo.logs) {
        const m = line.match(/^Program data:\s+(.+)$/);
        if (!m) continue;

        try {
          const raw = Uint8Array.from(atob(m[1]), (c) => c.charCodeAt(0));
          if (!bytesEq(raw.subarray(0, 8), DISC_FISH_CAUGHT)) continue;

          const evt = decodeFishCaughtEvent(raw);
          onEvent?.(evt, logInfo.signature);
        } catch {
          // ignore parse failures
        }
      }
    },
    "confirmed"
  );

  return async () => {
    await conn.removeOnLogsListener(subId);
  };
}

// Optional helper for non-UI callers that want a dedicated websocket connection.
export function makeWsConnection(rpcHttp, wsEndpoint) {
  return new Connection(rpcHttp, { commitment: "confirmed", wsEndpoint });
}
