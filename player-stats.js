// player-stats.js
// Pure helpers for computing stats from decoded PlayerState objects.
// Depends only on window.playerStore (set by your scanner) and (optionally) formatFishFromRaw.

(function () {
  "use strict";

  // --------- field access helpers (robust to naming) ---------

  function getOwnerB58(p) {
    return p?.owner?.toBase58?.() || p?.owner || null;
  }

  function getRodLevel(p) {
    // Support a few likely field names.
    const v =
      p?.rodLevel ??
      p?.rod_level ??
      p?.rod_level_id ??
      p?.rod?.level ??
      p?.rod?.lvl ??
      null;

    // Some decoders may return BigInt for u64-ish fields; coerce safely.
    if (typeof v === "bigint") return Number(v);
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function bi(x) {
    try {
      if (typeof x === "bigint") return x;
      if (typeof x === "number") return BigInt(Math.trunc(x));
      if (typeof x === "string") return BigInt(x);
    } catch {}
    return 0n;
  }

  function getUnprocessed(p) {
    return bi(p?.unprocessedFish ?? p?.unprocessed_fish ?? p?.unprocessed ?? 0n);
  }

  // --------- small stat primitives ---------

  function meanNumber(arr) {
    if (!arr.length) return null;
    let s = 0;
    for (const x of arr) s += x;
    return s / arr.length;
  }

  function medianNumber(sortedArr) {
    const n = sortedArr.length;
    if (!n) return null;
    const mid = Math.floor(n / 2);
    if (n % 2 === 1) return sortedArr[mid];
    return (sortedArr[mid - 1] + sortedArr[mid]) / 2;
  }

  function meanBigInt(arr) {
    if (!arr.length) return 0n;
    let s = 0n;
    for (const x of arr) s += bi(x);
    return s / BigInt(arr.length);
  }

  function medianBigInt(sortedArr) {
    const n = sortedArr.length;
    if (!n) return 0n;
    const mid = Math.floor(n / 2);
    if (n % 2 === 1) return sortedArr[mid];
    return (sortedArr[mid - 1] + sortedArr[mid]) / 2n;
  }

  function minBigInt(arr) {
    let m = null;
    for (const x of arr) {
      const v = bi(x);
      if (m === null || v < m) m = v;
    }
    return m ?? 0n;
  }

  function maxBigInt(arr) {
    let m = null;
    for (const x of arr) {
      const v = bi(x);
      if (m === null || v > m) m = v;
    }
    return m ?? 0n;
  }

  // --------- requested stats ---------

  function computeRodLevelStats(players) {
    const levels = [];
    const counts = Object.create(null);

    for (const p of players) {
      const lvl = getRodLevel(p);
      if (lvl == null) continue;
      levels.push(lvl);
      counts[lvl] = (counts[lvl] || 0) + 1;
    }

    levels.sort((a, b) => a - b);

    const min = levels.length ? levels[0] : null;
    const max = levels.length ? levels[levels.length - 1] : null;
    const avg = meanNumber(levels);
    const median = medianNumber(levels);

    return {
      samples: levels.length, // players where rod level was readable
      countsByLevel: counts,  // { "1": 123, "2": 456, ... }
      min,
      max,
      avg,
      median,
    };
  }

  function computeUnprocessedStats(players) {
    const ups = players.map(getUnprocessed);
    // For median we need sorted
    const upsAsc = ups.slice().sort((a, b) => (a > b ? 1 : a < b ? -1 : 0));

    const total = ups.reduce((s, v) => s + v, 0n);
    const min = minBigInt(ups);
    const max = maxBigInt(ups);
    const avg = meanBigInt(ups);
    const median = medianBigInt(upsAsc);

    return { samples: ups.length, total, min, max, avg, median };
  }

  // Single entrypoint returning exactly what you listed
  function computeCoreStats(players = null) {
    const ps =
      players ||
      (window.playerStore?.players ? window.playerStore.players : []);

    const rod = computeRodLevelStats(ps);
    const unprocessed = computeUnprocessedStats(ps);

    return {
      players: ps.length,
      rod,
      unprocessed,
      // handy: top holders (for debugging)
      top10: ps
        .slice()
        .sort((a, b) => {
          const aa = getUnprocessed(a);
          const bb = getUnprocessed(b);
          return bb > aa ? 1 : bb < aa ? -1 : 0;
        })
        .slice(0, 10)
        .map((p, i) => ({
          rank: i + 1,
          owner: getOwnerB58(p),
          rodLevel: getRodLevel(p),
          unprocessed: getUnprocessed(p),
        })),
    };
  }

  // Pretty-print helper (optional)
  function formatCoreStats(stats) {
    const fFish = (x) =>
      typeof window.formatFishFromRaw === "function"
        ? window.formatFishFromRaw(x, { maxFrac: 6 })
        : x.toString();

    // Sort rod levels numerically for display
    const rodLevels = Object.keys(stats.rod.countsByLevel)
      .map((k) => Number(k))
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => a - b);

    const rodCounts = rodLevels.map((lvl) => [lvl, stats.rod.countsByLevel[lvl]]);

    return {
      players: stats.players,
      rod: {
        samples: stats.rod.samples,
        min: stats.rod.min,
        max: stats.rod.max,
        avg: stats.rod.avg,
        median: stats.rod.median,
        countsByLevel: rodCounts, // array of [level, count] for easy UI
      },
      unprocessed: {
        samples: stats.unprocessed.samples,
        total: fFish(stats.unprocessed.total),
        min: fFish(stats.unprocessed.min),
        max: fFish(stats.unprocessed.max),
        avg: fFish(stats.unprocessed.avg),
        median: fFish(stats.unprocessed.median),
      },
    };
  }

  // Expose
  window.computeCoreStats = computeCoreStats;
  window.formatCoreStats = formatCoreStats;
})();
