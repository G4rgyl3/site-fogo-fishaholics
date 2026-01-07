// onchain-ui-utils.js
export function shortAddr(a) {
  if (!a) return "—";
  const s = String(a);
  return s.length > 12 ? `${s.slice(0, 4)}…${s.slice(-4)}` : s;
}
