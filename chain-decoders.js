// chain-decoders.js
// Decoders for the specific accounts used by the UI.

import { bytesEq, Reader } from "./chain-binary.js";
import { DISC_GLOBAL, DISC_PLAYER } from "./chain-discriminators.js";

export function decodeGlobalState(data) {
  const disc = data.subarray(0, 8);
  if (!bytesEq(disc, DISC_GLOBAL)) throw new Error("Not a GlobalState account");

  const r = new Reader(data);
  r.skip(8);

  // pubkeys
  const authority = r.pubkey();
  const fishMint = r.pubkey();
  const fogoMint = r.pubkey();
  const fogoTreasury = r.pubkey();
  const fishBurnVault = r.pubkey();

  // numbers
  const currentDifficulty = r.u64();
  const totalNetworkPower = r.u64();
  const lastDifficultyAdjustment = r.i64();
  const baseEmissionRate = r.u64();
  const emissionDecayRate = r.u64();
  const dailyTargetEmission = r.u64();
  const totalFogoCollected = r.u128();
  const totalFishMinted = r.u64();
  const totalUnprocessedFish = r.u64();
  const accumulatedProcessingFees = r.u64();
  const feesPerUnprocessedFish = r.u128();
  const bump = r.u8v();
  const halvingCount = r.u8v();

  // reserved [u8; 6]
  r.skip(6);

  return {
    authority,
    fishMint,
    fogoMint,
    fogoTreasury,
    fishBurnVault,
    currentDifficulty,
    totalNetworkPower,
    lastDifficultyAdjustment,
    baseEmissionRate,
    emissionDecayRate,
    dailyTargetEmission,
    totalFogoCollected,
    totalFishMinted,
    totalUnprocessedFish,
    accumulatedProcessingFees,
    feesPerUnprocessedFish,
    bump,
    halvingCount,
  };
}

export function decodePlayerState(data) {
  const disc = data.subarray(0, 8);
  if (!bytesEq(disc, DISC_PLAYER)) throw new Error("Not a PlayerState account");

  const r = new Reader(data);
  r.skip(8);

  const owner = r.pubkey();
  const rodLevel = r.u8v();
  const boatTier = r.u8v();
  const bump = r.u8v();
  const castCount = r.u64();
  const fishCaughtAllTime = r.u64();
  const power = r.u64();
  const maxDurability = r.u32();
  const currentDurability = r.u32();
  const supercastRemainingCasts = r.u32();
  const lastDurabilityTs = r.i64();
  const unprocessedFish = r.u64();
  const lastClaimFeesSnapshot = r.u128();
  const lastRecordedUnprocessed = r.u64();
  const upgradeInProgress = r.bool();
  const upgradeTargetLevel = r.u8v();
  const upgradeCastsAtStart = r.u64();
  const lastAtaCreationSlot = r.u64();
  const lastCastSlot = r.u64();
  const ataSubsidyClaimed = r.bool();
  const isHoneypot = r.bool();
  const firstProcessFeePaid = r.bool();

  // reserved [u8; 4]
  r.skip(4);

  return {
    owner,
    rodLevel,
    boatTier,
    bump,
    castCount,
    fishCaughtAllTime,
    power,
    maxDurability,
    currentDurability,
    supercastRemainingCasts,
    lastDurabilityTs,
    unprocessedFish,
    lastClaimFeesSnapshot,
    lastRecordedUnprocessed,
    upgradeInProgress,
    upgradeTargetLevel,
    upgradeCastsAtStart,
    lastAtaCreationSlot,
    lastCastSlot,
    ataSubsidyClaimed,
    isHoneypot,
    firstProcessFeePaid,
  };
}
