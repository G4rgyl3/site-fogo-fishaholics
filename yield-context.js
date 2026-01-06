// yield-context.js
// Chain-only logic for tracking an "active player" ("me") and computing yield.

import { PublicKey } from "https://esm.sh/@solana/web3.js@1.98.0";
import { fetchGlobalState, fetchPlayerState } from "./chain.js";

export function createYieldContext({
  connection,
  storageKey = "fogo.activeOwner",
  minRefreshMs = 10_000,
} = {}) {
  let activeOwner = null; // base58 string
  let playerSnapshot = null; // decoded PlayerState or null
  let globalSnapshot = null; // decoded GlobalState or null
  let lastRefreshAt = 0;

  function loadFromStorage() {
    try {
      const v = (localStorage.getItem(storageKey) || "").trim();
      activeOwner = v || null;
    } catch {
      activeOwner = null;
    }
  }

  function saveToStorage() {
    try {
      if (!activeOwner) localStorage.removeItem(storageKey);
      else localStorage.setItem(storageKey, activeOwner);
    } catch {}
  }

  async function refresh({ force = false } = {}) {
    const now = Date.now();
    if (!force && now - lastRefreshAt < minRefreshMs) return;
    lastRefreshAt = now;

    if (!activeOwner) {
      playerSnapshot = null;
      globalSnapshot = null;
      return;
    }

    try {
      const [g, p] = await Promise.all([
        fetchGlobalState({ connection }),
        fetchPlayerState({ ownerPubkey: new PublicKey(activeOwner), connection }),
      ]);
      globalSnapshot = g;
      playerSnapshot = p;
    } catch {
      // Keep last good snapshots
    }
  }

  function setActiveOwner(ownerStr) {
    activeOwner = (ownerStr || "").trim() || null;
    playerSnapshot = null;
    globalSnapshot = null;
    lastRefreshAt = 0;
    saveToStorage();
  }

  function clearActiveOwner() {
    activeOwner = null;
    playerSnapshot = null;
    globalSnapshot = null;
    lastRefreshAt = 0;
    saveToStorage();
  }

  function getState() {
    return {
      activeOwner,
      playerSnapshot,
      globalSnapshot,
    };
  }

  // myYield = fee * (myUnprocessed / totalUnprocessed)
  function computeYieldFromFeeRaw(feeRaw) {
    try {
      if (!activeOwner) return null;
      const myUp = playerSnapshot?.unprocessedFish;
      const totalUp = globalSnapshot?.totalUnprocessedFish;
      if (myUp == null || totalUp == null) return null;
      if (typeof myUp !== "bigint" || typeof totalUp !== "bigint") return null;
      if (totalUp <= 0n) return null;

      const fee = BigInt(feeRaw);
      return (fee * myUp) / totalUp;
    } catch {
      return null;
    }
  }

  // Initialize from storage on creation.
  loadFromStorage();

  return {
    loadFromStorage,
    refresh,
    setActiveOwner,
    clearActiveOwner,
    getState,
    computeYieldFromFeeRaw,
  };
}
