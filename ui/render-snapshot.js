import {
  fmtBig,
  formatFishFromRaw,
  formatPercentOf,
  fmtTimeFromI64,
} from "../onchain-ui-formatters.js";

export function renderChainSnapshot({ global, player }) {
  if (!global) {
    return `<div class="snapshotMuted">No data loaded yet.</div>`;
  }

  const globalHtml = `
    <div class="snapshotGrid">
      <div>Difficulty</div><div>${fmtBig(global.currentDifficulty)}</div>
      <div>Total network power</div><div>${fmtBig(global.totalNetworkPower)}</div>
      <div>Total fish minted</div><div>${formatFishFromRaw(global.totalFishMinted)}</div>
      <div>Total unprocessed fish</div><div>${formatFishFromRaw(global.totalUnprocessedFish)}</div>
      <div>Daily target emission</div><div>${formatFishFromRaw(global.dailyTargetEmission)}</div>
      <div>Last difficulty adj</div><div>${fmtTimeFromI64(global.lastDifficultyAdjustment)}</div>
    </div>
  `;

  if (!player) {
    return (
      globalHtml +
      `<div class="snapshotMuted">No PlayerState found for that owner.</div>`
    );
  }

  const pct = formatPercentOf(
    player.unprocessedFish,
    global.totalUnprocessedFish,
    { dp: 4 }
  );

  return (
    globalHtml +
    `
    <hr class="snapshotDivider" />

    <div class="snapshotTitle">Player</div>
    <div class="snapshotGrid">
      <div>Owner</div>
      <div class="mono snapshotAddr">${player.owner.toBase58()}</div>

      <div>Rod level</div><div>${player.rodLevel}</div>
      <div>Boat tier</div><div>${player.boatTier}</div>
      <div>Casts</div><div>${fmtBig(player.castCount)}</div>
      <div>Power</div><div>${fmtBig(player.power)}</div>

      <div>Durability</div>
      <div class="statStrong">
        ${player.currentDurability}/${player.maxDurability}
      </div>

      <div>Unprocessed fish</div>
      <div class="statStrong">
        ${formatFishFromRaw(player.unprocessedFish)} (${pct})
      </div>

      <div>Supercast remaining</div>
      <div>${player.supercastRemainingCasts}</div>

      <div>Upgrade in progress</div>
      <div>${player.upgradeInProgress ? "yes" : "no"}</div>

      <div>Honeypot</div>
      <div class="${player.isHoneypot ? "statBad" : "statGood"}">
        ${player.isHoneypot ? "yes 🐝" : "no"}
      </div>
    </div>
  `
  );
}
