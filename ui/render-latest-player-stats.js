// ui/render-latest-player-stats.js

function tile({ icon, label, value, sub }) {
  return `
    <div class="statTile">
      <div class="statIcon" aria-hidden="true">${icon}</div>
      <div class="statMeta">
        <div class="statLabel">${label}</div>
        <div class="statValue">${value ?? "—"}</div>
        ${sub ? `<div class="statSub">${sub}</div>` : ``}
      </div>
    </div>
  `;
}

function fmtNum(x, dp = 2) {
  if (x == null) return "—";
  const n = Number(x);
  if (!Number.isFinite(n)) return String(x);
  return n.toLocaleString(undefined, { maximumFractionDigits: dp });
}

function fmtInt(x) {
  if (x == null) return "—";
  const n = Number(x);
  if (!Number.isFinite(n)) return String(x);
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function safeFish(x) {
  // formatted stats already pass strings like "967,985.833058"
  if (x == null) return "—";
  if (typeof x === "string") return x;
  if (typeof window.formatFishFromRaw === "function" && typeof x === "bigint") {
    return window.formatFishFromRaw(x, { maxFrac: 6 });
  }
  return typeof x === "bigint" ? x.toString() : String(x);
}

function rodCountsSummary(countsByLevel) {
  // formatted: [[lvl,count],...]
  if (Array.isArray(countsByLevel)) {
    // show top 3 most common levels
    const top = countsByLevel
      .slice()
      .sort((a, b) => (b?.[1] ?? 0) - (a?.[1] ?? 0))
      .slice(0, 3)
      .map(([lvl, c]) => `L${lvl}: ${fmtInt(c)}`)
      .join(" · ");
    return top || "";
  }
  // raw: { "1":1115, ... }
  if (countsByLevel && typeof countsByLevel === "object") {
    const entries = Object.entries(countsByLevel)
      .map(([k, v]) => [Number(k), Number(v)])
      .filter(([lvl, c]) => Number.isFinite(lvl) && Number.isFinite(c));
    const top = entries
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([lvl, c]) => `L${lvl}: ${fmtInt(c)}`)
      .join(" · ");
    return top || "";
  }
  return "";
}

export function renderLatestPlayerStatsPanel(stats) {
  if (!stats) return `<div class="sub" style="opacity:.8;">No stats yet.</div>`;

  const players = stats.players ?? stats.playersCount ?? null;

  const rod = stats.rod || {};
  const rodMin = rod.min ?? null;
  const rodMed = rod.median ?? null;
  const rodMax = rod.max ?? null;
  const rodAvg = rod.avg ?? null;
  const rodSamples = rod.samples ?? null;
  const rodCounts = rod.countsByLevel ?? null;

  const up = stats.unprocessed || {};
  const upTotal = up.total ?? up.totalUpStr ?? null;
  const upMin = up.min ?? null;
  const upMed = up.median ?? null;
  const upMax = up.max ?? null;
  const upAvg = up.avg ?? null;
  const upSamples = up.samples ?? null;

  const rodSubBits = [];
  if (rodAvg != null) rodSubBits.push(`avg ${fmtNum(rodAvg, 2)}`);
  if (rodSamples != null) rodSubBits.push(`${fmtInt(rodSamples)} samples`);
  const rodTop = rodCountsSummary(rodCounts);
  if (rodTop) rodSubBits.push(rodTop);

  const upSubBits = [];
  if (upAvg != null) upSubBits.push(`avg ${safeFish(upAvg)}`);
  if (upSamples != null) upSubBits.push(`${fmtInt(upSamples)} samples`);

  return `
    <div class="statsPanelGrid">
      ${tile({
        icon: "🧑‍🤝‍🧑",
        label: "Players scanned",
        value: players != null ? fmtInt(players) : "—",
      })}

      ${tile({
        icon: "🎣",
        label: "Rod level (min / med / max)",
        value:
          rodMin != null && rodMed != null && rodMax != null
            ? `${rodMin} / ${rodMed} / ${rodMax}`
            : "—",
        sub: rodSubBits.join(" · "),
      })}

      ${tile({
        icon: "🐟",
        label: "Total unprocessed",
        value: safeFish(upTotal),
      })}

      ${tile({
        icon: "📊",
        label: "Unprocessed (min / med / max)",
        value:
          upMin != null && upMed != null && upMax != null
            ? `${safeFish(upMin)} / ${safeFish(upMed)} / ${safeFish(upMax)}`
            : "—",
        sub: upSubBits.join(" · "),
      })}
    </div>
  `;
}
