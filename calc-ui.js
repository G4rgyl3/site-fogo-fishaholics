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

  // Initial draw
  recalc();
})();
