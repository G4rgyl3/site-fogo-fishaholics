// calc-ui.js
// UI wiring for the Fish Per Cast calculator (sliders/inputs + mini chart).
//
// Dependencies:
//   - fish.js must be loaded first and provide globally:
//       rodPower(level)
//       calculateCatchChance(level)
//       calculateExpectedFishPerCast(level, difficulty)
//
// Exposes:
//   - window.els
//   - window.recalc()

function clampInt(n, lo, hi) {
  n = Number(n);
  if (!Number.isFinite(n)) n = lo;
  n = Math.trunc(n);
  return Math.max(lo, Math.min(hi, n));
}

function comma(x) {
  try {
    return Number(x).toLocaleString(undefined, { maximumFractionDigits: 0 });
  } catch {
    return String(x);
  }
}

function fmtFloat(x, dp = 4) {
  if (!Number.isFinite(x)) return "—";
  return x.toLocaleString(undefined, { maximumFractionDigits: dp });
}


(function () {
  'use strict';

  const els = {
    levelNum: document.getElementById('levelNum'),
    levelRange: document.getElementById('levelRange'),
    diffNum: document.getElementById('diffNum'),
    diffRange: document.getElementById('diffRange'),
    rodPowerOut: document.getElementById('rodPowerOut'),
    catchChanceOut: document.getElementById('catchChanceOut'),
    fishPerCastOut: document.getElementById('fishPerCastOut'),
    chart: document.getElementById('chart'),
    chartMeta: document.getElementById('chartMeta'),

    // Durability inputs
    durCurNum: document.getElementById("durCurNum"),
    durCurRange: document.getElementById("durCurRange"),
    durMaxNum: document.getElementById("durMaxNum"),
    durMaxRange: document.getElementById("durMaxRange"),

    // Durability outputs
    durCurHint: document.getElementById("durCurHint"),
    durMaxHint: document.getElementById("durMaxHint"),
    durRegenOut: document.getElementById("durRegenOut"),
    castsBestOut: document.getElementById("castsBestOut"),
    castsLowOut: document.getElementById("castsLowOut"),
    castsBefore20Out: document.getElementById("castsBefore20Out"),
    casts24BestOut: document.getElementById("casts24BestOut"),
    casts24LowOut: document.getElementById("casts24LowOut"),
    fishDayBestOut: document.getElementById("fishDayBestOut"),
    fishDayLowOut: document.getElementById("fishDayLowOut"),

  };

  function requireMath() {
    const missing = [];
    if (typeof window.rodPower !== 'function') missing.push('rodPower');
    if (typeof window.calculateCatchChance !== 'function') missing.push('calculateCatchChance');
    if (typeof window.calculateExpectedFishPerCast !== 'function') missing.push('calculateExpectedFishPerCast');
    if (missing.length) {
      throw new Error(`calc-ui.js missing fish.js dependency(s): ${missing.join(', ')}`);
    }
  }

  function clamp(n, min, max) {
    n = Number.isFinite(n) ? n : min;
    return Math.min(Math.max(n, min), max);
  }

  function syncPair(from, to) {
    to.value = from.value;
  }

  function formatPercent(p) {
    return (p * 100).toFixed(2) + '%';
  }

  function formatInt(n) {
    if (!Number.isFinite(n)) return '—';
    return Math.trunc(n).toLocaleString();
  }

  function formatFish(x) {
    if (!Number.isFinite(x)) return '—';
    if (x === 0) return '0';
    if (Math.abs(x) < 1e-6) return x.toExponential(2);
    const s = x.toFixed(6);
    const [w, f] = s.split('.');
    const ww = w.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return f ? `${ww}.${f}` : ww;
  }

  // --- Chart drawing (vanilla canvas) ---
  function drawChart(level, difficulty) {
    const canvas = els.chart;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;

    const maxLevel = Number(els.levelRange?.max || 60);
    const points = [];
    let maxY = 0;

    for (let lvl = 1; lvl <= maxLevel; lvl++) {
      const y = window.calculateExpectedFishPerCast(lvl, difficulty);
      points.push({ x: lvl, y });
      if (Number.isFinite(y)) maxY = Math.max(maxY, y);
    }

    if (maxY <= 0) maxY = 1;
    const yPad = maxY * 0.15;
    const yMax = maxY + yPad;

    const padL = 44, padR = 16, padT = 14, padB = 34;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;

    const xMin = 1, xMax = maxLevel;
    const xToPx = (x) => padL + ((x - xMin) / (xMax - xMin)) * plotW;
    const yToPx = (y) => padT + (1 - (y / yMax)) * plotH;

    ctx.clearRect(0, 0, W, H);

    // Gridlines
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = 'rgba(148,163,184,0.35)';
    ctx.lineWidth = 1;

    const yTicks = 4;
    for (let i = 0; i <= yTicks; i++) {
      const yy = padT + (i / yTicks) * plotH;
      ctx.beginPath();
      ctx.moveTo(padL, yy);
      ctx.lineTo(W - padR, yy);
      ctx.stroke();
    }

    const xTicks = 6;
    for (let i = 0; i <= xTicks; i++) {
      const xx = padL + (i / xTicks) * plotW;
      ctx.beginPath();
      ctx.moveTo(xx, padT);
      ctx.lineTo(xx, H - padB);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Axes labels
    ctx.fillStyle = 'rgba(148,163,184,0.9)';
    ctx.font = '16px system-ui, -apple-system, sans-serif';
    ctx.fillText('Level', W / 2 - 18, H - 10);
    ctx.save();
    ctx.translate(14, H / 2 + 30);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('FISH/cast', 0, 0);
    ctx.restore();

    // Line
    ctx.strokeStyle = 'rgba(56,189,248,0.95)';
    ctx.lineWidth = 3;
    ctx.beginPath();

    points.forEach((pt, i) => {
      const px = xToPx(pt.x);
      const py = yToPx(pt.y);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });

    ctx.stroke();

    // Highlight current level point
    const current = points[level - 1];
    if (current) {
      const cx = xToPx(current.x);
      const cy = yToPx(current.y);

      ctx.beginPath();
      ctx.arc(cx, cy, 10, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(167,139,250,0.18)';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(167,139,250,0.95)';
      ctx.fill();
    }

    // Simple x-axis ticks
    ctx.fillStyle = 'rgba(148,163,184,0.9)';
    ctx.font = '14px system-ui, -apple-system, sans-serif';
    const tickLevels = [1, 10, 20, 30, 40, 50, maxLevel].filter((v, i, a) => a.indexOf(v) === i);
    tickLevels.forEach((lvl) => {
      const px = xToPx(lvl);
      ctx.fillText(String(lvl), px - 8, H - padB + 22);
    });
  }

  function updateDurabilityCard(els, fishPerCast) {
    // If the card isn't present, silently do nothing.
    if (!els?.durCurNum || !els?.durMaxNum) return;

    // Read + clamp
    const maxDur = clampInt(els.durMaxNum.value, 1, 20000);
    const curDur = clampInt(els.durCurNum.value, 0, maxDur);

    // Keep sliders in sync
    if (els.durMaxRange) els.durMaxRange.value = String(maxDur);
    if (els.durCurRange) {
      els.durCurRange.max = String(maxDur);
      els.durCurRange.value = String(curDur);
    }

    // UI hints
    const threshold = Math.ceil(maxDur * 0.2);
    if (els.durCurHint) els.durCurHint.textContent = `${curDur}/${maxDur}`;
    if (els.durMaxHint) els.durMaxHint.textContent = `20% = ${threshold}`;

    // Rates (your spec)
    const castsPerSecBest = 1 / 3;   // ≥20%
    const castsPerSecLow = 1 / 12;   // <20%
    const castsPerDayBest = castsPerSecBest * 86400; // 28,800
    const castsPerDayLow = castsPerSecLow * 86400;   // 7,200

    // buffer above the 20% floor
    const castsBefore20 = Math.max(0, curDur - threshold);

    // 24h throughput models (simple + intuitive)
    // - stay ≥20%: spend buffer above 20% + fast regen
    const max24Best = castsBefore20 + castsPerDayBest;

    // - let it drop <20%: spend everything you have now + slow regen
    const max24Low = curDur + castsPerDayLow;

    // Output
    if (els.durRegenOut) els.durRegenOut.textContent = `≥20%: +1/3s | <20%: +1/12s`;
    if (els.castsBestOut) els.castsBestOut.textContent = `${fmtFloat(castsPerSecBest, 4)} /s`;
    if (els.castsLowOut) els.castsLowOut.textContent = `${fmtFloat(castsPerSecLow, 4)} /s`;
    if (els.castsBefore20Out) els.castsBefore20Out.textContent = `${comma(castsBefore20)} casts`;
    if (els.casts24BestOut) els.casts24BestOut.textContent = `${comma(Math.floor(max24Best))}`;
    if (els.casts24LowOut) els.casts24LowOut.textContent = `${comma(Math.floor(max24Low))}`;

    const fishDayBest = Number.isFinite(fishPerCast) ? fishPerCast * max24Best : NaN;
    const fishDayLow = Number.isFinite(fishPerCast) ? fishPerCast * max24Low : NaN;

    if (els.fishDayBestOut) els.fishDayBestOut.textContent = fmtFloat(fishDayBest, 6);
    if (els.fishDayLowOut) els.fishDayLowOut.textContent = fmtFloat(fishDayLow, 6);
  }

  function wireDurability(els) {
    // If the durability card isn't present, do nothing.
    if (!els.durCurNum || !els.durMaxNum) return;

    // Keep current/max paired, but max affects current range's max.
    const syncCurMax = () => {
      const maxDur = clampInt(els.durMaxNum.value, 1, 20000);
      const curDur = clampInt(els.durCurNum.value, 0, maxDur);

      // clamp back
      els.durMaxNum.value = String(maxDur);
      els.durCurNum.value = String(curDur);

      if (els.durMaxRange) els.durMaxRange.value = String(maxDur);
      if (els.durCurRange) {
        els.durCurRange.max = String(maxDur);
        els.durCurRange.value = String(curDur);
      }
    };

    // Max durability controls
    if (els.durMaxRange) {
      els.durMaxRange.addEventListener("input", () => {
        els.durMaxNum.value = els.durMaxRange.value;
        syncCurMax();
        recalc();
      });
    }
    els.durMaxNum.addEventListener("input", () => {
      syncCurMax();
      if (els.durMaxRange) els.durMaxRange.value = els.durMaxNum.value;
      recalc();
    });
    els.durMaxNum.addEventListener("change", () => {
      syncCurMax();
      recalc();
    });

    // Current durability controls
    if (els.durCurRange) {
      els.durCurRange.addEventListener("input", () => {
        els.durCurNum.value = els.durCurRange.value;
        syncCurMax();
        recalc();
      });
    }
    els.durCurNum.addEventListener("input", () => {
      syncCurMax();
      if (els.durCurRange) els.durCurRange.value = els.durCurNum.value;
      recalc();
    });
    els.durCurNum.addEventListener("change", () => {
      syncCurMax();
      recalc();
    });

    // Ensure ranges are consistent on first load
    syncCurMax();
  }

  function recalc() {
    requireMath();

    const level = clamp(parseInt(els.levelNum?.value, 10), 1, Number(els.levelRange?.max || 60));
    const difficulty = clamp(parseInt(els.diffNum?.value, 10), 1, Number(els.diffRange?.max || 1));

    // enforce clamp back into inputs
    if (els.levelNum) els.levelNum.value = level;
    if (els.levelRange) els.levelRange.value = level;
    if (els.diffNum) els.diffNum.value = difficulty;
    if (els.diffRange) els.diffRange.value = difficulty;

    const power = window.rodPower(level);
    const catchChance = window.calculateCatchChance(level);
    const fishPerCast = window.calculateExpectedFishPerCast(level, difficulty);

    if (els.rodPowerOut) els.rodPowerOut.textContent = formatInt(power);
    if (els.catchChanceOut) els.catchChanceOut.textContent = formatPercent(catchChance);
    if (els.fishPerCastOut) els.fishPerCastOut.textContent = formatFish(fishPerCast);

    if (els.chartMeta) els.chartMeta.textContent = `Difficulty: ${formatInt(difficulty)}`;
    drawChart(level, difficulty);
    updateDurabilityCard(window.els, fishPerCast);
  }

  function wirePair(rangeEl, numEl) {
    if (!rangeEl || !numEl) return;

    rangeEl.addEventListener('input', () => {
      syncPair(rangeEl, numEl);
      recalc();
    });

    numEl.addEventListener('input', () => {
      const v = parseInt(numEl.value, 10);
      if (Number.isFinite(v)) {
        numEl.value = String(v);
        syncPair(numEl, rangeEl);
        recalc();
      }
    });

    numEl.addEventListener('change', recalc);
  }

  // expose for onchain-ui.js
  window.els = els;
  window.recalc = recalc;

  wirePair(els.levelRange, els.levelNum);
  wirePair(els.diffRange, els.diffNum);
  wireDurability(els);

  // Initial draw
  recalc();
})();
