// ui/render-scan-row.js

import { shortAddr } from "../onchain-ui-utils.js";

export function renderScanRow({ owner, unprocessed, pct }) {
  return `
    <li>
      <b>${shortAddr(owner)}</b>
      · unproc ${unprocessed}${pct ? ` (${pct})` : ""}
    </li>
  `;
}
