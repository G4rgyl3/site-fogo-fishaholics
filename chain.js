// chain.js
// Public barrel export for chain-related functionality.
//
// This file keeps the original import surface (PROGRAM_ID, PDAs, fetch helpers,
// subscriptions) while the actual implementations are split into small modules.

export { PROGRAM_ID, RPC_HTTP, RPC_WS, makeConnection } from "./chain-config.js";
export { globalStatePda, playerStatePda } from "./chain-pdas.js";

export {
  DISC_GLOBAL,
  DISC_PLAYER,
  DISC_FISH_CAUGHT,
} from "./chain-discriminators.js";

export { bytesEq, Reader } from "./chain-binary.js";
export { decodeGlobalState, decodePlayerState } from "./chain-decoders.js";

export {
  fetchAllPlayerStates,
  fetchAllPlayerOwners,
  clearScanCache,
} from "./chain-scan.js";

export { fetchGlobalState, fetchPlayerState, loadChainState } from "./chain-fetch.js";
export { subscribePlayerState, subscribeFishCaught } from "./chain-events.js";
