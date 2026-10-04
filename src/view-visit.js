// The citizen flow: site -> check-in -> stream check -> second look ->
// check-out -> result. State is kept as a draft so a visit survives a reload.

import { h, svg, clear, fmt, toast, download, bandBadge, BAND_COLOR } from './ui.js';
import { icon } from './icons.js';
import { SITES, SITE_BY_CODE, CITIES, nearestSites, distanceM, sitesInCity } from './sites.js';
import { HEALTH_RISK, riskBand } from './health-risks.js';
import { STEPS, QUESTIONS, UNSURE, questionsForStep, isAnswered, toOahSubmission, QUESTION_BY_ID } from './protocol.js';
import { EMOTIONS, SCALE, TAGS, TRAVEL, restoration, feelingChanges, restorationLabel } from './wellbeing.js';
import { conditionView, oneHealthNotes, suggestedActions } from './score.js';
import { secondLook, decisionSummary } from './checks.js';
import { fetchPointWeather } from './earlywarning.js';
import { analysePhoto } from './photo.js';
import { dumbbell } from './charts.js';
import { createMap } from './map.js';
import { streamBundle, personalBundle } from './fhir.js';
import { store } from './store.js';

const STAGES = ['site', 'checkin', 'stream', 'second', 'checkout', 'result'];
const STAGE_LABEL = { site: 'Place', checkin: 'Check in', stream: 'Stream check', second: 'Second look', checkout: 'Check out', result: 'Result' };

function newDraft() {
  const now = new Date();
  return {
    id: `v-${now.getTime().toString(36)}`,
    stage: 'site',
    streamStep: 0,
    site: null,
    city: 'CO',
    started: now.toISOString(),
    before: {},
    after: {},
    answers: {},
    decisions: {},
    tags: [],
    minutes: 20,
    travel: 'walk',
    consent: { oah: true, research: false },
  };
}

export function renderVisit(root, ctx) {
  let d = store.draft() || newDraft();
  let photoPreview = null;
  let weatherLoading = false;
  let returnToSecond = false;
  const wrap = h('div', { class: 'flow' });
  root.append(wrap);

  const save = () => store.saveDraft(d);
  const set = (patch) => { d = { ...d, ...patch }; save(); render(); };
  const go = (stage, extra = {}) => { set({ stage, ...extra }); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  function header() {
    const idx = STAGES.indexOf(d.stage);
    const pct = d.stage === 'stream' ? ((2 + d.streamStep / STEPS.length) / (STAGES.length - 1)) * 100 : (idx / (STAGES.length - 1)) * 100;
    return h('div', {},
      h('div', { class: 'row spread' },
        h('div', { class: 'eyebrow' }, `${STAGE_LABEL[d.stage]}${d.stage === 'stream' ? ` · ${d.streamStep + 1} of ${STEPS.length}` : ''}`),
        h('div', { class: 'row' },
          d.stage !== 'result' ? h('button', { class: 'btn small ghost', onclick: () => fillExample(), title: 'Fill this step with example answers (for demos)' }, 'Example answers') : null,
          h('button', { class: 'btn small ghost', onclick: () => { if (confirmRestart()) { d = newDraft(); store.clearDraft(); render(); } } }, 'Restart'))),
      h('div', { class: 'progress', role: 'progressbar', 'aria-valuenow': Math.round(pct), 'aria-valuemin': 0, 'aria-valuemax': 100 }, h('span', { style: { width: `${pct}%` } })),
    );
  }

  function confirmRestart() { return d.stage === 'site' || window.confirm('Start a new visit? Your answers so far will be discarded.'); }

  function nav(back, next, nextLabel = 'Next', nextOk = true) {
    return h('div', { class: `flow-nav${d.stage === 'stream' || d.stage === 'site' ? ' sticky' : ''}` },
      back ? h('button', { class: 'btn', onclick: back }, icon('left'), 'Back') : h('span'),
      next ? h('button', { class: 'btn primary', onclick: next, disabled: !nextOk }, nextLabel, icon('right')) : h('span'));
  }

  // ------------------------------------------------------------------ site
  function siteStage() {
    const advisoryFor = (code) => ctx.advisories && ctx.advisories[code];
    const list = h('div', { class: 'sitelist' });
    const mapEl = h('div', { class: 'map short' });
    const sel = d.site ? SITE_BY_CODE[d.site] : null;
    const items = d.nearest ? d.nearest.map((s) => SITE_BY_CODE[s.code]) : sitesInCity(d.city);
    for (const s of items) {
      const adv = advisoryFor(s.code);
      const dist = d.gps ? distanceM(d.gps.lat, d.gps.lon, s.lat, s.lon) : null;
      list.append(h('button', { class: 'siteitem', 'aria-pressed': String(d.site === s.code), onclick: () => pick(s.code) },
        h('span', {}, h('strong', {}, s.name), h('span', { class: 'muted small' }, ` · ${s.code}${dist != null ? ` · ${dist < 1000 ? `${Math.round(dist)} m` : `${(dist / 1000).toFixed(1)} km`}` : ''}`)),
        adv ? h('span', { class: `badge lvl-${adv.level}` }, adv.short) : null));
    }
    const pick = (code) => {
      const s = SITE_BY_CODE[code];
      const dist = d.gps ? distanceM(d.gps.lat, d.gps.lon, s.lat, s.lon) : null;
      set({ site: code, city: s.city, lat: s.lat, lon: s.lon, distanceM: dist });
    };
    const locate = () => {
      if (!navigator.geolocation) { toast('Location is not available in this browser'); return; }
      navigator.geolocation.getCurrentPosition((pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        const near = nearestSites(latitude, longitude, 8);
        const patch = { gps: { lat: latitude, lon: longitude, accuracy }, nearest: near.map((n) => ({ code: n.code })) };
        if (near[0] && near[0].distance <= 300) Object.assign(patch, { site: near[0].code, city: near[0].city, lat: near[0].lat, lon: near[0].lon, distanceM: near[0].distance });
        set(patch);
        toast(near[0] ? `Nearest site: ${near[0].name} (${Math.round(near[0].distance)} m)` : 'No site nearby');
      }, () => toast('Could not get your location. Pick a site from the list.'), { enableHighAccuracy: true, timeout: 10000 });
    };
    const out = h('div', {},
      h('h2', {}, 'Where are you?'),
      h('p', { class: 'muted' }, 'Pick the OneAquaHealth research site you are standing at. Your location is only used on this phone to find the nearest site.'),
      h('div', { class: 'row', style: { margin: '8px 0 12px' } },
        h('button', { class: 'btn', onclick: locate }, icon('locate'), 'Use my location'),
        h('div', { class: 'pill-row' }, Object.values(CITIES).map((c) => h('button', { class: 'chip', style: d.city === c.id && !d.nearest ? { borderColor: 'var(--brand)', color: 'var(--brand)' } : null, onclick: () => set({ city: c.id, nearest: null }) }, c.name)))),
      mapEl,
      h('div', { style: { marginTop: '12px' } }, list),
      sel ? selectedCard(sel) : null,
      nav(null, () => go('checkin'), 'Start the visit', !!sel),
    );
    requestAnimationFrame(() => {
      const m = createMap(mapEl, {});
      if (!m) return;
      const shown = items;
      m.setMarkers(shown.map((s) => {
        const adv = advisoryFor(s.code);
        return { code: s.code, lat: s.lat, lon: s.lon, title: `${s.name} (${s.code})`, color: adv ? ['#2f9e44', '#d08b12', '#d9480f'][adv.level] : '#0d6e86' };
      }), (code) => pick(code));
      if (d.gps) m.fit([...shown, d.gps], 15); else m.fit(shown, 13);
      if (d.site) m.highlight(d.site);
    });
    return out;
  }

  function selectedCard(s) {
    const lab = HEALTH_RISK[s.code];
    const adv = ctx.advisories && ctx.advisories[s.code];
    return h('div', { class: 'card', style: { marginTop: '14px' } },
      h('div', { class: 'card-head' }, h('h3', {}, `${s.name}`), h('span', { class: 'muted small' }, `${s.code} · ${CITIES[s.city].name}`)),
      adv ? h('div', { class: 'stack' },
        h('div', {}, h('span', { class: `badge lvl-${adv.level}` }, adv.label)),
        ...adv.reasons.slice(0, 2).map((r) => h('p', { class: 'small muted' }, r.text, h('span', { class: 'tiny' }, ` (${r.source})`)))) : null,
      lab ? h('p', { class: 'small' }, icon('flask', 'inline'), ` OAH lab health-risk score ${lab.score.toFixed(2)} (${riskBand(lab.score)}), sampled ${fmt.date(lab.date)}.`) : h('p', { class: 'small muted' }, 'No OAH lab sample for this site yet.'),
      d.distanceM != null && d.distanceM > 300 ? h('p', { class: 'small', style: { color: 'var(--moderate)' } }, `You are ${Math.round(d.distanceM)} m from this site.`) : null,
    );
  }

  // ------------------------------------------------------------ feelings
  function feelingsBlock(key, title, intro) {
    const m = d[key] || {};
    return h('div', {},
      h('h2', {}, title),
      h('p', { class: 'muted' }, intro),
      h('div', { class: 'feel', style: { marginTop: '12px' } },
        EMOTIONS.map((e) => h('div', { class: 'item' },
          h('div', { class: 'row spread' }, h('strong', {}, e.prompt), m[e.id] ? h('span', { class: 'muted small' }, SCALE[m[e.id] - 1].label) : null),
          h('div', { class: 'scale', role: 'radiogroup', 'aria-label': e.prompt },
            SCALE.map((sc) => h('button', { role: 'radio', 'aria-checked': String(m[e.id] === sc.value), 'aria-pressed': String(m[e.id] === sc.value), onclick: () => set({ [key]: { ...m, [e.id]: sc.value } }) }, String(sc.value), h('small', {}, sc.label))))))),
    );
  }
  const feelingsDone = (m) => EMOTIONS.every((e) => typeof (m || {})[e.id] === 'number');

  // --------------------------------------------------------------- stream
  function setAnswer(id, value) { set({ answers: { ...d.answers, [id]: value } }); }

  function optionTile(q, o, selected, onClick) {
    return h('button', { class: `opt${o.code === UNSURE ? ' unsure' : ''}`, 'aria-pressed': String(selected), onclick: onClick, title: o.oahLabel ? `OAH app: ${o.oahLabel}` : null },
      o.icon ? icon(o.icon) : o.swatch ? h('span', { class: 'sw', style: { background: o.swatch } }) : null,
      h('span', { class: 't' }, o.label),
      o.detail ? h('span', { class: 'd' }, o.detail) : null);
  }

  function yesNo(value, onSet, allowUnsure = true) {
    const b = (label, v) => h('button', { 'aria-pressed': String(value === v), onclick: () => onSet(v) }, label);
    return h('div', { class: 'seg', role: 'group' }, b('Yes', true), b('No', false), allowUnsure ? b('Not sure', UNSURE) : null);
  }

  function questionView(q) {
    const v = d.answers[q.id];
    const head = [h('div', { class: 'science' }, q.science), h('h3', {}, q.prompt), q.help ? h('p', { class: 'help' }, q.help) : null];
    let body;
    if (q.type === 'single') {
      const opts = [...q.options, ...(q.noUnsure ? [] : [{ code: UNSURE, label: 'Not sure' }])];
      body = h('div', { class: 'opts' }, opts.map((o) => optionTile(q, o, v === o.code, () => setAnswer(q.id, o.code))));
    } else if (q.type === 'multi') {
      const arr = Array.isArray(v) ? v : null;
      body = h('div', { class: 'opts' },
        q.options.map((o) => optionTile(q, o, !!arr && arr.includes(o.code), () => {
          const cur = Array.isArray(v) ? v : [];
          setAnswer(q.id, cur.includes(o.code) ? cur.filter((x) => x !== o.code) : [...cur, o.code]);
        })),
        optionTile(q, { code: 'NONE', label: 'None of these' }, Array.isArray(v) && v.length === 0, () => setAnswer(q.id, [])),
      );
    } else if (q.type === 'bool') {
      body = h('div', { class: 'stack' }, yesNo(v, (x) => setAnswer(q.id, x)),
        q.followUp && v === true ? h('label', { class: 'small' }, q.followUp.prompt, ' ',
          h('input', { type: q.followUp.type === 'number' ? 'number' : 'text', min: q.followUp.min, max: q.followUp.max, value: d.answers[q.followUp.id] ?? '', style: { padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--line)', marginLeft: '6px', width: q.followUp.type === 'number' ? '90px' : '220px' }, oninput: (e) => { d.answers = { ...d.answers, [q.followUp.id]: e.target.value }; save(); } })) : null);
    } else if (q.type === 'side') {
      const val = v || {};
      const sideBox = (s) => {
        const setSide = (x) => setAnswer(q.id, { ...val, [s]: x });
        let ctl;
        if (q.valueType === 'bool') ctl = yesNo(val[s], setSide);
        else ctl = h('div', { class: 'opts', style: { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' } }, [...q.options, { code: UNSURE, label: 'Not sure' }].map((o) => optionTile(q, o, val[s] === o.code, () => setSide(o.code))));
        return h('div', { class: 'side' }, h('h4', {}, s === 'left' ? 'Left bank' : 'Right bank'), ctl);
      };
      body = h('div', { class: 'sides' }, sideBox('left'), sideBox('right'));
    } else if (q.type === 'number') {
      body = h('label', { class: 'row' }, h('input', { type: 'number', min: q.min, max: q.max, value: v ?? '', placeholder: 'e.g. 30', style: { padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--line)', width: '120px' }, oninput: (e) => { d.answers = { ...d.answers, [q.id]: e.target.value }; save(); } }), h('span', { class: 'muted' }, q.unit));
    }
    return h('div', { class: 'q', id: `q-${q.id}` }, ...head, body);
  }

  function photoBlock() {
    const input = h('input', { type: 'file', accept: 'image/*', capture: 'environment', class: 'sr-only', id: 'photo-in', onchange: async (e) => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      try {
        const res = await analysePhoto(f);
        photoPreview = res.preview;
        set({ photo: { hint: res.hint, hash: res.hash, size: res.size, takenAt: new Date().toISOString() } });
      } catch { toast('Could not read that photo'); }
    } });
    const hint = d.photo && d.photo.hint;
    return h('div', { class: 'card flat', style: { marginTop: '8px' } },
      h('div', { class: 'row spread' },
        h('div', {}, h('strong', {}, 'Photo of the water (optional)'), h('div', { class: 'small muted' }, 'Checked on this phone for colour. The photo is never uploaded.')),
        h('label', { class: 'btn small', for: 'photo-in' }, icon('camera'), d.photo ? 'Replace' : 'Add photo'), input),
      photoPreview ? h('img', { class: 'photo-preview', src: photoPreview, alt: 'Your photo of the stream', style: { marginTop: '10px' } }) : null,
      hint ? h('p', { class: 'small', style: { marginTop: '8px' } }, h('span', { class: 'badge info' }, 'Photo check'), ` Looks ${hint.label}${hint.confidence ? ` (${Math.round(hint.confidence * 100)}% sure)` : ''}. ${hint.explanation}`) : null,
    );
  }

  function streamStage() {
    const step = STEPS[d.streamStep];
    const qs = questionsForStep(step.id);
    const ok = qs.every((q) => isAnswered(q, d.answers[q.id]));
    const back = () => (d.streamStep === 0 ? go('checkin') : set({ streamStep: d.streamStep - 1 }));
    const next = () => {
      if (returnToSecond) { returnToSecond = false; go('second'); return; }
      if (d.streamStep < STEPS.length - 1) { set({ streamStep: d.streamStep + 1 }); window.scrollTo({ top: 0, behavior: 'smooth' }); } else go('second');
    };
    return h('div', {},
      h('h2', {}, step.title),
      h('p', { class: 'muted' }, step.hint),
      ...qs.map(questionView),
      step.id === 'water' ? photoBlock() : null,
      nav(back, next, returnToSecond ? 'Back to second look' : d.streamStep === STEPS.length - 1 ? 'Second look' : 'Next', ok),
    );
  }

  // ---------------------------------------------------------- second look
  function ensureWeather() {
    if (d.weather || weatherLoading || !d.lat) return;
    weatherLoading = true;
    fetchPointWeather(d.lat, d.lon).then((w) => { weatherLoading = false; set({ weather: w }); })
      .catch(() => { weatherLoading = false; set({ weather: { unavailable: true, source: 'Open-Meteo unreachable' } }); });
  }

  function secondStage() {
    ensureWeather();
    const w = d.weather && !d.weather.unavailable ? d.weather : null;
    const flags = secondLook(d.answers, { weather: w, distanceM: d.distanceM, photoHint: d.photo && d.photo.hint });
    const open = flags.filter((f) => f.severity === 'check' && !(d.decisions[f.id] && d.decisions[f.id].decision));
    const decide = (f, decision) => set({ decisions: { ...d.decisions, [f.id]: { ...(d.decisions[f.id] || {}), decision, title: f.title, uses: f.uses } } });
    const change = (f) => {
      decide(f, 'changed');
      const q = QUESTION_BY_ID[f.fix.field];
      returnToSecond = true;
      go('stream', { streamStep: STEPS.findIndex((s) => s.id === q.step) });
      setTimeout(() => { const el = document.getElementById(`q-${q.id}`); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 150);
    };
    return h('div', {},
      h('h2', {}, 'Second look'),
      h('p', { class: 'muted' }, 'StreamWell compares your answers with each other, with the weather of the last days and with your photo. It explains what it noticed; you decide. Nothing is changed for you.'),
      h('div', { class: 'small muted', style: { margin: '8px 0 14px' } },
        icon('rain', 'inline'), ' ',
        weatherLoading ? 'Loading recent weather from Open-Meteo…'
          : w ? `Last 48 h: ${fmt.num(w.rain48, 1)} mm rain · hottest of last 3 days ${fmt.num(w.tmax3, 0)} °C (Open-Meteo model, not a stream gauge)`
            : 'Weather unavailable, so weather checks are skipped.'),
      flags.length === 0 ? h('div', { class: 'card', style: { textAlign: 'center' } }, h('div', { style: { color: 'var(--good)', width: '48px', margin: '0 auto' } }, icon('check')), h('h3', {}, 'Everything fits together'), h('p', { class: 'muted small' }, 'No contradictions found. Thank you for a careful check.')) : null,
      h('div', { class: 'stack' }, flags.map((f) => {
        const dec = d.decisions[f.id] || {};
        return h('div', { class: `flag ${f.severity}` },
          h('div', { class: 'row spread' }, h('strong', {}, f.title), h('span', { class: `badge ${f.severity === 'safety' ? 'poor' : f.severity === 'check' ? 'moderate' : 'info'}` }, f.severity === 'check' ? 'Please check' : f.severity === 'safety' ? 'Safety' : 'Good to know')),
          h('p', { class: 'small', style: { margin: '6px 0' } }, f.why),
          f.uses.length ? h('div', { class: 'uses' }, f.uses.map((u) => h('span', { class: 'chip' }, `${QUESTION_BY_ID[u] ? QUESTION_BY_ID[u].science : u}: ${describe(u)}`))) : null,
          h('div', { class: 'src' }, `Source: ${f.source}`),
          f.severity === 'check' ? h('div', { class: 'row', style: { marginTop: '10px' } },
            h('button', { class: 'btn small', 'aria-pressed': String(dec.decision === 'kept'), style: dec.decision === 'kept' ? { borderColor: 'var(--brand)', color: 'var(--brand)' } : null, onclick: () => decide(f, 'kept') }, 'Keep my answer'),
            f.fix ? h('button', { class: 'btn small', onclick: () => change(f) }, f.fix.label) : null,
            dec.decision === 'kept' ? h('input', { type: 'text', placeholder: 'Optional note (e.g. "lots of litter")', value: dec.note || '', style: { flex: '1 1 200px', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--line)' }, oninput: (e) => { d.decisions = { ...d.decisions, [f.id]: { ...dec, note: e.target.value } }; save(); } }) : null,
            dec.decision === 'changed' ? h('span', { class: 'badge good' }, 'Reviewed') : null) : null,
        );
      })),
      nav(() => set({ stage: 'stream', streamStep: STEPS.length - 1 }), () => {
        set({ flags: flags.map((f) => ({ id: f.id, title: f.title, severity: f.severity, uses: f.uses, source: f.source })) });
        go('checkout');
      }, open.length ? `${open.length} to review` : 'Check out', open.length === 0),
    );
  }

  function describe(id) {
    const v = d.answers[id];
    if (v === undefined) return '—';
    if (v === UNSURE) return 'not sure';
    if (v === true) return 'yes';
    if (v === false) return 'no';
    if (Array.isArray(v)) return v.length ? v.join(', ') : 'none';
    if (typeof v === 'object') return `L ${describeVal(v.left)} · R ${describeVal(v.right)}`;
    const q = QUESTION_BY_ID[id];
    const o = q && q.options && q.options.find((x) => x.code === v);
    return o ? o.label.toLowerCase() : String(v);
  }
  const describeVal = (x) => (x === true ? 'yes' : x === false ? 'no' : x === UNSURE ? '?' : x || '—');

  // ------------------------------------------------------------- checkout
  function checkoutStage() {
    const ok = feelingsDone(d.after);
    return h('div', {},
      feelingsBlock('after', 'How do you feel now?', 'Same four feelings as at the start. Answer for right now, after your time at the stream.'),
      h('div', { class: 'q' },
        h('h3', {}, 'What shaped how you felt?'),
        h('p', { class: 'help' }, 'Tap all that apply. These help cities see which fixes matter to people.'),
        h('div', { class: 'tags' }, TAGS.map((t) => h('button', { class: `tag ${t.positive ? 'pos' : 'neg'}`, 'aria-pressed': String(d.tags.includes(t.id)), onclick: () => set({ tags: d.tags.includes(t.id) ? d.tags.filter((x) => x !== t.id) : [...d.tags, t.id] }) }, t.label)))),
      h('div', { class: 'q grid grid-2' },
        h('label', { class: 'stack' }, h('strong', {}, `Time at the stream: ${d.minutes} min`), h('input', { type: 'range', min: 5, max: 90, step: 5, value: d.minutes, oninput: (e) => { d.minutes = Number(e.target.value); e.target.previousSibling.textContent = `Time at the stream: ${d.minutes} min`; save(); } })),
        h('div', { class: 'stack' }, h('strong', {}, 'How did you get here?'), h('div', { class: 'pill-row' }, TRAVEL.map((t) => h('button', { class: 'tag pos', 'aria-pressed': String(d.travel === t.id), onclick: () => set({ travel: t.id }) }, t.label))))),
      nav(() => go('second'), () => go('result'), 'See my result', ok),
    );
  }

  // --------------------------------------------------------------- result
  function resultStage() {
    const s = SITE_BY_CODE[d.site];
    const cond = conditionView(d.answers, d.answers.overallAssessment);
    const r = restoration(d.before, d.after);
    const changes = feelingChanges(d.before, d.after);
    const notes = oneHealthNotes(d.answers, d.weather && !d.weather.unavailable ? d.weather : null);
    const actions = suggestedActions(d.answers, d.tags);
    const visit = finalVisit();
    const domainIcon = { ecosystem: 'leaf', animals: 'paw', people: 'person' };
    const domainLabel = { ecosystem: 'Ecosystem', animals: 'Animals', people: 'People' };
    return h('div', {},
      h('h2', {}, `${s.name}, ${fmt.date(visit.date)}`),
      h('div', { class: 'result-tiles', style: { marginTop: '10px' } },
        h('div', { class: 'card' },
          h('div', { class: 'eyebrow' }, 'The stream'),
          h('div', { class: 'big', style: { color: BAND_COLOR[cond.band] || 'var(--muted)' } }, cond.band ? { GOOD: 'Good', MODERATE: 'Moderate', POOR: 'Poor' }[cond.band] : '—'),
          h('div', { class: 'small muted' }, `StreamWell view ${cond.score ?? '—'}/100 · confidence ${cond.confidence.level}`),
          h('div', { class: 'small', style: { margin: '6px 0 10px' } }, 'Your rating: ', bandBadge(d.answers.overallAssessment), cond.agreement ? h('span', { class: 'muted' }, ` · ${cond.agreement.label}`) : null),
          ...cond.components.map((c) => h('div', { style: { marginBottom: '8px' } },
            h('div', { class: 'row spread small' }, h('span', {}, c.label), h('span', { class: 'muted' }, c.score === null ? 'not known' : `${Math.round(c.score)}/25`)),
            h('div', { class: 'bar' }, h('span', { style: { width: `${((c.score || 0) / 25) * 100}%` } })))),
          h('details', { class: 'small' }, h('summary', {}, 'Where every point came from'),
            h('ul', {}, cond.components.flatMap((c) => c.reasons.map((x) => h('li', {}, `${x.text}${x.points === null ? ' (left out)' : ` · ${x.points}/${x.possible}`}`))))),
        ),
        h('div', { class: 'card' },
          h('div', { class: 'eyebrow' }, 'You'),
          h('div', { class: 'big', style: { color: r > 0.2 ? 'var(--good)' : r < -0.2 ? 'var(--poor)' : 'var(--muted)' } }, fmt.signed(r)),
          h('div', { class: 'small muted' }, `${restorationLabel(r)} after ${d.minutes} min · scale −4 to +4`),
          svg(dumbbell({ rows: changes.map((c) => ({ label: c.label, before: c.before, after: c.after, better: c.better })) })),
          h('div', { class: 'tags', style: { marginTop: '6px' } }, d.tags.map((t) => h('span', { class: `badge ${TAGS.find((x) => x.id === t).positive ? 'good' : 'poor'}` }, TAGS.find((x) => x.id === t).label))),
        ),
      ),
      h('div', { class: 'story', style: { marginTop: '16px' } },
        h('div', { class: 'muted small' }, `${s.name} · ${CITIES[s.city].name}`),
        h('div', { class: 'big' }, storyLine(cond.band, r, d.tags)),
        h('div', { class: 'muted small', style: { marginTop: '6px' } }, 'One visit, two health checks. StreamWell × OneAquaHealth')),
      notes.length ? h('div', { class: 'card', style: { marginTop: '16px' } },
        h('h3', {}, 'One Health notes'),
        notes.map((n) => h('div', { class: 'note' },
          h('div', { style: { width: '28px', color: n.level === 'caution' ? 'var(--poor)' : n.level === 'benefit' ? 'var(--good)' : 'var(--info)' } }, icon(domainIcon[n.domain])),
          h('div', {}, h('strong', {}, n.title), h('span', { class: 'badge neutral', style: { marginLeft: '8px' } }, domainLabel[n.domain]), h('p', { class: 'small muted', style: { margin: '2px 0 0' } }, n.text))))) : null,
      actions.length ? h('div', { class: 'card', style: { marginTop: '16px' } },
        h('h3', {}, 'What would help this stretch'),
        h('ul', { class: 'small' }, actions.map((a) => h('li', {}, h('span', { class: 'badge neutral' }, a.who === 'city' ? 'City' : 'Community'), ' ', a.text)))) : null,
      h('div', { class: 'card', style: { marginTop: '16px' } },
        h('h3', {}, 'Your data, your choice'),
        h('label', { class: 'toggle' }, h('input', { type: 'checkbox', checked: d.consent.oah, onchange: (e) => { d.consent = { ...d.consent, oah: e.target.checked }; save(); } }),
          h('span', {}, h('strong', {}, 'Share the stream observation with OneAquaHealth'), h('br'), h('span', { class: 'small muted' }, 'Stream answers, site and date only. No feelings, no account, no exact phone location.'))),
        h('label', { class: 'toggle' }, h('input', { type: 'checkbox', checked: d.consent.research, onchange: (e) => { d.consent = { ...d.consent, research: e.target.checked }; save(); } }),
          h('span', {}, h('strong', {}, 'Also donate my feelings for research, de-identified'), h('br'), h('span', { class: 'small muted' }, 'Only published as site averages over at least 5 different visitors (k-anonymity). Off unless you switch it on. Well-being data is health data under GDPR, so this needs your explicit yes.'))),
        h('div', { class: 'row', style: { marginTop: '10px' } },
          h('button', { class: 'btn small', onclick: () => download(`streamwell-stream-${visit.site}-${visit.date}.json`, streamBundle(visit)) }, icon('download'), 'Stream FHIR'),
          h('button', { class: 'btn small', onclick: () => download(`streamwell-my-record-${visit.date}.json`, personalBundle(visit)) }, icon('download'), 'My well-being FHIR'),
          h('button', { class: 'btn small', onclick: () => download(`oah-app-submission-${visit.site}-${visit.date}.json`, toOahSubmission(visit), 'application/json') }, icon('download'), 'OAH app format')),
      ),
      nav(() => go('checkout'), () => {
        store.addVisit(visit);
        toast('Visit saved to your journal');
        location.hash = '#/me';
      }, 'Save to my journal'),
    );
  }

  function finalVisit() {
    const s = SITE_BY_CODE[d.site];
    return {
      id: d.id,
      person: 'me',
      site: d.site,
      city: s.city,
      date: localDate(new Date(d.started)),
      datetime: d.started,
      lat: s.lat,
      lon: s.lon,
      answers: d.answers,
      before: d.before,
      after: d.after,
      tags: d.tags,
      minutes: d.minutes,
      travel: d.travel,
      weather: d.weather || null,
      photo: d.photo ? { hint: d.photo.hint && { suggest: d.photo.hint.suggest, label: d.photo.hint.label, confidence: d.photo.hint.confidence }, hash: d.photo.hash, size: d.photo.size } : null,
      decisions: decisionSummary(secondLook(d.answers, { weather: d.weather && !d.weather.unavailable ? d.weather : null, distanceM: d.distanceM, photoHint: d.photo && d.photo.hint }), d.decisions).map((x) => ({ ...x, uses: (d.decisions[x.id] && d.decisions[x.id].uses) || [] })),
      consent: d.consent,
      synthetic: false,
    };
  }

  // --------------------------------------------------------- example fill
  function fillExample() {
    if (d.stage === 'site') { const s = SITE_BY_CODE.C3; set({ site: 'C3', city: 'CO', lat: s.lat, lon: s.lon, nearest: null }); return; }
    if (d.stage === 'checkin') { set({ before: { joy: 2, serenity: 2, anger: 3, fear: 3 } }); return; }
    if (d.stage === 'checkout') { set({ after: { joy: 3, serenity: 4, anger: 2, fear: 2 }, tags: ['waterSound', 'birds', 'shade', 'litter'], minutes: 25, travel: 'walk' }); return; }
    if (d.stage === 'stream') {
      const example = {
        waterFlow: 'NOR', waterColor: 'CL', waterHeight: '25', channelForm: 'U', bottomChannelType: 'NAT', banksChannelType: 'LAS',
        habitats: ['SD', 'RF', 'AV'], fallenBiomassTypes: ['FB', 'FL'],
        imperviousAreas: { left: true, right: false }, isVegetationCovered: { left: false, right: true }, vegetationType: { left: 'T', right: 'T' },
        hasInvasivePlantSpecies: UNSURE, recentVegetationCuts: false,
        waterAbstraction: false, hasDams: false, pipes: true, waterDischarge: false, construction: false,
        overallAssessment: 'GOOD',
      };
      const step = STEPS[d.streamStep];
      const patch = {};
      questionsForStep(step.id).forEach((q) => { patch[q.id] = example[q.id]; });
      set({ answers: { ...d.answers, ...patch } });
    }
  }

  function render() {
    clear(wrap);
    wrap.append(header());
    const view = { site: siteStage, checkin: () => h('div', {}, feelingsBlock('before', 'Before you look around', 'Thirty seconds. Rate how you feel right now, before you look closely at the stream. This is your baseline.'), nav(() => go('site'), () => go('stream', { streamStep: 0 }), 'Start the stream check', feelingsDone(d.before))), stream: streamStage, second: secondStage, checkout: checkoutStage, result: resultStage }[d.stage];
    wrap.append(view());
  }
  render();
}

/** YYYY-MM-DD in the volunteer's own time zone (not UTC). */
function localDate(dt) {
  const p = (n) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
}

function storyLine(band, r, tags) {
  const place = band === 'GOOD' ? 'A healthy stretch' : band === 'MODERATE' ? 'A stream holding on' : band === 'POOR' ? 'A stream that needs help' : 'A stream';
  const me = r >= 0.4 ? 'and I left calmer' : r > -0.25 ? 'and I left about the same' : 'and it left me uneasy';
  const why = tags.includes('waterSound') ? ' (the sound of water helped)' : tags.includes('litter') ? ' (litter spoiled it a bit)' : '';
  return `${place}, ${me}${why}.`;
}
