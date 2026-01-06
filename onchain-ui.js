// onchain-ui.js
// Extracted from the inline <script type="module"> block in fish.html.
// Wires the "Load from chain" button to fetch current state + start subscriptions.

// NOTE: Player-level subscriptions are intentionally disabled.
// We only load the current player snapshot during a manual sync, and rely on
// program-level subscriptions (e.g., ProcessFish) for live activity.
import {
  loadChainState,
  subscribeFishCaught,
} from "./chain.js";
import { Connection, PublicKey } from "https://esm.sh/@solana/web3.js@1.98.0";
import { createYieldContext } from "./yield-context.js";
import { createProcessFishWatcher } from "./process-fish-watcher.js";

// Fishing program (from explorer logs)
const FOGO_FISHING_PROGRAM_ID = new PublicKey("SEAyjT1FUx3JyXJnWt5NtjELDwuU9XsoZeZVPVvweU4");

// Fish Processing detection is ALWAYS global.
// It starts automatically on page load and is controlled only by the Live toggle.
const PROC_RPC = "https://mainnet.fogo.io";
const procConn = new Connection(PROC_RPC, "confirmed");

// Chain-only state for "me" (active player) and yield calculations.
const yieldCtx = createYieldContext({
  connection: procConn,
  storageKey: "fogo.activeOwner",
  minRefreshMs: 10_000,
});

// Chain-only ProcessFish watcher (global only).
const processWatcher = createProcessFishWatcher({
  connection: procConn,
  programId: FOGO_FISHING_PROGRAM_ID,
});

function shortAddr(a) {
  if (!a) return "—";
  const s = String(a);
  return s.length > 12 ? `${s.slice(0, 4)}…${s.slice(-4)}` : s;
}

function fracToFixedString(frac, decimals) {
  let s = frac.toString();
  while (s.length < decimals) s = "0" + s;
  // trim trailing zeros for display
  s = s.replace(/0+$/, "");
  return s.length ? s : "0";
}


function fmtBig(x) {
  try {
    const comma = (s) => String(s).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    if (typeof x === "bigint") return comma(x.toString());
    if (typeof x === "number") return Number.isFinite(x) ? comma(String(Math.trunc(x))) : "—";
    if (x == null) return "—";
    // If it's already a string number, comma it.
    const s = String(x);
    if (/^-?\d+$/.test(s)) return comma(s);
    return s;
  } catch {
    return "—";
  }
}

function commaIntString(s) {
  return String(s).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function formatTokenAmount(raw, decimals, { maxFrac = 6 } = {}) {
  try {
    const r = BigInt(raw);
    const d = BigInt(10) ** BigInt(decimals);
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

// FISH amounts are stored as raw integers on-chain. The SPL mint uses 6 decimals.
function formatFishFromRaw(raw, { maxFrac = 6 } = {}) {
  return formatTokenAmount(raw, 6, { maxFrac });
}

// Returns e.g. "0.2929%" for part/total.
function formatPercentOf(partRaw, totalRaw, { dp = 4 } = {}) {
  try {
    const part = BigInt(partRaw);
    const total = BigInt(totalRaw);
    if (total <= 0n) return "—";

    const scale = 10n ** BigInt(dp); // decimal places on the percent value
    // percentScaled = (part/total) * 100 * scale
    const numer = part * 100n * scale;
    const val = (numer + total / 2n) / total; // rounded

    const intPart = val / scale;
    const fracPart = (val % scale).toString().padStart(Number(dp), "0");
    return `${intPart.toString()}.${fracPart}%`;
  } catch {
    return "—";
  }
}

function fmtTimeFromI64(i64) {
  try {
    const n = typeof i64 === "bigint" ? Number(i64) : Number(i64);
    if (!Number.isFinite(n) || n <= 0) return "—";
    return new Date(n * 1000).toLocaleString();
  } catch {
    return "—";
  }
}

function setProcStatus(s) {
  const el = document.getElementById("procStatus");
  if (el) el.textContent = s;
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function setSnapshotHTML(html) {
  const snap = document.getElementById("chainSnapshot");
  if (snap) snap.innerHTML = html;
  const upd = document.getElementById("chainUpdated");
  if (upd) upd.textContent = new Date().toLocaleTimeString();
}

function requireGlobals() {
  // fish.html exposes these after the non-module script runs.
  const { els, recalc } = window;
  if (!els || typeof recalc !== "function") {
    throw new Error(
      "UI globals not ready. Ensure fish.html sets window.els and window.recalc before loading onchain-ui.js"
    );
  }
  return { els, recalc };
}

const statusEl = document.getElementById("chainStatus");
const setStatus = (s) => {
  if (statusEl) statusEl.textContent = s;
};

function setActiveMePill() {
  const pill = document.getElementById("activeMe");
  if (!pill) return;
  const { activeOwner, playerSnapshot, globalSnapshot } = yieldCtx.getState();
  if (!activeOwner) {
    pill.textContent = "me: —";
    return;
  }
  const up = playerSnapshot?.unprocessedFish;
  const totalUp = globalSnapshot?.totalUnprocessedFish;

  const upStr = up != null ? formatFishFromRaw(up, { maxFrac: 6 }) : "—";
  const pctStr =
    up != null && totalUp != null ? ` (${formatPercentOf(up, totalUp, { dp: 4 })})` : "";

  pill.textContent = `me: ${shortAddr(activeOwner)} · unproc ${upStr}${pctStr}`;
}

function triggerSyncForOwner(ownerStr) {
  const v = (ownerStr || "").trim();
  if (!v) return;
  const ownerInput = document.getElementById("ownerAddr");
  if (ownerInput) ownerInput.value = v;

  const syncBtn = document.getElementById("syncChain");
  if (syncBtn) syncBtn.click();
}

function makeMePillClickable() {
  const pill = document.getElementById("activeMe");
  if (!pill) return;

  // Make it behave like a button without changing fish.html
  pill.style.cursor = "pointer";
  pill.style.userSelect = "none";
  pill.setAttribute("role", "button");
  pill.tabIndex = 0;
  pill.title = "Click to load this player from chain";

  const activate = () => {
    const { activeOwner } = yieldCtx.getState();
    if (!activeOwner) return;
    triggerSyncForOwner(activeOwner);
  };

  pill.addEventListener("click", activate);
  pill.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      activate();
    }
  });
}


// Init "me" state on page load
setActiveMePill();
makeMePillClickable();
// Best-effort warm cache for yield calcs
(async () => {
  await yieldCtx.refresh({ force: true });
  setActiveMePill();
})().catch(() => {});

// Wire buttons
const setAsMeBtn = document.getElementById("setAsMe");
const clearMeBtn = document.getElementById("clearMe");

if (setAsMeBtn) {
  setAsMeBtn.addEventListener("click", async () => {
    const ownerStr = (document.getElementById("ownerAddr")?.value || "").trim();
    if (!ownerStr) return;
    yieldCtx.setActiveOwner(ownerStr);
    await yieldCtx.refresh({ force: true });
    setActiveMePill();
  });
}

if (clearMeBtn) {
  clearMeBtn.addEventListener("click", () => {
    yieldCtx.clearActiveOwner();
    setActiveMePill();
  });
}

// ----------------------------
// Global ProcessFish watcher
// ----------------------------

function addProcessFeedRow({
  signature,
  err,
  playerStr,
  netStr,
  grossStr,
  feeStr,
  myYieldStr,
}) {
  const ul = document.getElementById("processedFeed");
  if (!ul) return;
  const li = document.createElement("li");
  const t = new Date().toLocaleTimeString();
  const sigShort = `${signature.slice(0, 8)}…`;
  const base = `${netStr} net (${grossStr} gross, fee ${feeStr}) → ${shortAddr(playerStr)} · ${sigShort} @ ${t}`;
  const mine = myYieldStr ? `  |  me +${myYieldStr}` : "";
  li.textContent = base + mine + (err ? ` (err)` : "");
  ul.prepend(li);
  while (ul.children.length > 25) ul.removeChild(ul.lastChild);
}

async function startProcessFishWatcher() {
  if (processWatcher.isLive) return; // already live

  const feed = document.getElementById("processedFeed");
  if (feed && feed.childElementCount === 0) {
    // keep existing feed if user toggles off/on, but start with clean slate on first boot
    feed.innerHTML = "";
  }

  setProcStatus("listening (process_fish)…");

  await processWatcher.start({
    onEvent: async (evt) => {
      const { signature } = evt;

      // If we couldn't decode details (pruned tx, etc), still log the detection.
      if (!evt.decoded) {
        addProcessFeedRow({
          signature,
          err: null,
          playerStr: "—",
          netStr: "—",
          grossStr: "—",
          feeStr: "—",
          myYieldStr: "",
        });
        setProcStatus("seen ✓");
        return;
      }

      const playerStr = evt.owner || "—";
      const netStr = formatTokenAmount(evt.netRaw, evt.decimals, { maxFrac: 6 });
      const grossStr = formatTokenAmount(evt.grossRaw, evt.decimals, { maxFrac: 6 });
      const feeStr = formatTokenAmount(evt.feeRaw, evt.decimals, { maxFrac: 6 });

      let myYieldStr = "";
      try {
        await yieldCtx.refresh();
        const myYieldRaw = yieldCtx.computeYieldFromFeeRaw(evt.feeRaw);
        if (myYieldRaw != null) {
          myYieldStr = formatTokenAmount(myYieldRaw, evt.decimals, { maxFrac: 6 });
        }
      } catch {}

      addProcessFeedRow({
        signature,
        err: null,
        playerStr,
        netStr,
        grossStr,
        feeStr,
        myYieldStr,
      });
      setProcStatus("seen ✓");
    },
  });
}

async function stopProcessFishWatcher() {
  await processWatcher.stop();
  setProcStatus("paused");
}

// Auto-start on page load (global-only) and wire toggle
const procToggle = document.getElementById("procLiveToggle");
if (procToggle) {
  // Start immediately if checked
  if (procToggle.checked) startProcessFishWatcher();
  else setProcStatus("paused");

  procToggle.addEventListener("change", async () => {
    if (procToggle.checked) await startProcessFishWatcher();
    else await stopProcessFishWatcher();
  });
} else {
  // Fallback: start anyway
  startProcessFishWatcher();
}

// ----------------------------
// Player Scanner (dedicated card)
// ----------------------------

function setScanStatus(s) {
  const el = document.getElementById("scanStatus");
  if (el) el.textContent = s;
}

function setScanBarPct(pct) {
  const el = document.getElementById("scanBar");
  if (!el) return;
  const p = Math.max(0, Math.min(100, Number(pct) || 0));
  el.style.width = `${p}%`;
}

function setScanCount(s) {
  const el = document.getElementById("scanCount");
  if (el) el.textContent = s;
}

async function scanPlayersOnce() {
  const topUl = document.getElementById("scanTop");
  if (topUl) topUl.innerHTML = "";

  setScanStatus("scanning…");
  setScanCount("—");
  setScanBarPct(4);

  // Animate the bar while the RPC call runs
  let alive = true;
  let pct = 4;
  const t = setInterval(() => {
    if (!alive) return;
    pct = Math.min(92, pct + (pct < 65 ? 6 : 2));
    setScanBarPct(pct);
  }, 220);

  try {
    const discB58 = bs58.encode(DISC_PLAYER);
    const accounts = await procConn.getProgramAccounts(FOGO_FISHING_PROGRAM_ID, {
      commitment: "confirmed",
      filters: [{ memcmp: { offset: 0, bytes: discB58 } }],
    });

    // Optional: fetch global so we can show % of total unprocessed
    let global = null;
    try {
      global = await fetchGlobalState({ connection: procConn });
    } catch {}

    const rows = [];
    for (const a of accounts) {
      try {
        rows.push(decodePlayerState(a.account.data));
      } catch {
        // ignore decode failures
      }
    }

    rows.sort((a, b) => {
      const aa = a?.unprocessedFish ?? 0n;
      const bb = b?.unprocessedFish ?? 0n;
      return bb > aa ? 1 : bb < aa ? -1 : 0;
    });

    setScanCount(`${rows.length.toLocaleString()} players`);

    const totalUp = global?.totalUnprocessedFish ?? null;
    const top = rows.slice(0, 10);

    if (topUl) {
      for (const p of top) {
        const owner = p?.owner?.toBase58?.() || "—";
        const up = p?.unprocessedFish ?? 0n;
        const upStr = formatFishFromRaw(up, { maxFrac: 6 });
        const pctStr = totalUp != null ? ` (${formatPercentOf(up, totalUp, { dp: 4 })})` : "";
        const li = document.createElement("li");
        li.innerHTML = `<b>${shortAddr(owner)}</b> · unproc ${upStr}${pctStr}`;
        topUl.appendChild(li);
      }
    }

    setScanStatus("done ✓");
    setScanBarPct(100);
  } catch (err) {
    console.error("scanPlayersOnce failed", err);
    setScanStatus("error");
    setScanBarPct(100);
    setScanCount("scan failed (see console)");
  } finally {
    alive = false;
    clearInterval(t);
  }
}

const scanBtn = document.getElementById("scanPlayers");
if (scanBtn) {
  scanBtn.addEventListener("click", () => {
    scanPlayersOnce();
  });
}

let unsubscribeFishCaught = null;

const btn = document.getElementById("syncChain");
if (btn) {
  btn.addEventListener("click", async () => {
    try {
      const { els, recalc } = requireGlobals();

      setStatus("loading…");

      const ownerStr = (document.getElementById("ownerAddr")?.value || "").trim();
      const ownerPubkey = ownerStr ? new PublicKey(ownerStr) : null;

      const { difficulty, rodLevel, connection, player, global: globalState } = await loadChainState({
        ownerPubkey,
      });

      // Enable/disable "Set as me" based on whether we successfully loaded a player
      if (setAsMeBtn) setAsMeBtn.disabled = !player || !ownerStr;

      // push values into your existing sliders
      if (Number.isFinite(difficulty)) {
        els.diffNum.value = String(difficulty);
        els.diffRange.value = String(difficulty);
      }
      if (Number.isFinite(rodLevel)) {
        els.levelNum.value = String(rodLevel);
        els.levelRange.value = String(rodLevel);
      }

      recalc();
      setStatus("synced ✓");

      // Render on-chain snapshot
      setSnapshotHTML(`
        <div style="display:grid; grid-template-columns: 160px 1fr; gap: 6px 12px;">
          <div style="opacity:0.7;">Difficulty</div><div>${fmtBig(globalState.currentDifficulty)}</div>
          <div style="opacity:0.7;">Total network power</div><div>${fmtBig(globalState.totalNetworkPower)}</div>
          <div style="opacity:0.7;">Total fish minted</div><div>${formatFishFromRaw(globalState.totalFishMinted, { maxFrac: 6 })}</div>
          <div style="opacity:0.7;">Total unprocessed fish</div><div>${formatFishFromRaw(globalState.totalUnprocessedFish, { maxFrac: 6 })}</div>
          <div style="opacity:0.7;">Daily target emission</div><div>${formatFishFromRaw(globalState.dailyTargetEmission, { maxFrac: 6 })}</div>
          <div style="opacity:0.7;">Last difficulty adj</div><div>${fmtTimeFromI64(globalState.lastDifficultyAdjustment)}</div>
        </div>

        <hr style="border:none; border-top:1px solid rgba(148,163,184,0.2); margin: 10px 0;" />

        ${
          player
            ? `
              <div style="font-weight:700; margin-bottom:6px;">Player</div>
              <div style="display:grid; grid-template-columns: 160px 1fr; gap: 6px 12px;">
                <div style="opacity:0.7;">Owner</div><div style="word-break: break-all;">${player.owner.toBase58()}</div>
                <div style="opacity:0.7;">Rod level</div><div>${player.rodLevel}</div>
                <div style="opacity:0.7;">Boat tier</div><div>${player.boatTier}</div>
                <div style="opacity:0.7;">Casts</div><div>${fmtBig(player.castCount)}</div>
                <div style="opacity:0.7;">Power</div><div>${fmtBig(player.power)}</div>
                <div style="opacity:0.7;">Durability</div><div>${player.currentDurability}/${player.maxDurability}</div>
                <div style="opacity:0.7;">Unprocessed fish</div>
                <div>
                  ${formatFishFromRaw(player.unprocessedFish, { maxFrac: 6 })}
                  <span style="opacity:0.7;"> (${formatPercentOf(player.unprocessedFish, globalState.totalUnprocessedFish, { dp: 4 })})</span>
                </div>
                <div style="opacity:0.7;">Supercast remaining</div><div>${player.supercastRemainingCasts}</div>
                <div style="opacity:0.7;">Upgrade in progress</div><div>${player.upgradeInProgress ? "yes" : "no"}</div>
                <div style="opacity:0.7;">Honeypot</div><div>${player.isHoneypot ? "yes 🐝" : "no"}</div>
              </div>
            `
            : `
              <div style="opacity:0.7;">No PlayerState found for that owner (you may not have fished yet, or you’re on a different cluster).</div>
            `
        }
      `);

      // If the loaded owner is the active "me", refresh the yield context from these fresh reads
      {
        const { activeOwner } = yieldCtx.getState();
        if (activeOwner && ownerStr && activeOwner === ownerStr) {
          await yieldCtx.refresh({ force: true });
          setActiveMePill();
        }
      }

// Start event stream after first successful sync
      if (unsubscribeFishCaught) await unsubscribeFishCaught();
      unsubscribeFishCaught = subscribeFishCaught({
        connection,
        onEvent: (evt, sig) => {
          console.log("FishCaught", sig, {
            evt: evt?.evt,
            player: evt.player.toBase58(),
            amount: evt.amount.toString(),
            castCount: evt.castCount.toString(),
            timestamp: evt.timestamp.toString(),
          });
        },
      });
    } catch (err) {
      console.error(err);
      setStatus("error");
      alert("Failed to load chain state (see console)");
    }
  });
}
