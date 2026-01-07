// onchain-ui-formatters.js

function commaIntString(s) {
  return String(s).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function fmtBig(x) {
  try {
    const comma = (s) => String(s).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    if (typeof x === "bigint") return comma(x.toString());
    if (typeof x === "number") return Number.isFinite(x) ? comma(String(Math.trunc(x))) : "—";
    if (x == null) return "—";
    const s = String(x);
    if (/^-?\d+$/.test(s)) return comma(s);
    return s;
  } catch {
    return "—";
  }
}

export function formatTokenAmount(raw, decimals, { maxFrac = 6 } = {}) {
  try {
    const r = BigInt(raw);
    const d = 10n ** BigInt(decimals);
    const whole = r / d;
    let frac = (r % d).toString().padStart(decimals, "0");
    if (maxFrac < decimals) frac = frac.slice(0, maxFrac);
    frac = frac.replace(/0+$/, "");
    const w = commaIntString(whole.toString());
    return frac.length ? `${w}.${frac}` : w;
  } catch {
    return "—";
  }
}

// FISH amounts are stored as raw integers on-chain. SPL mint uses 6 decimals.
export function formatFishFromRaw(raw, { maxFrac = 6 } = {}) {
  return formatTokenAmount(raw, 6, { maxFrac });
}

// Returns e.g. "0.2929%" for part/total.
export function formatPercentOf(partRaw, totalRaw, { dp = 4 } = {}) {
  try {
    const part = BigInt(partRaw);
    const total = BigInt(totalRaw);
    if (total <= 0n) return "—";

    const scale = 10n ** BigInt(dp);
    const numer = part * 100n * scale;
    const val = (numer + total / 2n) / total; // rounded

    const intPart = val / scale;
    const fracPart = (val % scale).toString().padStart(Number(dp), "0");
    return `${intPart.toString()}.${fracPart}%`;
  } catch {
    return "—";
  }
}

export function fmtTimeFromI64(i64) {
  try {
    const n = typeof i64 === "bigint" ? Number(i64) : Number(i64);
    if (!Number.isFinite(n) || n <= 0) return "—";
    return new Date(n * 1000).toLocaleString();
  } catch {
    return "—";
  }
}
