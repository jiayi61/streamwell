// Tiny DOM helpers: h() builds elements, plus formatting and a toast.

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v;
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, String(v));
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

/** Parse a trusted SVG/HTML string (icons, charts we generate) into a node. */
export function svg(markup) {
  const t = document.createElement('template');
  t.innerHTML = markup.trim();
  return t.content.firstElementChild;
}

export function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }

export function toast(text, ms = 2600) {
  const t = h('div', { class: 'toast', role: 'status' }, text);
  document.body.append(t);
  setTimeout(() => t.remove(), ms);
}

export const fmt = {
  num: (x, d = 0) => (x === null || x === undefined || Number.isNaN(x) ? '—' : Number(x).toLocaleString('en-GB', { minimumFractionDigits: d, maximumFractionDigits: d })),
  signed: (x, d = 2) => (x === null || x === undefined || Number.isNaN(x) ? '—' : `${x > 0 ? '+' : x < 0 ? '−' : '±'}${Math.abs(x).toFixed(d)}`),
  pct: (x) => (x === null || x === undefined || Number.isNaN(x) ? '—' : `${Math.round(x * 100)}%`),
  date: (s) => (s ? new Date(`${s.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'),
  shortDate: (s) => (s ? new Date(`${s.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'),
};

export function bandBadge(band) {
  if (!band) return h('span', { class: 'badge neutral' }, 'No data');
  const cls = { GOOD: 'good', MODERATE: 'moderate', POOR: 'poor' }[band];
  const label = { GOOD: 'Good', MODERATE: 'Moderate', POOR: 'Poor' }[band];
  return h('span', { class: `badge ${cls}` }, label);
}

export const BAND_COLOR = { GOOD: 'var(--good)', MODERATE: 'var(--moderate)', POOR: 'var(--poor)' };
export const LEVEL_COLOR = ['var(--good)', 'var(--moderate)', 'var(--poor)'];

export function download(filename, data, type = 'application/fhir+json') {
  const blob = new Blob([typeof data === 'string' ? data : JSON.stringify(data, null, 2)], { type });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: filename });
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 500);
}

/** Pretty-print JSON with light syntax colouring (escaped, safe). */
export function jsonBlock(obj) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const json = esc(JSON.stringify(obj, null, 2));
  const html = json.replace(/("(?:\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g, (m) => {
    let cls = 'n';
    if (/^"/.test(m)) cls = /:$/.test(m) ? 'k' : 's';
    else if (/true|false|null/.test(m)) cls = 'b';
    return `<span class="${cls}">${m}</span>`;
  });
  const pre = h('pre', { class: 'code', tabindex: '0' });
  pre.innerHTML = html;
  return pre;
}
