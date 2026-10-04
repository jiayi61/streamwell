// README screenshots (viewport-sized). Usage: node scripts/screenshots.mjs
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/npm-tools/node_modules/playwright')); }
const root = resolve(new URL('..', import.meta.url).pathname);
const out = join(root, 'docs', 'img');
await mkdir(out, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const server = createServer(async (req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  try { const body = await readFile(join(root, p === '/' ? 'index.html' : p)); res.writeHead(200, { 'Content-Type': types[extname(p)] || 'text/html' }); res.end(body); } catch { res.writeHead(404); res.end(); }
}).listen(0);
const base = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 820 }, deviceScaleFactor: 1.5 });
await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
const p = await ctx.newPage();
const shot = async (name, clip) => { await p.screenshot({ path: join(out, `${name}.png`), ...(clip ? { clip } : {}) }); console.log('saved', name); };
const click = async (t) => { await p.getByRole('button', { name: t }).first().click(); await p.waitForTimeout(250); };

await p.goto(base, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(4000); await shot('home');
await p.goto(`${base}#/city`); await p.waitForTimeout(1800); await p.evaluate(() => window.scrollTo(0, 560)); await p.waitForTimeout(400); await shot('city');
await p.goto(`${base}#/fhir`); await p.waitForTimeout(1200); await p.evaluate(() => window.scrollTo(0, 300)); await p.waitForTimeout(300); await shot('fhir');
await p.goto(`${base}#/me`); await p.waitForTimeout(1200); await p.evaluate(() => window.scrollTo(0, 700)); await p.waitForTimeout(300); await shot('journal');
await p.goto(`${base}#/visit`); await p.waitForTimeout(800);
await click('Example answers'); await click('Start the visit'); await click('Example answers'); await click('Start the stream check');
await p.waitForTimeout(300); await shot('visit-step');
for (let i = 0; i < 6; i += 1) { await click('Example answers'); await click(i < 5 ? 'Next' : 'Second look'); }
await p.waitForTimeout(500); await shot('second-look');
const keep = p.getByRole('button', { name: 'Keep my answer' });
for (let k = 0; k < await keep.count(); k += 1) { await keep.nth(k).click(); await p.waitForTimeout(150); }
await click('Check out'); await click('Example answers'); await click('See my result'); await p.waitForTimeout(400);
await shot('visit-result');
await browser.close();
server.close();
