// Records a captioned walkthrough video of StreamWell (backup demo video).
// Usage: node scripts/record-demo.mjs [outDir]   (needs Playwright + ffmpeg)
// The app is served locally; external requests (map tiles, weather) are
// blocked, so the map shows site markers without a basemap.
import { createServer } from 'node:http';
import { readFile, mkdir, readdir, rename } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/npm-tools/node_modules/playwright')); }
const root = resolve(new URL('..', import.meta.url).pathname);
const out = resolve(process.argv[2] || join(root, 'artifacts', 'video'));
await mkdir(out, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const server = createServer(async (req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  try { const b = await readFile(join(root, p === '/' ? 'index.html' : p)); res.writeHead(200, { 'Content-Type': types[extname(p)] || 'text/html' }); res.end(b); } catch { res.writeHead(404); res.end(); }
}).listen(0);
const base = `http://127.0.0.1:${server.address().port}/`;

const W = 1280;
const H = 720;
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: W, height: H }, recordVideo: { dir: out, size: { width: W, height: H } } });
await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
const page = await ctx.newPage();
const wait = (ms) => page.waitForTimeout(ms);

const OVERLAY = `
#demo-cap{position:fixed;left:50%;bottom:26px;transform:translateX(-50%);max-width:1060px;background:rgba(10,30,38,.88);color:#fff;font:600 21px/1.4 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding:14px 22px;border-radius:14px;z-index:99999;box-shadow:0 8px 28px rgba(0,0,0,.25);transition:opacity .35s;text-align:center}
#demo-cap small{display:block;font-weight:500;font-size:15px;opacity:.85;margin-top:4px}
#demo-card{position:fixed;inset:0;z-index:100000;display:grid;place-items:center;background:linear-gradient(135deg,#0d6e86,#1f9d7a);color:#fff;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;text-align:center;transition:opacity .5s}
#demo-card h1{font-size:64px;margin:0 0 8px;letter-spacing:-.02em}
#demo-card p{font-size:26px;margin:6px 0;opacity:.95}
#demo-card .small{font-size:18px;opacity:.85;margin-top:18px}
#demo-cursor{position:fixed;width:22px;height:22px;border-radius:50%;background:rgba(255,200,40,.85);border:2px solid #fff;box-shadow:0 0 0 4px rgba(255,200,40,.35);z-index:100001;pointer-events:none;transform:translate(-50%,-50%);transition:left .45s ease,top .45s ease;left:640px;top:360px}
`;

async function ensureOverlay() {
  await page.evaluate((css) => {
    if (!document.getElementById('demo-style')) {
      const st = document.createElement('style');
      st.id = 'demo-style';
      st.textContent = css;
      document.head.append(st);
    }
    if (!document.getElementById('demo-cursor')) {
      const c = document.createElement('div');
      c.id = 'demo-cursor';
      document.body.append(c);
    }
  }, OVERLAY);
}

async function cap(text, sub = '', ms = 3200) {
  await ensureOverlay();
  await page.evaluate(([t, s]) => {
    let el = document.getElementById('demo-cap');
    if (!el) { el = document.createElement('div'); el.id = 'demo-cap'; document.body.append(el); }
    el.style.opacity = '0';
    setTimeout(() => { el.innerHTML = ''; el.append(document.createTextNode(t)); if (s) { const sm = document.createElement('small'); sm.textContent = s; el.append(sm); } el.style.opacity = '1'; }, 180);
  }, [text, sub]);
  await wait(ms);
}

async function clearCap() {
  await page.evaluate(() => { const el = document.getElementById('demo-cap'); if (el) el.remove(); });
}
async function go(hash, ms = 1500) {
  await clearCap();
  await page.goto(`${base}${hash}`);
  await clearCap();
  await wait(ms);
}

async function card(title, lines, ms = 4200) {
  await clearCap();
  await ensureOverlay();
  await page.evaluate(([t, ls]) => {
    const el = document.createElement('div');
    el.id = 'demo-card';
    el.innerHTML = `<div><h1></h1>${ls.map((l, i) => `<p class="${i === ls.length - 1 ? 'small' : ''}"></p>`).join('')}</div>`;
    el.querySelector('h1').textContent = t;
    el.querySelectorAll('p').forEach((p, i) => { p.textContent = ls[i]; });
    document.body.append(el);
  }, [title, lines]);
  await wait(ms);
  await page.evaluate(() => { const el = document.getElementById('demo-card'); if (el) { el.style.opacity = '0'; setTimeout(() => el.remove(), 520); } });
  await wait(600);
}

async function moveTo(locator) {
  await ensureOverlay();
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) return;
  await page.evaluate(([x, y]) => { const c = document.getElementById('demo-cursor'); c.style.left = `${x}px`; c.style.top = `${y}px`; }, [box.x + box.width / 2, box.y + box.height / 2]);
  await wait(520);
}
async function tap(locator, pause = 450) { await moveTo(locator); await locator.click(); await wait(pause); }
const btn = (name) => page.getByRole('button', { name }).first();
async function scrollTo(y, ms = 900) { await page.evaluate((top) => window.scrollTo({ top, behavior: 'smooth' }), y); await wait(ms); }

// ------------------------------------------------------------------ script
await page.goto(base, { waitUntil: 'domcontentloaded' });
await wait(900);
await card('StreamWell', ['Check the stream. Check yourself.', 'IEEE OneAquaHealth Global Hackathon 2026'], 4500);
await cap('OneAquaHealth asks: do healthy urban streams make healthier people?', '', 3600);
await cap('Citizen science can watch hundreds of streams, but only about 27% of volunteers come back for a second session.', 'Sauermann & Franzoni, PNAS 2015', 4600);
await cap('And a stream record says nothing about how the stream made anyone feel.', 'The human half of One Health is missing.', 3800);
await scrollTo(760, 1200);
await cap('StreamWell turns every visit into two health checks: the stream’s, and yours.', '', 4200);

// Visit: site
await go('#/visit', 600);
await page.evaluate(() => { try { localStorage.removeItem('streamwell.v1'); } catch { /* ignore */ } });
await page.reload(); await wait(1200);
await cap('Pick one of the 106 real OneAquaHealth research sites.', 'Coimbra · Toulouse · Ghent · Benevento · Oslo', 3000);
await tap(page.getByRole('button', { name: /Vale das Flores/ }));
await scrollTo(520, 900);
await cap('Today’s safe-walk advisory and the project’s own lab health-risk score for this stream.', '', 4200);
await tap(btn('Start the visit'));

// Check-in
await cap('Thirty seconds before looking closely: four feelings.', 'The same four the OneAquaHealth app records: joy, calm, irritation, worry. StreamWell asks them twice.', 4300);
const choose = async (prompt, value) => tap(page.getByRole('radiogroup', { name: prompt }).getByRole('radio').nth(value - 1), 250);
await choose('How joyful do you feel?', 2);
await choose('How calm and at peace do you feel?', 2);
await choose('How irritated or angry do you feel?', 3);
await choose('How worried or uneasy do you feel?', 3);
await tap(btn('Start the stream check'));

// Stream check
await cap('The official OAH citizen protocol and answer codes, in plain words, with pictures.', 'The scientific term sits under each question, and "not sure" never counts against the stream.', 4600);
await tap(page.getByRole('button', { name: /^Slow/ }));
await tap(page.getByRole('button', { name: /^Clear/ }));
await scrollTo(380, 700);
await cap('An optional photo is checked for colour on the phone and never uploaded.', '', 3200);
for (let i = 0; i < 6; i += 1) {
  await tap(btn('Example answers'), 300);
  if (i === 3) { await scrollTo(300, 700); await cap('Left and right banks, plants, paving, invasive species, pressures…', 'About four minutes at a real stream.', 2600); }
  await tap(btn(i < 5 ? 'Next' : 'Second look'), 500);
}

// Second look
await cap('Second look: explainable checks against your other answers, recent weather and your photo.', 'It shows what it noticed, why, and which data it used.', 4600);
await tap(btn('Keep my answer'));
const note = page.getByPlaceholder(/Optional note/);
await moveTo(note);
await note.type('a few old trees on a mown bank', { delay: 45 });
await cap('You decide. The decision is kept with the record.', '', 2600);
await tap(btn('Check out'));

// Check-out
await cap('After the visit: the same four feelings again, and what shaped them.', '', 3000);
await tap(btn('Example answers'));
await scrollTo(520, 700);
await tap(btn('See my result'), 700);

// Result
await cap('Two health checks, side by side.', 'The stream: Good, with every point explained. You: more restored than when you arrived.', 5200);
await scrollTo(520, 1000);
await cap('One Health notes for the ecosystem, animals and people, and what would help this stretch.', '', 4200);
await scrollTo(1200, 1000);
await cap('Your data, your choice.', 'Stream observations go to OneAquaHealth. Feelings stay on the phone unless you opt in (k-anonymous, k ≥ 5).', 4800);

// Journal
await go('#/me', 1200);
await cap('Over weeks, the journal shows which streams restore you most.', 'Demo journal: synthetic data.', 3600);
await scrollTo(600, 1100);
await cap('Honest intervals say "not clear yet" when data is thin.', '', 3400);
await scrollTo(1250, 1100);
await cap('Missions send volunteers to streams nobody has checked for a month.', 'A personal benefit is the reason to come back.', 4200);
await scrollTo(1700, 1000);
await cap('Blue prescription: a GP prescribes stream walks and follows WHO-5 well-being.', '44 → 60 in six weeks (fictional patient).', 4200);

// City dashboard
await go('#/city', 1800);
await cap('For cities and researchers: every site, the citizens’ view and OAH lab health risk.', 'Pilot visits are synthetic; sites and lab scores are real OAH data.', 4800);
await scrollTo(380, 900);
await wait(1200);
await scrollTo(860, 1100);
await cap('Healthier streams, more restored people: the OneAquaHealth hypothesis, made measurable.', '', 4200);
await cap('What would help people most: feeling unsafe, bad smells and litter cost the most.', 'Sound of water and tree-lined banks add the most. Each bar becomes an action.', 5200);
await scrollTo(0, 900);
const weatherSelect = page.locator('select').nth(3);
await moveTo(weatherSelect);
await weatherSelect.selectOption('storm');
await wait(1600);
await scrollTo(380, 900);
await cap('Early warning: if a storm hits tonight, streams with a faecal signal turn red,', 'with safer streams nearby.', 5200);

// FHIR
await go('#/fhir', 1200);
await cap('Everything is HL7 FHIR R4 on the OneAquaHealth Implementation Guide.', 'Two privacy levels: stream observations, and a personal record only the volunteer controls.', 5000);
await scrollTo(540, 900);
await cap('Every bundle is checked against the OAH profiles, and returns 0 errors on the public HAPI server.', '', 4200);
await tap(page.getByRole('tab', { name: 'Health measures' }), 900);
await cap('Donated feelings become k-anonymous ObservationHealthMeasureOah site averages.', '', 3800);
await tap(page.getByRole('tab', { name: 'Blue prescription' }), 900);
await cap('And a CarePlan a GP can issue and follow.', '', 3200);

await card('StreamWell', ['Check the stream. Check yourself.', 'Open source · offline-first · ready for a summer pilot in a OneAquaHealth city', 'github.com/jiayi61/streamwell · jiayi61.github.io/streamwell'], 6000);

const video = page.video();
await ctx.close();
await browser.close();
server.close();
const webm = await video.path();
const mp4 = join(out, 'streamwell-demo.mp4');
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', webm, '-c:v', 'libx264', '-preset', 'medium', '-crf', '24', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4]);
console.log('video:', mp4);
