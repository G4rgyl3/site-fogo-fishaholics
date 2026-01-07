// ui/render-processing-row.js
import { shortAddr } from "../onchain-ui-utils.js";

export function renderProcessingRow({
  signature,
  timeStr,
  player,
  net,
  gross,
  fee,
  myYield,
}) {
  const sigShort = `${signature.slice(0, 8)}…`;

  return `
    <li class="procRow">
      <div class="procRowInner">
        
        <!-- LEFT: value chips -->
        <div class="procChips">
          <div class="chip chip--net">
            <span>Net</span><b>${net}</b>
          </div>
          <div class="chip chip--gross">
            <span>Gross</span><b>${gross}</b>
          </div>
          <div class="chip chip--fee">
            <span>Fee</span><b>${fee}</b>
          </div>
          ${
            myYield
              ? `<div class="chip chip--me">
                   <span>Me</span><b>${myYield}</b>
                 </div>`
              : ""
          }
        </div>

        <!-- RIGHT: meta -->
        <div class="procRight">
          <div class="procMeta">
            <span class="procAddr">${shortAddr(player)}</span>
            <span class="procTime">${timeStr}</span>
          </div>

          <a
            class="txLink"
            href="https://fogoscan.com/tx/${signature}"
            target="_blank"
            rel="noopener"
          >
            View tx
          </a>
        </div>

      </div>
    </li>
  `;
}


window.renderProcessingRow = renderProcessingRow;