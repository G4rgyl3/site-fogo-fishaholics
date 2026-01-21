// ui/render-global-stats.js
import {
  fmtBig,
  formatFishFromRaw,
  fmtTimeFromI64,
} from "../onchain-ui-formatters.js";

export function statTile({ icon, label, value, sub }) {
  return `
    <div class="gstat">
      <div class="gstatIcon" aria-hidden="true">${icon}</div>
      <div class="gstatBody">
        <div class="gstatLabel">${label}</div>
        <div class="gstatValue">${value}</div>
        ${sub ? `<div class="gstatSub">${sub}</div>` : ""}
      </div>
    </div>
  `;
}

export function renderGlobalStatsPanel(global) {
  if (!global) {
    return `
      <div class="gstatsPanel">
        <div class="gstatsHead">
          <div class="gstatsTitle">🌍 Global Network Statistics</div>
          <div class="gstatsSub">No data loaded yet.</div>
        </div>
      </div>
    `;
  }

  return `
    <div class="gstatsPanel">
      <div class="gstatsHead">
        <div class="gstatsTitle">🌍 Global Network Statistics</div>
        <div class="gstatsSub">Live snapshot from chain</div>
      </div>

      <div class="gstatsGrid">
        ${statTile({
          icon: "⚙️",
          label: "Current Difficulty",
          value: fmtBig(global.currentDifficulty),
        })}
        ${statTile({
          icon: "⚡",
          label: "Total Network Power",
          value: fmtBig(global.totalNetworkPower),
        })}
        ${statTile({
          icon: "🐟",
          label: "Total Fish Minted",
          value: `${formatFishFromRaw(global.totalFishMinted)} FISH`,
        })}
        ${statTile({
          icon: "🐠",
          label: "Total Unprocessed Fish",
          value: `${formatFishFromRaw(global.totalUnprocessedFish)} FISH`,
        })}
        ${statTile({
          icon: "🎯",
          label: "Daily Target Emission",
          value: `${formatFishFromRaw(global.dailyTargetEmission)} FISH`,
        })}
        ${statTile({
          icon: "🕒",
          label: "Last Difficulty Adj",
          value: fmtTimeFromI64(global.lastDifficultyAdjustment),
        })}
      </div>
    </div>
  `;
}
