// Small, dependency-free statistics used by the dashboard and the personal
// insights. Everything runs in the browser on the visit records.

/** Seeded PRNG (mulberry32) so bootstrap results are reproducible. */
export function rng(seed = 42) {
  let t = seed >>> 0;
  return function next() {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export const sum = (xs) => xs.reduce((s, x) => s + x, 0);
export const mean = (xs) => (xs.length ? sum(xs) / xs.length : NaN);

export function sd(xs) {
  if (xs.length < 2) return NaN;
  const m = mean(xs);
  return Math.sqrt(sum(xs.map((x) => (x - m) ** 2)) / (xs.length - 1));
}

export function quantile(xs, q) {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

export function median(xs) { return quantile(xs, 0.5); }

/** Average ranks (ties share the mean rank). */
export function ranks(xs) {
  const idx = xs.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]);
  const r = new Array(xs.length);
  let i = 0;
  while (i < idx.length) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j += 1;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k += 1) r[idx[k][1]] = avg;
    i = j + 1;
  }
  return r;
}

export function pearson(xs, ys) {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return NaN;
  const mx = mean(xs);
  const my = mean(ys);
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i += 1) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : NaN;
}

export function spearman(xs, ys) { return pearson(ranks(xs), ranks(ys)); }

/** Percentile bootstrap CI for a statistic over paired samples. */
export function bootstrapCI(n, statFn, { reps = 1000, seed = 7, alpha = 0.05 } = {}) {
  const r = rng(seed);
  const out = [];
  for (let b = 0; b < reps; b += 1) {
    const idx = Array.from({ length: n }, () => Math.floor(r() * n));
    const v = statFn(idx);
    if (Number.isFinite(v)) out.push(v);
  }
  return [quantile(out, alpha / 2), quantile(out, 1 - alpha / 2)];
}

/** Difference in means with a Welch 95% CI (normal approximation for df > 30, t otherwise). */
export function meanDiff(a, b) {
  if (a.length < 2 || b.length < 2) return null;
  const d = mean(a) - mean(b);
  const se = Math.sqrt(sd(a) ** 2 / a.length + sd(b) ** 2 / b.length);
  const df = (sd(a) ** 2 / a.length + sd(b) ** 2 / b.length) ** 2 /
    ((sd(a) ** 4) / (a.length ** 2 * (a.length - 1)) + (sd(b) ** 4) / (b.length ** 2 * (b.length - 1)));
  const t = tCrit(df);
  return { diff: d, lo: d - t * se, hi: d + t * se, se, df, nA: a.length, nB: b.length };
}

/** Two-sided 97.5% t quantile; small table + normal limit. */
export function tCrit(df) {
  if (!Number.isFinite(df) || df > 120) return 1.96;
  const table = [[1, 12.71], [2, 4.30], [3, 3.18], [4, 2.78], [5, 2.57], [6, 2.45], [7, 2.36], [8, 2.31], [9, 2.26], [10, 2.23], [12, 2.18], [15, 2.13], [20, 2.09], [25, 2.06], [30, 2.04], [40, 2.02], [60, 2.00], [120, 1.98]];
  for (let i = 0; i < table.length; i += 1) {
    if (df <= table[i][0]) {
      if (i === 0) return table[0][1];
      const [d0, t0] = table[i - 1];
      const [d1, t1] = table[i];
      return t0 + ((t1 - t0) * (df - d0)) / (d1 - d0);
    }
  }
  return 1.96;
}

/** Solve A x = b by Gaussian elimination with partial pivoting. */
export function solve(A, b) {
  const n = A.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c += 1) {
    let p = c;
    for (let r = c + 1; r < n; r += 1) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-12) return null;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = c + 1; r < n; r += 1) {
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k += 1) M[r][k] -= f * M[c][k];
    }
  }
  const x = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r -= 1) {
    let s = M[r][n];
    for (let k = r + 1; k < n; k += 1) s -= M[r][k] * x[k];
    x[r] = s / M[r][r];
  }
  return x;
}

/** Ordinary least squares with an intercept; small ridge for stability. */
export function ols(X, y, ridge = 1e-6) {
  const n = X.length;
  const p = X[0].length + 1;
  const XtX = Array.from({ length: p }, () => new Array(p).fill(0));
  const Xty = new Array(p).fill(0);
  for (let i = 0; i < n; i += 1) {
    const row = [1, ...X[i]];
    for (let a = 0; a < p; a += 1) {
      Xty[a] += row[a] * y[i];
      for (let b = 0; b < p; b += 1) XtX[a][b] += row[a] * row[b];
    }
  }
  for (let a = 1; a < p; a += 1) XtX[a][a] += ridge;
  return solve(XtX, Xty);
}

/**
 * OLS coefficients with a cluster bootstrap (resample whole clusters, e.g.
 * volunteers, so repeated visits by the same person are not treated as
 * independent).
 */
export function olsClusterBootstrap(X, y, clusters, { reps = 200, seed = 11, ridge = 1e-6 } = {}) {
  const p = X[0].length + 1;
  // Sufficient statistics per cluster, so each bootstrap draw only adds
  // small matrices instead of re-reading every visit.
  const stats = new Map();
  for (let i = 0; i < X.length; i += 1) {
    const c = clusters[i];
    if (!stats.has(c)) stats.set(c, { xtx: new Float64Array(p * p), xty: new Float64Array(p) });
    const s = stats.get(c);
    const row = [1, ...X[i]];
    for (let a = 0; a < p; a += 1) {
      s.xty[a] += row[a] * y[i];
      for (let b = 0; b < p; b += 1) s.xtx[a * p + b] += row[a] * row[b];
    }
  }
  const groups = [...stats.values()];
  const fit = (pickGroup) => {
    const xtx = new Float64Array(p * p);
    const xty = new Float64Array(p);
    for (let k = 0; k < groups.length; k += 1) {
      const g = pickGroup(k);
      for (let a = 0; a < p * p; a += 1) xtx[a] += g.xtx[a];
      for (let a = 0; a < p; a += 1) xty[a] += g.xty[a];
    }
    const A = Array.from({ length: p }, (_, a) => Array.from({ length: p }, (__, b) => xtx[a * p + b] + (a === b && a > 0 ? ridge : 0)));
    return solve(A, Array.from(xty));
  };
  const beta = fit((k) => groups[k]);
  const r = rng(seed);
  const draws = [];
  for (let b = 0; b < reps; b += 1) {
    const bb = fit(() => groups[Math.floor(r() * groups.length)]);
    if (bb) draws.push(bb);
  }
  const ci = beta.map((_, j) => [quantile(draws.map((d) => d[j]), 0.025), quantile(draws.map((d) => d[j]), 0.975)]);
  return { beta, ci, reps: draws.length };
}

export function round(x, d = 2) {
  if (x === null || x === undefined || !Number.isFinite(x)) return null;
  const f = 10 ** d;
  return Math.round(x * f) / f;
}
