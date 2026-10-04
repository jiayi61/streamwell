// Small SVG charts drawn from data (no chart library). Each returns markup.

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const lin = (d0, d1, r0, r1) => (v) => r0 + ((v - d0) / (d1 - d0 || 1)) * (r1 - r0);
const nice = (x) => Math.round(x * 100) / 100;

/** Round-number ticks inside [min, max] (steps of 1, 2, 2.5 or 5 x 10^k). */
export function ticks(min, max, n = 5) {
  const span = max - min || 1;
  const raw = span / Math.max(1, n - 1);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((st) => st >= raw) || 10 * mag;
  const out = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step) out.push(nice(v));
  return out;
}

/** Scatter with optional least-squares line. points: [{x, y, r?, color?, title?}] */
export function scatter({ points, xLabel, yLabel, xDomain, yDomain, width = 560, height = 320, fit = true }) {
  const m = { l: 48, r: 14, t: 12, b: 42 };
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const [x0, x1] = xDomain || [Math.min(...xs), Math.max(...xs)];
  const [y0, y1] = yDomain || [Math.min(...ys), Math.max(...ys)];
  const X = lin(x0, x1, m.l, width - m.r);
  const Y = lin(y0, y1, height - m.b, m.t);
  let out = `<svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(`${yLabel} against ${xLabel}`)}">`;
  for (const t of ticks(y0, y1)) out += `<line class="grid-line" x1="${m.l}" x2="${width - m.r}" y1="${Y(t)}" y2="${Y(t)}"/><text x="${m.l - 6}" y="${Y(t) + 4}" text-anchor="end">${t}</text>`;
  for (const t of ticks(x0, x1)) out += `<text x="${X(t)}" y="${height - m.b + 16}" text-anchor="middle">${t}</text>`;
  if (y0 < 0 && y1 > 0) out += `<line class="zero" x1="${m.l}" x2="${width - m.r}" y1="${Y(0)}" y2="${Y(0)}"/>`;
  out += `<line class="axis" x1="${m.l}" x2="${width - m.r}" y1="${height - m.b}" y2="${height - m.b}"/>`;
  if (fit && points.length > 2) {
    const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
    const my = ys.reduce((a, b) => a + b, 0) / ys.length;
    const b = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) / (xs.reduce((s, x) => s + (x - mx) ** 2, 0) || 1);
    const a = my - b * mx;
    out += `<line x1="${X(x0)}" y1="${Y(a + b * x0)}" x2="${X(x1)}" y2="${Y(a + b * x1)}" stroke="var(--brand)" stroke-width="2" stroke-dasharray="6 4" opacity="0.8"/>`;
  }
  for (const p of points) {
    out += `<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="${p.r || 5}" fill="${p.color || 'var(--brand)'}" fill-opacity="0.75" stroke="var(--surface)" stroke-width="1"><title>${esc(p.title || '')}</title></circle>`;
  }
  out += `<text x="${(m.l + width - m.r) / 2}" y="${height - 6}" text-anchor="middle">${esc(xLabel)}</text>`;
  out += `<text transform="translate(12 ${(m.t + height - m.b) / 2}) rotate(-90)" text-anchor="middle">${esc(yLabel)}</text>`;
  return `${out}</svg>`;
}

/** Forest plot: rows [{label, effect, lo, hi, emphasis?}] */
export function forest({ rows, xLabel = 'Effect', width = 560, rowH = 26 }) {
  const m = { l: 170, r: 56, t: 10, b: 36 };
  const height = m.t + m.b + rows.length * rowH;
  const lo = Math.min(-0.1, ...rows.map((r) => r.lo));
  const hi = Math.max(0.1, ...rows.map((r) => r.hi));
  const pad = (hi - lo) * 0.08;
  const X = lin(lo - pad, hi + pad, m.l, width - m.r);
  let out = `<svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(xLabel)} with 95% intervals">`;
  out += `<line class="zero" x1="${X(0)}" x2="${X(0)}" y1="${m.t}" y2="${height - m.b}"/>`;
  for (const t of ticks(lo - pad, hi + pad, 5)) out += `<text x="${X(t)}" y="${height - m.b + 16}" text-anchor="middle">${t > 0 ? '+' : ''}${t.toFixed(1)}</text>`;
  rows.forEach((r, i) => {
    const y = m.t + i * rowH + rowH / 2;
    const color = r.lo > 0 ? 'var(--good)' : r.hi < 0 ? 'var(--poor)' : 'var(--muted)';
    out += `<text x="${m.l - 10}" y="${y + 4}" text-anchor="end" style="font-size:12px;${r.emphasis ? 'font-weight:700;fill:var(--text)' : ''}">${esc(r.label)}</text>`;
    out += `<line x1="${X(r.lo)}" x2="${X(r.hi)}" y1="${y}" y2="${y}" stroke="${color}" stroke-width="3" stroke-linecap="round"/>`;
    out += `<circle cx="${X(r.effect)}" cy="${y}" r="5.5" fill="${color}" stroke="var(--surface)" stroke-width="1.5"><title>${esc(`${r.label}: ${r.effect} [${r.lo}, ${r.hi}]`)}</title></circle>`;
    out += `<text x="${width - m.r + 6}" y="${y + 4}" style="font-size:11px">${r.effect > 0 ? '+' : ''}${r.effect.toFixed(2)}</text>`;
  });
  out += `<text x="${(m.l + width - m.r) / 2}" y="${height - 6}" text-anchor="middle">${esc(xLabel)}</text>`;
  return `${out}</svg>`;
}

/** Before -> after per feeling. rows [{label, before, after, better}] on a 1..5 scale. */
export function dumbbell({ rows, width = 300, rowH = 34 }) {
  const m = { l: 74, r: 14, t: 10, b: 28 };
  const height = m.t + m.b + rows.length * rowH;
  const X = lin(1, 5, m.l, width - m.r);
  let out = `<svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Feelings before and after the visit">`;
  for (let v = 1; v <= 5; v += 1) out += `<line class="grid-line" x1="${X(v)}" x2="${X(v)}" y1="${m.t}" y2="${height - m.b}"/><text x="${X(v)}" y="${height - m.b + 16}" text-anchor="middle">${v}</text>`;
  rows.forEach((r, i) => {
    const y = m.t + i * rowH + rowH / 2;
    const color = r.better > 0 ? 'var(--good)' : r.better < 0 ? 'var(--poor)' : 'var(--muted)';
    out += `<text x="${m.l - 10}" y="${y + 4}" text-anchor="end" style="font-size:13px">${esc(r.label)}</text>`;
    out += `<line x1="${X(r.before)}" x2="${X(r.after)}" y1="${y}" y2="${y}" stroke="${color}" stroke-width="4" stroke-linecap="round"/>`;
    out += `<circle cx="${X(r.before)}" cy="${y}" r="6" fill="var(--surface)" stroke="var(--muted)" stroke-width="2"><title>Before: ${r.before}</title></circle>`;
    out += `<circle cx="${X(r.after)}" cy="${y}" r="7" fill="${color}"><title>After: ${r.after}</title></circle>`;
  });
  return `${out}</svg>`;
}

/** Vertical bars over time around zero. items [{label, value, color?, title?}] */
export function timeline({ items, width = 560, height = 180, yDomain = [-1.5, 2] }) {
  const m = { l: 36, r: 8, t: 10, b: 26 };
  const n = Math.max(items.length, 1);
  const bw = Math.min(28, ((width - m.l - m.r) / n) * 0.7);
  const X = (i) => m.l + ((i + 0.5) / n) * (width - m.l - m.r);
  const Y = lin(yDomain[0], yDomain[1], height - m.b, m.t);
  let out = `<svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Restoration per visit">`;
  for (const t of [yDomain[0], 0, 1, yDomain[1]]) out += `<line class="${t === 0 ? 'zero' : 'grid-line'}" x1="${m.l}" x2="${width - m.r}" y1="${Y(t)}" y2="${Y(t)}"/><text x="${m.l - 6}" y="${Y(t) + 4}" text-anchor="end">${t > 0 ? '+' : ''}${t}</text>`;
  items.forEach((it, i) => {
    const v = Math.max(yDomain[0], Math.min(yDomain[1], it.value));
    const y = Math.min(Y(0), Y(v));
    const hgt = Math.max(2, Math.abs(Y(v) - Y(0)));
    out += `<rect x="${X(i) - bw / 2}" y="${y}" width="${bw}" height="${hgt}" rx="3" fill="${it.color || 'var(--brand)'}"><title>${esc(it.title || '')}</title></rect>`;
    if (items.length <= 16 || i % Math.ceil(items.length / 12) === 0) out += `<text x="${X(i)}" y="${height - 8}" text-anchor="middle">${esc(it.label)}</text>`;
  });
  return `${out}</svg>`;
}

/** Horizontal share bars: rows [{label, value (0..1), color?}] */
export function shareBars({ rows, width = 420, rowH = 24 }) {
  const m = { l: 130, r: 46, t: 4, b: 4 };
  const height = m.t + m.b + rows.length * rowH;
  const X = lin(0, 1, m.l, width - m.r);
  let out = `<svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Shares">`;
  rows.forEach((r, i) => {
    const y = m.t + i * rowH;
    out += `<text x="${m.l - 8}" y="${y + rowH / 2 + 4}" text-anchor="end" style="font-size:12px">${esc(r.label)}</text>`;
    out += `<rect x="${m.l}" y="${y + 5}" width="${X(1) - m.l}" height="${rowH - 10}" rx="4" fill="var(--surface-2)"/>`;
    out += `<rect x="${m.l}" y="${y + 5}" width="${Math.max(2, X(r.value) - m.l)}" height="${rowH - 10}" rx="4" fill="${r.color || 'var(--brand)'}"/>`;
    out += `<text x="${X(1) + 6}" y="${y + rowH / 2 + 4}">${Math.round(r.value * 100)}%</text>`;
  });
  return `${out}</svg>`;
}
