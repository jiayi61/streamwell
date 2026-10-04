// Headless smoke test: serves the app, walks every view and a full visit, and
// fails on console errors. Usage: node scripts/smoke.mjs [outDir]
// Requires Playwright (npm i -D playwright) or a global install.
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/npm-tools/node_modules/playwright')); }

const root = resolve(new URL('..', import.meta.url).pathname);
const out = process.argv[2] || join(root, 'artifacts');
await mkdir(out, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const server = createServer(async (req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = join(root, p === '/' ? 'index.html' : p);
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end('not found'); }
}).listen(0);
const base = `http://127.0.0.1:${server.address().port}/`;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const errors = [];
async function page(width = 1280, height = 900) {
  const ctx = await browser.newContext({ viewport: { width, height } });
  // External hosts (tiles, weather, HAPI) are not needed for the smoke test.
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
  const p = await ctx.newPage();
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errors.push(m.text()); });
  p.on('pageerror', (e) => errors.push(String(e)));
  return p;
}

const p = await page();
for (const [route, shot] of [['#/', 'home'], ['#/me', 'journal'], ['#/city', 'city'], ['#/fhir', 'fhir'], ['#/fhir?tab=rx', 'fhir-rx']]) {
  await p.goto(base + route, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(route === '#/' ? 4200 : 1500);
  await p.screenshot({ path: join(out, `${shot}.png`), fullPage: true });
  console.log('ok', route, await p.title());
}

// Full visit using the "Example answers" helper on every step.
await p.goto(`${base}#/visit`, { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(800);
const click = async (text) => { await p.getByRole('button', { name: text, exact: false }).first().click(); await p.waitForTimeout(250); };
await click('Example answers');
await click('Start the visit');
await click('Example answers');
await click('Start the stream check');
for (let i = 0; i < 6; i += 1) {
  await click('Example answers');
  await click(i < 5 ? 'Next' : 'Second look');
}
await p.waitForTimeout(600);
await p.screenshot({ path: join(out, 'visit-second-look.png'), fullPage: true });
// Resolve any open checks by keeping the answer.
for (let i = 0; i < 6; i += 1) {
  const keep = p.getByRole('button', { name: 'Keep my answer' });
  const n = await keep.count();
  let clicked = false;
  for (let k = 0; k < n; k += 1) {
    const pressed = await keep.nth(k).getAttribute('aria-pressed');
    if (pressed !== 'true') { await keep.nth(k).click(); await p.waitForTimeout(200); clicked = true; break; }
  }
  if (!clicked) break;
}
await click('Check out');
await click('Example answers');
await click('See my result');
await p.waitForTimeout(500);
await p.screenshot({ path: join(out, 'visit-result.png'), fullPage: true });
await click('Save to my journal');
await p.waitForTimeout(1200);
console.log('journal after save:', await p.locator('h1').first().textContent());

const m = await page(390, 844);
await m.goto(`${base}#/visit`, { waitUntil: 'domcontentloaded' });
await m.waitForTimeout(1200);
await m.screenshot({ path: join(out, 'mobile-visit.png'), fullPage: true });
const overflow = await m.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
console.log('mobile horizontal overflow px:', overflow);

await browser.close();
server.close();
if (errors.length) {
  console.error('Console errors:\n' + errors.join('\n'));
  process.exit(1);
}
console.log('smoke test passed');
