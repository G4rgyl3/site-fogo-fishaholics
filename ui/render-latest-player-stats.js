// ui/render-latest-player-stats.js

import {
  formatFishFromRaw,
} from "../onchain-ui-formatters.js";
import { statTile } from './render-global-stats.js';


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

function scanner(){
  return `<div style="width:100%;">
            <div id="playerScanCard">
            <div class="titleRow">
              <div style="display:flex; align-items:center; gap:10px;">
                <button id="scanPlayers">Scan players</button>
                <span class="pill" id="scanStatus">idle</span>
              </div>
            </div>

            <div class="scanBarWrap" style="margin-top: 12px;">
              <div class="scanBar" id="scanBar"></div>
            </div>
            <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; margin-top:10px; flex-wrap:wrap;">
              <div class="sub" id="scanCount">—</div>
              <div class="sub">Top unprocessed (sample)</div>
            </div>

            <ul class="clean" id="scanTop" style="margin-top:10px;"></ul>
            </div>
          </div>`;
}

export function renderLatestPlayerStatsPanel(stats) {
  if (!stats) {
     return `
      <div class="gstatsPanel">
        <div class="gstatsHead">
          <div class="gstatsTitle">🌍 Player Statistics</div>
          ${scanner()}
          <div class="gstatsSub">No data loaded yet.</div>
        </div>
      </div>
    `;
  }

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
  if (upAvg != null) upSubBits.push(`avg ${formatFishFromRaw(upAvg)}`);
  if (upSamples != null) upSubBits.push(`${fmtInt(upSamples)} samples`);

  return `
    <div class="gstatsPanel">
      <div class="gstatsHead">
        <div class="gstatsTitle">🌍 Player Statistics</div>
        ${scanner()}
        <div class="gstatsSub">Live snapshot from chain</div>
      </div>

      <div class="gstatsGrid">
      ${statTile({
        icon: "🧑‍🤝‍🧑",
        label: "Players scanned",
        value: players != null ? fmtInt(players) : "—",
      })}

      ${statTile({
        icon: "🎣",
        label: "Rod level (min / med / max)",
        value:
          rodMin != null && rodMed != null && rodMax != null
            ? `${rodMin} / ${rodMed} / ${rodMax}`
            : "—",
        sub: rodSubBits.join(" · "),
      })}

      ${statTile({
        icon: "🐟",
        label: "Total unprocessed",
        value: formatFishFromRaw(upTotal),
      })}

      ${statTile({
        icon: "📊",
        label: "Unprocessed (min / med / max)",
        value:
          upMin != null && upMed != null && upMax != null
            ? `${formatFishFromRaw(upMin)} / ${formatFishFromRaw(upMed)} / ${formatFishFromRaw(upMax)}`
            : "—",
        sub: upSubBits.join(" · "),
      })}
    </div>
  </div>
  `;
}
