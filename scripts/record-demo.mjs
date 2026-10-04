// Records the narrated, captioned StreamWell demo video (docs/streamwell-demo.mp4).
// Usage: node scripts/record-demo.mjs [outDir]
//   needs Playwright (npm i --no-save playwright ffmpeg-static) and, for the
//   voice-over, macOS `say`; set NARRATE=0 for a silent captioned version.
// The app is served locally; map tiles (OpenStreetMap) and live weather (Open-Meteo)
// load from the internet, everything else external is blocked.
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { existsSync, renameSync, writeFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/npm-tools/node_modules/playwright')); }
let ffmpeg = 'ffmpeg';
try { ffmpeg = require('ffmpeg-static') || ffmpeg; } catch { /* use ffmpeg on PATH */ }
const NARRATE = process.env.NARRATE !== '0';
const VOICE = process.env.VOICE || 'Samantha';
const RATE = process.env.RATE || '184';
const VOICE_DIR = process.env.VOICE_DIR ? resolve(process.env.VOICE_DIR) : '';
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
// SYNC extra pixel rows at the bottom carry a coloured marker per spoken line; they are cropped away.
const SYNC = 16;
const ctx = await browser.newContext({ viewport: { width: W, height: H + SYNC }, recordVideo: { dir: out, size: { width: W, height: H + SYNC } } });
await ctx.route(/^https?:\/\/(?!127\.0\.0\.1|tile\.openstreetmap\.org|api\.open-meteo\.com)/, (r) => r.abort());
const page = await ctx.newPage();
const t0 = Date.now();
const wait = (ms) => page.waitForTimeout(ms);
// Narration is cached by text, so a second run records without any synthesis pauses.
const audioDir = join(out, 'voice-cache');
await mkdir(audioDir, { recursive: true });
const clips = [];
let lineNo = 0;

// Synthesises one narration line; returns its length in ms (0 when silent).
function speak(text) {
  if (!NARRATE || !text) return 0;
  lineNo += 1;
  let file;
  if (VOICE_DIR) {
    // A human recording: 01.m4a, 02.wav… one file per spoken line, in script order.
    const name = readdirSync(VOICE_DIR).filter((f) => !f.startsWith('.')).sort().find((f) => parseInt(f, 10) === lineNo);
    if (!name) throw new Error(`no recording for line ${lineNo} in ${VOICE_DIR}`);
    file = join(VOICE_DIR, name);
  } else file = join(audioDir, `${createHash('sha1').update(`${VOICE}|${RATE}|${text}`).digest('hex').slice(0, 16)}.aiff`);
  if (!VOICE_DIR && !existsSync(file)) for (let attempt = 1; ; attempt += 1) {
    // `say` occasionally stalls; give it a deadline and retry.
    try { execFileSync('say', ['-v', VOICE, '-r', RATE, '-o', `${file}.tmp.aiff`, text], { timeout: 20000 }); renameSync(`${file}.tmp.aiff`, file); break; } catch (e) { if (attempt === 4) throw e; }
  }
  const info = execFileSync('afinfo', [file]).toString();
  const ms = Math.round(parseFloat(/estimated duration: ([\d.]+)/.exec(info)[1]) * 1000);
  clips.push({ n: lineNo, file, text, at: Date.now() - t0 + 150, ms });
  return ms + 150;
}

const OVERLAY = `
#demo-cap{position:fixed;left:50%;bottom:26px;transform:translateX(-50%);max-width:1060px;background:rgba(10,30,38,.88);color:#fff;font:600 21px/1.4 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding:14px 22px;border-radius:14px;z-index:99999;box-shadow:0 8px 28px rgba(0,0,0,.25);transition:opacity .35s;text-align:center}
#demo-cap small{display:block;font-weight:500;font-size:15px;opacity:.85;margin-top:4px}
#demo-card{position:fixed;inset:0;z-index:100000;display:grid;place-items:center;background:linear-gradient(135deg,#0d6e86,#1f9d7a);color:#fff;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;text-align:center;transition:opacity .5s}
#demo-card h1{font-size:64px;margin:0 0 8px;letter-spacing:-.02em}
#demo-card p{font-size:26px;margin:6px 0;opacity:.95}
#demo-card .small{font-size:18px;opacity:.85;margin-top:18px}
#sync-mark{position:fixed;left:0;bottom:0;width:100%;height:16px;z-index:100003;pointer-events:none}
#demo-cursor{position:fixed;width:22px;height:22px;border-radius:50%;background:rgba(255,200,40,.85);border:2px solid #fff;box-shadow:0 0 0 4px rgba(255,200,40,.35);z-index:100001;pointer-events:none;transform:translate(-50%,-50%);transition:left .28s ease,top .28s ease;left:640px;top:360px}
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

// Marker grey level for spoken line n (luma survives video compression far better than colour).
const markCode = (n) => 10 + n * 9;
async function mark(n) {
  await ensureOverlay();
  await page.evaluate((c) => {
    let m = document.getElementById('sync-mark');
    if (!m) { m = document.createElement('div'); m.id = 'sync-mark'; document.body.append(m); }
    m.style.background = `rgb(${c},${c},${c})`;
  }, markCode(n));
}
async function voiced(voice) {
  if (!voice || !NARRATE) return 0;
  await mark(lineNo + 1);
  return speak(voice);
}

async function cap(text, sub = '', ms = 3200, voice = text) {
  await ensureOverlay();
  await page.evaluate(([t, s]) => {
    let el = document.getElementById('demo-cap');
    if (!el) { el = document.createElement('div'); el.id = 'demo-cap'; document.body.append(el); }
    el.style.opacity = '0';
    setTimeout(() => { el.innerHTML = ''; el.append(document.createTextNode(t)); if (s) { const sm = document.createElement('small'); sm.textContent = s; el.append(sm); } el.style.opacity = '1'; }, 180);
  }, [text, sub]);
  await wait(Math.max(ms, (await voiced(voice)) + 150));
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
  await wait(Math.max(ms, (await voiced(voice)) + 150));
  await page.evaluate(() => { const el = document.getElementById('demo-card'); if (el) { el.style.opacity = '0'; setTimeout(() => el.remove(), 520); } });
  await wait(600);
}

async function moveTo(locator) {
  await ensureOverlay();
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) return;
  await page.evaluate(([x, y]) => { const c = document.getElementById('demo-cursor'); c.style.left = `${x}px`; c.style.top = `${y}px`; }, [box.x + box.width / 2, box.y + box.height / 2]);
  await wait(320);
}
async function tap(locator, pause = 450) { await moveTo(locator); await locator.click(); await wait(pause); }
const btn = (name) => page.getByRole('button', { name }).first();
async function scrollTo(y, ms = 900) { await page.evaluate((top) => window.scrollTo({ top, behavior: 'smooth' }), y); await wait(ms); }

// ------------------------------------------------------------------ script
// cap(caption, sub, minimum ms on screen, spoken line). The spoken lines, in order, are the
// numbered narration in docs/demo-script.md; VOICE_DIR=<folder of 01.m4a, 02.m4a…> uses a human recording.
await page.goto(base, { waitUntil: 'domcontentloaded' });
await wait(900);
await card('StreamWell', ['Check the stream. Check yourself.', 'IEEE OneAquaHealth Global Hackathon 2026 · Community & Gamification track'], 3500,
  'StreamWell. Check the stream. Check yourself.');
await cap('OneAquaHealth asks: do healthy urban streams make healthier people?', 'Today nobody can answer it, for two reasons.', 3000,
  'OneAquaHealth asks: do healthy urban streams make healthier people? Today, nobody can answer that, for two reasons.');
await cap('1. Volunteers drift away: only about 27% come back for a second session.', 'Sauermann & Franzoni, PNAS 2015', 3000,
  'Volunteers drift away: in large citizen science projects, only about a quarter ever come back.');
await cap('2. The human half is missing.', 'A stream record says nothing about how the stream made anyone feel.', 3000,
  'And the human half is missing: a stream record says nothing about how the stream made anyone feel.');
await scrollTo(760, 1200);
await cap('One loop solves both: every visit is two health checks, the stream’s and yours.', 'The personal answer brings volunteers back; every return adds the paired data OneAquaHealth needs.', 4000,
  'StreamWell solves both with one loop. Every visit becomes two health checks, the stream’s and yours. The personal answer brings volunteers back, and every return visit adds the paired data OneAquaHealth needs.');

// Visit: site
await go('#/visit', 600);
await page.evaluate(() => { try { localStorage.removeItem('streamwell.v1'); } catch { /* ignore */ } });
await page.reload(); await wait(1200);
await cap('Built on OneAquaHealth’s real data.', 'All 106 research sites · the app’s own answer codes · the project’s lab results', 3000,
  'Meet Ana. She walks to a stream in Coimbra. Everything here is built on OneAquaHealth’s real data: all 106 research sites, the app’s own answer codes, and the project’s lab results.');
await tap(page.getByRole('button', { name: /Vale das Flores/ }));
await scrollTo(520, 900);
await cap('Safe-walk advisory from live weather and the OAH lab health-risk score.', '', 3000,
  'She sees today’s safe walk advisory, from live weather and the lab’s health risk score.');
await tap(btn('Start the visit'));

// Check-in
await cap('Check in: the four feelings the OAH app already asks.', 'Asked again after the visit, so each person is compared with themselves: no mood bias between people.', 4000,
  'Thirty seconds to check in, with the four feelings the OneAquaHealth app already asks. We ask them again after the visit, so each person is compared with themselves, which removes most of the bias in mood data.');
const choose = async (prompt, value) => tap(page.getByRole('radiogroup', { name: prompt }).getByRole('radio').nth(value - 1), 250);
await choose('How joyful do you feel?', 2);
await choose('How calm and at peace do you feel?', 2);
await choose('How irritated or angry do you feel?', 3);
await choose('How worried or uneasy do you feel?', 3);
await tap(btn('Start the stream check'));

// Stream check
await cap('The official OAH stream check, redesigned for non-experts.', 'Plain words · pictures · scientific term underneath · an honest "not sure"', 4000,
  'Then the official stream check, redesigned for non-experts: plain words, pictures, and an honest not sure that never counts against the stream.');
await tap(page.getByRole('button', { name: /^Slow/ }));
await tap(page.getByRole('button', { name: /^Clear/ }));
await scrollTo(380, 700);
for (let i = 0; i < 6; i += 1) {
  await tap(btn('Example answers'), 150);
  await tap(btn(i < 5 ? 'Next' : 'Second look'), 250);
}

// Second look
await cap('Second look: explainable AI, not a black box.', 'Every flag shows what it noticed, why, and which data it used: other answers, recent weather, the photo.', 4200,
  'Then a second look. No black box: every check shows what it noticed, why it matters, and which data it used: her other answers, recent weather, and her photo, analysed on the phone.');
await tap(btn('Keep my answer'));
const note = page.getByPlaceholder(/Optional note/);
await moveTo(note);
await note.type('a few old trees on a mown bank', { delay: 25 });
await cap('The AI suggests. The person decides.', 'The decision stays with the record.', 2600,
  'The AI suggests. Ana decides, and her decision stays with the record.');
await tap(btn('Check out'));

// Check-out
await tap(btn('Example answers'));
await scrollTo(520, 700);
await tap(btn('See my result'), 700);

// Result
await cap('Two health checks, side by side.', 'The stream: Good, every point explained. Ana: more restored than when she arrived.', 4600,
  'Two health checks, side by side. The stream is Good, every point explained, and Ana left more restored than she arrived. No other stream tool records that.');
await scrollTo(1200, 1000);
await cap('Privacy by design.', 'Feelings stay on the phone unless she opts in · research sees only averages over 5+ people', 4000,
  'Privacy is built in. Her feelings stay on her phone unless she opts in, and researchers only see averages over at least five people.');

// Journal
await go('#/me', 900);
await cap('The reason to come back: which streams restore me most?', 'Not points or badges. Demo journal: synthetic data.', 3400,
  'This is the reason to come back. Not points or badges, but an answer that matters to her: which streams restore me most?');
await scrollTo(600, 1100);
await cap('Honest intervals: "not clear yet" instead of overclaiming.', '', 3000,
  'With thin data, it says not clear yet, instead of overclaiming.');
await scrollTo(1250, 1100);
await cap('Missions to streams nobody has checked for a month.', 'Engagement fills the gaps in the monitoring network.', 3600,
  'Missions send volunteers to streams nobody has checked for a month, so engagement fills the gaps in monitoring.');
await scrollTo(1700, 1000);
await cap('Blue prescription: a GP prescribes stream walks and follows WHO-5 well-being.', '44 → 60 in six weeks (fictional patient).', 3800,
  'And it reaches health care: a doctor can prescribe stream walks, and follow the outcome with the WHO five well-being index.');

// City dashboard
await go('#/city', 1500);
await cap('For cities: citizen reports, real OAH lab results and live weather on one map.', 'Pilot visits are synthetic: this paired dataset does not exist yet. Creating it is the point.', 4400,
  'For cities, one map brings together citizen reports, real lab results and live weather. These visits are simulated, because this paired dataset does not exist yet. Creating it is exactly what StreamWell is for.');
await scrollTo(860, 1100);
await cap('Healthier streams, more restored people: the OneAquaHealth hypothesis, made measurable.', '', 3200,
  'Healthier streams, more restored people: OneAquaHealth’s central hypothesis, made measurable.');
await cap('Where to act: feeling unsafe, bad smells and litter cost the most.', 'Each bar becomes a concrete fix: light the path, trace the smell, clean up, plant trees.', 4200,
  'And it shows where to act. Feeling unsafe, bad smells and litter cost the most, and each one becomes a concrete fix for the city.');
await clearCap();
await scrollTo(0, 900);
const weatherSelect = page.locator('select').nth(3);
await moveTo(weatherSelect);
await weatherSelect.selectOption('storm');
await wait(1600);
await scrollTo(380, 900);
await cap('Early warning: if a storm hits tonight, streams with a faecal signal turn red,', 'with safer streams nearby.', 4000,
  'If a storm hits tonight, risky streams turn red, with safer ones nearby.');

// FHIR
await go('#/fhir', 900);
await cap('Speaks the language of health systems: HL7 FHIR R4 on the OneAquaHealth IG.', 'Two privacy levels: stream observations, and a personal record only the volunteer controls.', 4200,
  'It all speaks the language of health systems: H L 7 FHIR, on the OneAquaHealth Implementation Guide, at two privacy levels.');
await scrollTo(540, 900);
await cap('0 validation errors.', 'Ready for the project’s own infrastructure.', 3000,
  'Zero validation errors, ready for the project’s own infrastructure.');

// Evidence
await go('', 900);
const ev = page.getByRole('heading', { name: 'How we checked our own work' });
await ev.evaluate((el) => el.scrollIntoView({ block: 'start' }));
await page.evaluate(() => window.scrollBy(0, -90));
await wait(800);
await cap('We tested our own claims.', '200 simulated pilots: every planted effect found, 4% false alarms · 0 accessibility issues · pre-registered pilot', 5000,
  'And we tested our own claims. In two hundred simulated pilots, the model recovered every planted effect, with only four percent false alarms. Zero accessibility issues on every screen. And a pre-registered pilot is ready for one summer in one OneAquaHealth city.');

await card('StreamWell', ['Check the stream. Check yourself.', 'Works offline on any phone · no server · near-zero cost · ready for a pilot', 'jiayi61.github.io/streamwell · github.com/jiayi61/streamwell'], 4500,
  'StreamWell works offline on any phone, needs no server, and costs almost nothing to run. Check the stream. Check yourself. Thank you.');

const video = page.video();
await ctx.close();
await browser.close();
server.close();
const webm = await video.path();
const mp4 = join(out, 'streamwell-demo.mp4');
// Find when each line's marker first appears in the recorded frames, so the voice is placed by the
// video's own timeline (screen recordings drift from the wall clock under load).
const FPS = 25;
const raw = execFileSync(ffmpeg, ['-loglevel', 'error', '-i', webm, '-vf', `fps=${FPS},crop=32:${SYNC - 6}:16:${H + 3},scale=1:1:flags=area`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 26 });
let frame = 0;
for (const c of clips) {
  const code = markCode(c.n);
  let found = -1;
  for (let f = frame; f * 3 + 2 < raw.length; f += 1) {
    const near = (k) => k * 3 + 2 < raw.length && [0, 1, 2].every((ch) => Math.abs(raw[k * 3 + ch] - code) <= 3);
    if (near(f) && near(f + 1)) { found = f; break; }
  }
  if (found >= 0) { c.at = Math.round((found / FPS) * 1000) + 120; frame = found; } else console.warn(`marker for line ${c.n} not found; using the wall clock`);
}
const args = ['-y', '-loglevel', 'error', '-i', webm];
for (const c of clips) args.push('-i', c.file);
if (clips.length) {
  const delays = clips.map((c, i) => `[${i + 1}:a]adelay=${c.at}|${c.at},aresample=48000[a${i}]`).join(';');
  const mix = `${clips.map((_, i) => `[a${i}]`).join('')}amix=inputs=${clips.length}:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11[aout]`;
  args.push('-filter_complex', `[0:v]crop=${W}:${H}:0:0[v];${delays};${mix}`, '-map', '[v]', '-map', '[aout]', '-c:a', 'aac', '-b:a', '128k');
} else args.push('-vf', `crop=${W}:${H}:0:0`);
args.push('-c:v', 'libx264', '-preset', 'medium', '-crf', '26', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4);
execFileSync(ffmpeg, args);
console.log('video:', mp4, `${((Date.now() - t0) / 1000).toFixed(0)} s`);

// Captions (SRT) from the narration: one cue per sentence, timed in proportion to its length.
const shown = (t) => t.replace(/H L 7/g, 'HL7').replace(/k anonymous/g, 'k-anonymous').replace(/safe walk/g, 'safe-walk')
  .replace(/lab health risk/g, 'lab health-risk').replace(/tree lined/g, 'tree-lined').replace(/honest not sure/g, 'honest "not sure"')
  .replace(/health risk score/g, 'health-risk score').replace(/citizen science projects/g, 'citizen-science projects').replace(/WHO five/g, 'WHO-5').replace(/says not clear yet/g, 'says "not clear yet"');
const stamp = (ms) => {
  const t = Math.max(0, Math.round(ms));
  const pad = (n, w = 2) => String(n).padStart(w, '0');
  return `${pad(Math.floor(t / 3600000))}:${pad(Math.floor(t / 60000) % 60)}:${pad(Math.floor(t / 1000) % 60)},${pad(t % 1000, 3)}`;
};
const cues = [];
for (const c of clips) {
  const parts = shown(c.text).match(/[^.!?]+[.!?]*/g).map((x) => x.trim()).filter(Boolean);
  const total = parts.reduce((a, x) => a + x.length, 0);
  let t = c.at;
  for (const x of parts) { const d = c.ms * x.length / total; cues.push([t, t + d, x]); t += d; }
}
const srt = join(out, 'streamwell-demo.srt');
writeFileSync(srt, cues.map(([a, b, x], i) => `${i + 1}\n${stamp(a)} --> ${stamp(b)}\n${x}\n`).join('\n'));
console.log('captions:', srt, `${cues.length} cues`);
