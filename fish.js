const ROD_POWERS_BASE = [100,110,121,133,146,161,177,195,214,236];
const ROD_POWER_SCALE = 1.0294;
const MAX_ROD_POWER = 1000;

const BASE_CATCH_RATE_BP = 1430;
const CATCH_RATE_BONUSES_BP = [0,0,0,230,230,570,570,1070,1070,1900];

// Bundle constants:
const BASE_EMISSION_RATE = 80_000_000;
const RARITY_THRESHOLDS_BP = [7000, 9000, 9750, 9950, 9995, 10000];
const RARITY_MULTIPLIERS_TENTHS = [10, 30, 80, 250, 1000, 5000];

function rodPower(level) {
  if (level <= ROD_POWERS_BASE.length) return ROD_POWERS_BASE[level - 1];

  let power = ROD_POWERS_BASE[ROD_POWERS_BASE.length - 1];
  for (let lvl = 11; lvl <= level; lvl++) {
    power = Math.floor(power * ROD_POWER_SCALE);
    if (power >= MAX_ROD_POWER) return MAX_ROD_POWER;
  }
  return power;
}

function calculateCatchChance(level) {
  const idx = Math.min(Math.max(level - 1, 0), CATCH_RATE_BONUSES_BP.length - 1);
  const totalBP = BASE_CATCH_RATE_BP + CATCH_RATE_BONUSES_BP[idx];
  return totalBP / 10_000; // BP -> probability
}

// Convert cumulative thresholds to bucket weights that sum to 10,000
function rarityBucketsFromThresholds(thresholdsBp) {
  const buckets = [];
  let prev = 0;
  for (const t of thresholdsBp) {
    buckets.push(t - prev);
    prev = t;
  }
  // thresholds should end at 10000; if not, clamp
  const sum = buckets.reduce((a,b) => a + b, 0);
  if (sum !== 10_000) buckets[buckets.length - 1] += (10_000 - sum);
  return buckets;
}

function calculateExpectedFishPerCast(level, difficulty) {
  const catchChance = calculateCatchChance(level);
  const safeDifficulty = Math.max(difficulty, 1);

  const power = rodPower(level);

  // Base emission per successful catch (raw micro-units)
  const emissionPerCatchRaw = (power * BASE_EMISSION_RATE) / safeDifficulty;

  const bucketsBP = rarityBucketsFromThresholds(RARITY_THRESHOLDS_BP);

  // “Rarity gate” caps which multiplier you can benefit from
  const rarityGate = Math.min(level - 1, RARITY_MULTIPLIERS_TENTHS.length - 1);

  let expectedMultiplierTenthsBpWeighted = 0;
  for (let i = 0; i < bucketsBP.length; i++) {
    const gatedIndex = Math.min(i, rarityGate);
    expectedMultiplierTenthsBpWeighted += bucketsBP[i] * RARITY_MULTIPLIERS_TENTHS[gatedIndex];
  }

  const expectedMultiplierTenths = Math.max(
    10,
    Math.round(expectedMultiplierTenthsBpWeighted / 10_000)
  );

  // Convert micro-units → FISH
  const emissionPerCatch = (emissionPerCatchRaw * expectedMultiplierTenths) / 10 / 1e6;

  return catchChance * emissionPerCatch;
}
