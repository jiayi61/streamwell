// Records the narrated, captioned StreamWell demo video (docs/streamwell-demo.mp4).
// Usage: node scripts/record-demo.mjs [outDir]
//   needs Playwright (npm i --no-save playwright ffmpeg-static) and, for the
//   voice-over, macOS `say`; set NARRATE=0 for a silent captioned version.
// The app is served locally; map tiles (CARTO) and live weather (Open-Meteo)
// load from the internet, everything else external is blocked.
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { existsSync, renameSync } from 'node:fs';
import { createHash } from 'node:crypto';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/npm-tools/node_modules/playwright')); }
let ffmpeg = 'ffmpeg';
try { ffmpeg = require('ffmpeg-static') || ffmpeg; } catch { /* use ffmpeg on PATH */ }
const NARRATE = process.env.NARRATE !== '0';
const VOICE = process.env.VOICE || 'Samantha';
const RATE = process.env.RATE || '184';
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
await ctx.route(/^https?:\/\/(?!127\.0\.0\.1|[a-d]\.basemaps\.cartocdn\.com|api\.open-meteo\.com)/, (r) => r.abort());
const page = await ctx.newPage();
const t0 = Date.now();
const wait = (ms) => page.waitForTimeout(ms);
// Narration is cached by text, so a second run records without any synthesis pauses.
const audioDir = join(out, 'voice-cache');
await mkdir(audioDir, { recursive: true });
const clips = [];

// Synthesises one narration line; returns its length in ms (0 when silent).
function speak(text) {
  if (!NARRATE || !text) return 0;
  const file = join(audioDir, `${createHash('sha1').update(`${VOICE}|${RATE}|${text}`).digest('hex').slice(0, 16)}.aiff`);
  if (!existsSync(file)) for (let attempt = 1; ; attempt += 1) {
    // `say` occasionally stalls; give it a deadline and retry.
    try { execFileSync('say', ['-v', VOICE, '-r', RATE, '-o', `${file}.tmp.aiff`, text], { timeout: 20000 }); renameSync(`${file}.tmp.aiff`, file); break; } catch (e) { if (attempt === 4) throw e; }
  }
  const info = execFileSync('afinfo', [file]).toString();
  const ms = Math.round(parseFloat(/estimated duration: ([\d.]+)/.exec(info)[1]) * 1000);
  clips.push({ file, at: Date.now() - t0 + 250 });
  return ms + 250;
}

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

async function cap(text, sub = '', ms = 3200, voice = text) {
  await ensureOverlay();
  await page.evaluate(([t, s]) => {
    let el = document.getElementById('demo-cap');
    if (!el) { el = document.createElement('div'); el.id = 'demo-cap'; document.body.append(el); }
    el.style.opacity = '0';
    setTimeout(() => { el.innerHTML = ''; el.append(document.createTextNode(t)); if (s) { const sm = document.createElement('small'); sm.textContent = s; el.append(sm); } el.style.opacity = '1'; }, 180);
  }, [text, sub]);
  await wait(Math.max(ms, speak(voice) + 300));
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

async function card(title, lines, ms = 4200, voice = '') {
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
  await wait(Math.max(ms, speak(voice) + 300));
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
// Third argument: minimum time on screen. Fourth: the spoken line (defaults to the caption).
await page.goto(base, { waitUntil: 'domcontentloaded' });
await wait(900);
await card('StreamWell', ['Check the stream. Check yourself.', 'IEEE OneAquaHealth Global Hackathon 2026 · Community & Gamification track'], 4000,
  'StreamWell. Check the stream. Check yourself.');
await cap('OneAquaHealth asks: do healthy urban streams make healthier people?', '', 3000);
await cap('Citizen science can watch hundreds of streams, but only about 27% of volunteers come back for a second session.', 'Sauermann & Franzoni, PNAS 2015',
  4000, 'Citizen science can watch hundreds of streams, but only about a quarter of volunteers ever come back.');
await cap('And a stream record says nothing about how the stream made anyone feel.', 'The human half of One Health is missing.', 3400,
  'And a stream record says nothing about how the stream made anyone feel. The human half of One Health is missing.');
await scrollTo(760, 1200);
await cap('StreamWell turns every visit into two health checks: the stream’s, and yours.', 'One extra minute. A personal reason to come back.', 4000,
  'StreamWell fixes both with one idea. Every visit becomes two health checks: the stream’s, and yours.');

// Visit: site
await go('#/visit', 600);
await page.evaluate(() => { try { localStorage.removeItem('streamwell.v1'); } catch { /* ignore */ } });
await page.reload(); await wait(1200);
await cap('Pick one of the 106 real OneAquaHealth research sites.', 'Coimbra · Toulouse · Ghent · Benevento · Oslo', 3000,
  'Meet Ana. After work she walks to a stream in Coimbra, one of the 106 real OneAquaHealth research sites.');
await tap(page.getByRole('button', { name: /Vale das Flores/ }));
await scrollTo(520, 900);
await cap('Today’s safe-walk advisory and the project’s own lab health-risk score for this stream.', '', 3800,
  'She sees today’s safe walk advisory, and the project’s own lab health risk score for this stream.');
await tap(btn('Start the visit'));

// Check-in
await cap('Thirty seconds before looking closely: four feelings.', 'The same four the OneAquaHealth app records: joy, calm, irritation, worry. StreamWell asks them twice.', 4000,
  'First, thirty seconds: joy, calm, irritation and worry. The same four feelings the OneAquaHealth app already records. StreamWell asks them twice.');
const choose = async (prompt, value) => tap(page.getByRole('radiogroup', { name: prompt }).getByRole('radio').nth(value - 1), 250);
await choose('How joyful do you feel?', 2);
await choose('How calm and at peace do you feel?', 2);
await choose('How irritated or angry do you feel?', 3);
await choose('How worried or uneasy do you feel?', 3);
await tap(btn('Start the stream check'));

// Stream check
await cap('The official OAH citizen protocol and answer codes, in plain words, with pictures.', 'The scientific term sits under each question, and "not sure" never counts against the stream.', 4200,
  'Then the official OneAquaHealth stream check, in plain words and pictures, with an honest not sure.');
await tap(page.getByRole('button', { name: /^Slow/ }));
await tap(page.getByRole('button', { name: /^Clear/ }));
await scrollTo(380, 700);
await cap('An optional photo is checked for colour on the phone and never uploaded.', '', 2400, '');
for (let i = 0; i < 6; i += 1) {
  await tap(btn('Example answers'), 150);
  if (i === 3) { await scrollTo(300, 700); await cap('Left and right banks, plants, paving, invasive species, pressures…', 'About four minutes at a real stream.', 2400, ''); }
  await tap(btn(i < 5 ? 'Next' : 'Second look'), 250);
}

// Second look
await cap('Second look: explainable checks against your other answers, recent weather and your photo.', 'It shows what it noticed, why, and which data it used.', 4200,
  'Then a second look. Explainable checks compare her answers with each other, with recent weather and with her photo, and say why.');
await tap(btn('Keep my answer'));
const note = page.getByPlaceholder(/Optional note/);
await moveTo(note);
await note.type('a few old trees on a mown bank', { delay: 25 });
await cap('You decide. The decision is kept with the record.', 'Responsible AI: the model suggests, the person decides.', 2600,
  'The AI suggests. Ana decides, and her decision travels with the record.');
await tap(btn('Check out'));

// Check-out
await cap('After the visit: the same four feelings again, and what shaped them.', '', 2800,
  '');
await tap(btn('Example answers'));
await scrollTo(520, 700);
await tap(btn('See my result'), 700);

// Result
await cap('Two health checks, side by side.', 'The stream: Good, with every point explained. You: more restored than when you arrived.', 4600,
  'Two health checks, side by side. The stream is Good, with every point explained. And Ana left more restored than she arrived.');
await scrollTo(520, 1000);
await cap('One Health notes for the ecosystem, animals and people, and what would help this stretch.', '', 2800, '');
await scrollTo(1200, 1000);
await cap('Your data, your choice.', 'Stream observations go to OneAquaHealth. Feelings stay on the phone unless you opt in (k-anonymous, k ≥ 5).', 4200,
  'Her data, her choice. Feelings stay on her phone unless she opts in.');

// Journal
await go('#/me', 1200);
await cap('Over weeks, the journal shows which streams restore you most.', 'Demo journal: synthetic data.', 3400,
  'This is the reason to come back. Over weeks, her journal shows which streams restore her most.');
await scrollTo(600, 1100);
await cap('Honest intervals say "not clear yet" when data is thin.', 'The reward is personal insight, not points.', 3200,
  'The reward is personal insight, not points.');
await scrollTo(1250, 1100);
await cap('Missions send volunteers to streams nobody has checked for a month.', 'Streaks and adopted streams keep the habit going.', 3800,
  'Missions send volunteers to streams nobody has checked for a month.');
await scrollTo(1700, 1000);
await cap('Blue prescription: a GP prescribes stream walks and follows WHO-5 well-being.', '44 → 60 in six weeks (fictional patient).', 4000,
  'And a family doctor can prescribe stream walks, as a blue prescription.');

// City dashboard
await go('#/city', 2200);
await cap('For cities and researchers: every site, the citizens’ view and OAH lab health risk.', 'Pilot visits are synthetic; sites and lab scores are real OAH data.', 4400,
  'For cities: every site, with the real OneAquaHealth lab scores. These visits are simulated, because this paired dataset does not exist yet. Creating it is the point.');
await scrollTo(380, 900);
await wait(1000);
await scrollTo(860, 1100);
await cap('Healthier streams, more restored people: the OneAquaHealth hypothesis, made measurable.', '', 3200, 'Healthier streams, more restored people, made measurable.');
await cap('What would help people most: feeling unsafe, bad smells and litter cost the most.', 'Sound of water and tree-lined banks add the most. Each bar becomes an action.', 4600,
  'Feeling unsafe, smells and litter cost the most. Each becomes an action for the city.');
await scrollTo(0, 900);
const weatherSelect = page.locator('select').nth(3);
await moveTo(weatherSelect);
await weatherSelect.selectOption('storm');
await wait(1600);
await scrollTo(380, 900);
await cap('Early warning: if a storm hits tonight, streams with a faecal signal turn red,', 'with safer streams nearby.', 4600,
  'If a storm hits tonight, risky streams turn red, with safer ones nearby.');

// FHIR
await go('#/fhir', 1200);
await cap('Everything is HL7 FHIR R4 on the OneAquaHealth Implementation Guide.', 'Two privacy levels: stream observations, and a personal record only the volunteer controls.', 4600,
  'Everything is H L 7 FHIR on the OneAquaHealth Implementation Guide, at two privacy levels.');
await scrollTo(540, 900);
await cap('Every bundle is checked against the OAH profiles, and returns 0 errors on the public HAPI server.', '', 3800,
  'Zero validation errors.');
await tap(page.getByRole('tab', { name: 'Health measures' }), 900);
await cap('Donated feelings become k-anonymous ObservationHealthMeasureOah site averages.', '', 3400,
  '');
await tap(page.getByRole('tab', { name: 'Blue prescription' }), 900);
await cap('And a CarePlan a GP can issue and follow.', '', 2200, '');

// Evidence
await go('', 900);
const ev = page.getByRole('heading', { name: 'How we checked our own work' });
await ev.evaluate((el) => el.scrollIntoView({ block: 'start' }));
await page.evaluate(() => window.scrollBy(0, -90));
await wait(800);
await cap('How we checked our own work.', '200 simulated pilots with known effects · 0 FHIR errors · 0 WCAG 2.1 AA issues · pre-registered pilot', 5000,
  'We checked our own work. In two hundred simulated pilots, the model found every planted effect, and a fake one only four percent of the time. Zero accessibility issues. And a pre-registered pilot, ready for one OneAquaHealth city.');

await card('StreamWell', ['Check the stream. Check yourself.', 'Open source · offline-first · ready for a summer pilot in a OneAquaHealth city', 'jiayi61.github.io/streamwell · github.com/jiayi61/streamwell'], 5000,
  'StreamWell. Check the stream. Check yourself. Thank you.');

const video = page.video();
await ctx.close();
await browser.close();
server.close();
const webm = await video.path();
const mp4 = join(out, 'streamwell-demo.mp4');
const args = ['-y', '-loglevel', 'error', '-i', webm];
for (const c of clips) args.push('-i', c.file);
if (clips.length) {
  const delays = clips.map((c, i) => `[${i + 1}:a]adelay=${c.at}|${c.at},aresample=48000[a${i}]`).join(';');
  const mix = `${clips.map((_, i) => `[a${i}]`).join('')}amix=inputs=${clips.length}:normalize=0,volume=1.6[aout]`;
  args.push('-filter_complex', `${delays};${mix}`, '-map', '0:v', '-map', '[aout]', '-c:a', 'aac', '-b:a', '128k');
}
args.push('-c:v', 'libx264', '-preset', 'medium', '-crf', '26', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4);
execFileSync(ffmpeg, args);
console.log('video:', mp4, `${((Date.now() - t0) / 1000).toFixed(0)} s`);
