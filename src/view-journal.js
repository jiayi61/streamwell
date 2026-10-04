// The volunteer's journal: personal (n-of-1) insights, streaks, streams they
// look after, missions, and the blue-prescription programme with WHO-5.

import { h, svg, fmt, toast, put, BAND_COLOR, bandBadge } from './ui.js';
import { icon } from './icons.js';
import { SITE_BY_CODE, CITIES, sitesInCity } from './sites.js';
import { personalInsights, enrich, overdueSites } from './insights.js';
import { WHO5, who5Score, who5Change, restorationLabel } from './wellbeing.js';
import { timeline } from './charts.js';
import { store } from './store.js';

export const DEMO_RX = {
  start: '2026-08-17',
  end: '2026-10-12',
  perWeek: 2,
  weeks: 8,
  sites: ['C3', 'C10', 'C15'],
  who5Baseline: { date: '2026-08-17', score: 44, responses: { 'who5-1': 2, 'who5-2': 3, 'who5-3': 2, 'who5-4': 2, 'who5-5': 2 } },
  who5FollowUp: { date: '2026-09-28', score: 60, responses: { 'who5-1': 3, 'who5-2': 3, 'who5-3': 3, 'who5-4': 3, 'who5-5': 3 } },
};

export function journalVisits(ctx) {
  const own = store.visits();
  const settings = store.settings();
  const demo = settings.includeDemo !== false && ctx.demo ? ctx.demo.visits.filter((v) => v.person === ctx.demo.demoPerson) : [];
  return [...demo, ...own];
}

export function renderJournal(root, ctx) {
  const settings = store.settings();
  const visits = journalVisits(ctx);
  const pi = personalInsights(visits, ctx.today);
  const own = store.visits();

  put(root,
    h('div', { class: 'row spread' },
      h('div', {}, h('div', { class: 'eyebrow' }, 'Your journal'), h('h1', { style: { fontSize: '34px' } }, 'How the streams treat you')),
      h('label', { class: 'row small' }, h('input', { type: 'checkbox', checked: settings.includeDemo !== false, onchange: (e) => { store.setSetting('includeDemo', e.target.checked); location.reload(); } }), 'Include the demo journal')),
    settings.includeDemo !== false ? h('div', { class: 'banner info', style: { margin: '10px 0 16px' } },
      h('strong', {}, 'Demo journal. '), 'The 14 Coimbra visits below are synthetic, so you can see what a few weeks of StreamWell look like. ',
      own.length ? `Your own ${own.length} visit${own.length === 1 ? ' is' : 's are'} included.` : 'Your own visits will appear here after you save one.') : null,
  );

  if (!pi.n) {
    root.append(h('div', { class: 'card empty' }, h('p', {}, 'No visits yet.'), h('a', { class: 'btn primary', href: '#/visit' }, 'Start your first visit')));
    return;
  }

  root.append(
    h('div', { class: 'grid grid-4' },
      kpi(fmt.num(pi.n), 'visits, each a stream check for OneAquaHealth'),
      kpi(`${pi.streakWeeks} wk`, 'streak of weeks with a visit'),
      kpi(fmt.signed(pi.meanRestoration), `average restoration (${fmt.pct(pi.shareBetter)} of visits left you better)`),
      kpi(`${fmt.num(pi.activeMinutes)} min`, 'at streams you walked or cycled to')),
  );

  const items = pi.visits.map((v) => ({ label: fmt.shortDate(v.date), value: v.restoration, color: BAND_COLOR[v.band] || 'var(--brand)', title: `${SITE_BY_CODE[v.site].name}, ${fmt.date(v.date)}: ${fmt.signed(v.restoration)} (${restorationLabel(v.restoration)}), stream ${v.band || '—'}` }));
  root.append(h('div', { class: 'card section' },
    h('div', { class: 'card-head' }, h('h3', {}, 'Restoration per visit'), h('span', { class: 'small muted' }, 'Bar colour = stream condition (green good, amber moderate, red poor)')),
    svg(timeline({ items, width: 1000, height: 230 }))));

  // Personal insights
  const insightCards = pi.contrasts.slice(0, 4).map((c) => {
    const clear = c.lo > 0 || c.hi < 0;
    const more = c.diff > 0;
    return h('div', { class: 'card' },
      h('div', { class: 'eyebrow' }, clear ? 'Clear pattern' : 'Not clear yet'),
      h('h3', {}, `${c.label}: ${fmt.signed(c.diff)}`),
      h('p', { class: 'small muted' },
        `Visits with ${c.label.toLowerCase()} restored you ${Math.abs(c.diff).toFixed(2)} points ${more ? 'more' : 'less'} on average (95% CI ${c.lo.toFixed(2)} to ${c.hi.toFixed(2)}; ${c.nA} vs ${c.nB} visits). `,
        clear ? '' : 'The interval crosses zero, so a few more visits will tell.'));
  });
  root.append(h('section', { class: 'section' }, h('h2', {}, 'What restores you'), h('p', { class: 'muted' }, 'Your own before/after numbers, compared across your visits. Personal patterns, not medical advice.'), h('div', { class: 'grid grid-2' }, insightCards)));

  // Streams and missions
  const advisory = (code) => ctx.advisories && ctx.advisories[code];
  const goSites = pi.sites.filter((s) => !advisory(s.site) || advisory(s.site).level === 0).sort((a, b) => b.mean - a.mean);
  const nextSite = goSites[0];
  const homeCity = SITE_BY_CODE[pi.sites[0].site].city;
  const missions = ctx.aggregates ? overdueSites(ctx.aggregates, sitesInCity(homeCity)).slice(0, 4) : [];
  root.append(h('section', { class: 'section grid grid-2' },
    h('div', { class: 'card' },
      h('h3', {}, 'Your streams'),
      h('div', { class: 'table-wrap' }, h('table', { class: 'table' },
        h('thead', {}, h('tr', {}, h('th', {}, 'Stream'), h('th', {}, 'Visits'), h('th', {}, 'Avg restoration'), h('th', {}, 'Today'))),
        h('tbody', {}, pi.sites.map((s) => {
          const a = advisory(s.site);
          return h('tr', {}, h('td', {}, SITE_BY_CODE[s.site].name, s.n >= 3 ? h('span', { class: 'badge good', style: { marginLeft: '6px' } }, 'Adopted') : null), h('td', {}, String(s.n)), h('td', {}, fmt.signed(s.mean)), h('td', {}, a ? h('span', { class: `badge lvl-${a.level}` }, a.short) : '—'));
        })))),
      nextSite ? h('p', { class: 'small', style: { marginTop: '10px' } }, icon('pin', 'inline'), ' Next walk: ', h('strong', {}, SITE_BY_CODE[nextSite.site].name), ` restores you most (${fmt.signed(nextSite.mean)}) and is good for a walk today.`) : null),
    h('div', { class: 'card' },
      h('h3', {}, `Missions in ${CITIES[homeCity].name}`),
      h('p', { class: 'small muted' }, 'Streams nobody has checked for 30 days or more. One visit fills a gap in the OneAquaHealth record.'),
      missions.length ? h('ul', { class: 'small' }, missions.map((m) => h('li', {}, h('strong', {}, m.name), ` (${m.code}) · `, m.agg ? `last checked ${m.agg.daysSince} days ago` : 'never checked'))) : h('p', { class: 'small' }, 'Every stream in your city was checked this month.'),
      h('a', { class: 'btn small', href: '#/visit' }, 'Start a visit')),
  ));

  // Blue prescription
  if (settings.includeDemo !== false) root.append(bluePrescription(visits, ctx));

  // Visit list
  root.append(h('section', { class: 'section card' },
    h('h3', {}, 'All visits'),
    h('div', { class: 'table-wrap' }, h('table', { class: 'table' },
      h('thead', {}, h('tr', {}, h('th', {}, 'Date'), h('th', {}, 'Stream'), h('th', {}, 'Condition'), h('th', {}, 'Restoration'), h('th', {}, ''))),
      h('tbody', {}, [...pi.visits].reverse().map((v) => h('tr', {},
        h('td', {}, fmt.date(v.date)), h('td', {}, SITE_BY_CODE[v.site].name, v.synthetic ? h('span', { class: 'tiny muted' }, ' · demo') : null),
        h('td', {}, bandBadge(v.band)), h('td', {}, fmt.signed(v.restoration)),
        h('td', {}, v.synthetic ? '' : h('button', { class: 'btn small ghost', onclick: () => { store.deleteVisit(v.id); toast('Visit deleted'); location.reload(); } }, 'Delete')))))))));
}

function kpi(v, l) { return h('div', { class: 'card kpi' }, h('div', { class: 'v' }, v), h('div', { class: 'l' }, l)); }

function bluePrescription(visits, ctx) {
  const rx = DEMO_RX;
  const done = visits.filter((v) => v.date >= rx.start).length;
  const target = rx.perWeek * rx.weeks;
  const own = store.who5();
  const latest = own.length ? own[own.length - 1] : rx.who5FollowUp;
  const change = who5Change(rx.who5Baseline.score, latest.score);
  const formWrap = h('div');
  const openForm = () => {
    const answers = {};
    const form = h('div', { class: 'stack', style: { marginTop: '12px' } },
      h('p', { class: 'small muted' }, `${WHO5.period}, how often has each been true for you?`),
      ...WHO5.items.map((it) => h('div', {},
        h('div', { class: 'small', style: { fontWeight: 600 } }, it.text),
        h('div', { class: 'pill-row', style: { marginTop: '4px' } }, WHO5.answers.map((a) => {
          const b = h('button', { class: 'tag pos', 'aria-pressed': 'false', onclick: () => { answers[it.id] = a.value; b.parentElement.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', 'false')); b.setAttribute('aria-pressed', 'true'); } }, a.label);
          return b;
        })))),
      h('button', { class: 'btn primary small', onclick: () => {
        const score = who5Score(answers);
        if (score === null) { toast('Please answer all five'); return; }
        store.addWho5({ date: new Date().toISOString().slice(0, 10), score, responses: answers });
        toast(`WHO-5 saved: ${score}/100`);
        location.reload();
      } }, 'Save my WHO-5'),
      h('p', { class: 'tiny muted' }, `WHO-5 Well-Being Index, free to use. ${WHO5.citation} A score of 50 or less is a reason to talk to your doctor.`));
    formWrap.replaceChildren(form);
  };
  return h('section', { class: 'section card' },
    h('div', { class: 'card-head' },
      h('div', {}, h('div', { class: 'eyebrow' }, 'Blue prescription · demo'), h('h3', {}, 'Stream walks, prescribed')),
      h('span', { class: 'badge info' }, 'Fictional GP: Dr. Demo')),
    h('div', { class: 'grid grid-3' },
      h('div', { class: 'kpi' }, h('div', { class: 'v' }, `${done}/${target}`), h('div', { class: 'l' }, `walks since ${fmt.date(rx.start)} (${rx.perWeek} a week for ${rx.weeks} weeks)`)),
      h('div', { class: 'kpi' }, h('div', { class: 'v' }, `${rx.who5Baseline.score} → ${latest.score}`), h('div', { class: 'l' }, `WHO-5 well-being (0-100), ${fmt.date(rx.who5Baseline.date)} → ${fmt.date(latest.date)}`)),
      h('div', { class: 'kpi' }, h('div', { class: 'v', style: { color: change && change.delta >= 10 ? 'var(--good)' : 'var(--text)' } }, change ? fmt.signed(change.delta, 0) : '—'), h('div', { class: 'l' }, change && change.meaningful ? 'a meaningful change (10 points or more)' : 'change so far'))),
    h('p', { class: 'small muted', style: { marginTop: '10px' } }, 'A GP can prescribe regular walks along healthy streams (nature-based social prescribing). StreamWell suggests streams with a "Go" advisory, records each walk with the same check-in, and returns a FHIR CarePlan with outcomes to the GP only if you share it.'),
    h('div', { class: 'row' },
      h('button', { class: 'btn small', onclick: openForm }, 'Take the WHO-5 now'),
      h('a', { class: 'btn small', href: '#/fhir?tab=rx' }, icon('share'), 'Share progress with my GP (FHIR)')),
    formWrap);
}
