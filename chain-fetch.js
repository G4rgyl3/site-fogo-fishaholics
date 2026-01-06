// chain-fetch.js
// Single-shot reads (no subscriptions)

import { PublicKey } from "https://esm.sh/@solana/web3.js@1.98.0";
import { makeConnection } from "./chain-config.js";
import { globalStatePda, playerStatePda } from "./chain-pdas.js";
import { decodeGlobalState, decodePlayerState } from "./chain-decoders.js";

export async function fetchGlobalState({ connection } = {}) {
  const conn = connection ?? makeConnection();
  const info = await conn.getAccountInfo(globalStatePda(), "confirmed");
  if (!info?.data) throw new Error("GlobalState not found");
  return decodeGlobalState(info.data);
}

export async function fetchPlayerState({ ownerPubkey, connection } = {}) {
  if (!ownerPubkey) throw new Error("ownerPubkey required");

  const owner = typeof ownerPubkey === "string" ? new PublicKey(ownerPubkey) : ownerPubkey;
  const conn = connection ?? makeConnection();

  const info = await conn.getAccountInfo(playerStatePda(owner), "confirmed");
  if (!info?.data) return null;
  return decodePlayerState(info.data);
}

export async function loadChainState({ ownerPubkey } = {}) {
  const connection = makeConnection();

  // Global
  const gInfo = await connection.getAccountInfo(globalStatePda(), "confirmed");
  if (!gInfo?.data) throw new Error("GlobalState not found");
  const g = decodeGlobalState(gInfo.data);

  // Optional player
  let p = null;
  if (ownerPubkey) {
    const owner = typeof ownerPubkey === "string" ? new PublicKey(ownerPubkey) : ownerPubkey;
    const pInfo = await connection.getAccountInfo(playerStatePda(owner), "confirmed");
    if (pInfo?.data) p = decodePlayerState(pInfo.data);
  }

  return {
    difficulty: Number(g.currentDifficulty), // may truncate if gigantic; fine for slider use
    rodLevel: p ? p.rodLevel : null,
    player: p,
    global: g,
    connection,
  };
}
