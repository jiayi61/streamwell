// City & research dashboard: where streams stand, what people gain from them,
// which fixes matter most, where lab and citizens disagree, and today's
// safe-blue-walk advisories with what-if scenarios.

import { h, svg, fmt, clear, download, toast, bandBadge, BAND_COLOR, LEVEL_COLOR } from './ui.js';
import { icon } from './icons.js';
import { SITES, SITE_BY_CODE, CITIES, sitesInCity } from './sites.js';
import { HEALTH_RISK, riskBand } from './health-risks.js';
import { siteAggregates, conditionVsRestoration, drivers, labVsCitizen, overdueSites, monthlyHealthMeasures } from './insights.js';
import { advisory, applyScenario, SCENARIOS, LEVELS, saferAlternatives } from './earlywarning.js';
import { scatter, forest } from './charts.js';
import { createMap } from './map.js';
import { healthMeasureBundle } from './fhir.js';
import { mean } from './stats.js';

export function renderCity(root, ctx) {
  const state = { city: 'CO', colorBy: 'advisory', scenario: 'live', period: 'all' };
  const body = h('div');
  root.append(
    h('div', { class: 'row spread' },
      h('div', {}, h('div', { class: 'eyebrow' }, 'City & research dashboard'), h('h1', { style: { fontSize: '34px' } }, 'Streams, people and the link between them')),
    ),
    h('div', { class: 'banner', style: { margin: '10px 0 16px' } },
      h('strong', {}, 'Pilot data is synthetic. '), `Site list and OAH lab health-risk scores are real; the ${fmt.num(ctx.demo ? ctx.demo.visits.length : 0)} visits are simulated (scripts/simulate.py) to show what the pipeline produces. `,
      ctx.weatherLive ? 'Weather is live from Open-Meteo.' : 'Live weather could not be loaded, so advisories use calm placeholder weather.'),
    controls(),
    body,
  );

  function controls() {
    const sel = (label, key, options) => h('label', { class: 'row small' }, h('span', { class: 'muted' }, label),
      h('select', { style: { padding: '8px 10px', borderRadius: '10px', border: '1px solid var(--line)', background: 'var(--surface)' }, onchange: (e) => { state[key] = e.target.value; render(); } },
        options.map(([v, l]) => h('option', { value: v, selected: state[key] === v }, l))));
    return h('div', { class: 'row', style: { gap: '18px', marginBottom: '16px' } },
      sel('City', 'city', [['ALL', 'All five cities'], ...Object.values(CITIES).map((c) => [c.id, c.name])]),
      sel('Period', 'period', [['all', 'Since April 2026'], ['90', 'Last 90 days'], ['30', 'Last 30 days']]),
      sel('Colour map by', 'colorBy', [['advisory', 'Safe-blue-walk advisory'], ['condition', 'Stream condition (citizens)'], ['lab', 'OAH lab health risk']]),
      sel('Weather', 'scenario', Object.entries(SCENARIOS).map(([k, v]) => [k, v.label])));
  }

  function render() {
    clear(body);
    const today = ctx.today;
    const cutoff = state.period === 'all' ? null : new Date(today.getTime() - Number(state.period) * 86400000).toISOString().slice(0, 10);
    const allVisits = ctx.allVisits().filter((v) => !cutoff || v.date >= cutoff);
    const sites = sitesInCity(state.city);
    const codes = new Set(sites.map((s) => s.code));
    const visits = allVisits.filter((v) => codes.has(v.site));
    const agg = siteAggregates(visits, today);
    const weather = applyScenario(ctx.cityWeather, state.scenario);
    const adv = Object.fromEntries(sites.map((s) => [s.code, advisory(s, weather[s.city], HEALTH_RISK[s.code], agg[s.code] || (ctx.aggregates && ctx.aggregates[s.code]))]));
    const advList = Object.values(adv);
    const people = new Set(visits.map((v) => v.person)).size;
    const covered = sites.filter((s) => agg[s.code]).length;
    const overdue = overdueSites(ctx.aggregates || agg, sites);

    body.append(h('div', { class: 'grid grid-4' },
      kpi(fmt.num(visits.length), `paired visits by ${fmt.num(people)} volunteers`),
      kpi(`${covered}/${sites.length}`, 'research sites checked in the period'),
      kpi(fmt.signed(mean(visits.map((v) => restorationOf(v)).filter((x) => x !== null))), 'average restoration per visit (−4 to +4)'),
      kpi(`${advList.filter((a) => a.level === 2).length} · ${advList.filter((a) => a.level === 1).length}`, `sites with "Avoid" · "Care" advisories (${SCENARIOS[state.scenario].label.toLowerCase()})`)));

    // Map + site panel
    const mapEl = h('div', { class: 'map' });
    const panel = h('div', { class: 'card', style: { height: '100%' } }, h('p', { class: 'muted small' }, 'Click a site on the map.'));
    body.append(h('div', { class: 'grid section', style: { gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr)' } },
      h('div', {}, mapEl, legend(state.colorBy)),
      panel));
    const colorFor = (s) => {
      if (state.colorBy === 'advisory') return ['#2f9e44', '#d08b12', '#d9480f'][adv[s.code].level];
      if (state.colorBy === 'lab') { const l = HEALTH_RISK[s.code]; return !l ? '#9aaeb6' : { low: '#2f9e44', elevated: '#d08b12', high: '#d9480f' }[riskBand(l.score)]; }
      const a = agg[s.code];
      if (!a || a.meanScore == null) return '#9aaeb6';
      return a.meanScore >= 67 ? '#2f9e44' : a.meanScore >= 40 ? '#d08b12' : '#d9480f';
    };
    const showSite = (code) => {
      const s = SITE_BY_CODE[code];
      const a = agg[code];
      const l = HEALTH_RISK[code];
      const ad = adv[code];
      const alts = ad.level > 0 ? saferAlternatives(s, advList, SITES) : [];
      clear(panel).append(
        h('div', { class: 'eyebrow' }, `${s.code} · ${CITIES[s.city].name}`),
        h('h3', {}, s.name),
        h('div', { class: 'row', style: { margin: '6px 0 10px' } }, h('span', { class: `badge lvl-${ad.level}` }, ad.label)),
        ad.reasons.length ? h('ul', { class: 'small' }, ad.reasons.map((r) => h('li', {}, r.text, h('span', { class: 'muted tiny' }, ` (${r.source})`)))) : h('p', { class: 'small muted' }, 'No warning signals.'),
        alts.length ? h('p', { class: 'small' }, 'Safer nearby: ', alts.map((x, i) => [i ? ', ' : '', h('strong', {}, x.name)])) : null,
        h('hr', { class: 'sep' }),
        a ? h('div', { class: 'stack small' },
          h('div', {}, 'Citizen view: ', bandBadge(a.meanScore >= 67 ? 'GOOD' : a.meanScore >= 40 ? 'MODERATE' : 'POOR'), ` ${fmt.num(a.meanScore, 0)}/100 over ${a.n} visits`),
          h('div', {}, `Visitors' restoration: ${fmt.signed(a.meanRestoration)} on average (${a.people} people)`),
          h('div', {}, `Last checked ${fmt.date(a.lastDate)}${a.daysSince != null ? ` (${a.daysSince} days ago)` : ''}`),
          topTags(a)) : h('p', { class: 'small muted' }, 'No StreamWell visits in this period.'),
        h('hr', { class: 'sep' }),
        l ? h('div', { class: 'small' }, icon('flask', 'inline'), ` OAH lab (${fmt.date(l.date)}): health risk ${l.score.toFixed(2)} · faecal ${l.fecal.toFixed(2)} · pathogen ${l.pathogen.toFixed(2)} · antibiotic resistance ${l.arg.toFixed(2)}`) : h('p', { class: 'small muted' }, 'No OAH lab sample at this site.'),
      );
    };
    requestAnimationFrame(() => {
      const m = createMap(mapEl, {});
      if (!m) return;
      m.setMarkers(sites.map((s) => ({ code: s.code, lat: s.lat, lon: s.lon, color: colorFor(s), radius: agg[s.code] ? 6 + Math.min(6, Math.sqrt(agg[s.code].n)) : 6, title: `${s.name} (${s.code})` })), (code) => { m.highlight(code); showSite(code); });
      m.fit(sites, state.city === 'ALL' ? 5 : 13);
      const first = advList.sort((a, b) => b.level - a.level)[0];
      if (first) { showSite(first.site); m.highlight(first.site); }
    });

    // One Health link
    const cvr = conditionVsRestoration(agg, state.city === 'ALL' ? 5 : 3);
    const pts = cvr.points.map((p) => ({ x: p.meanScore, y: p.meanRestoration, r: 4 + Math.min(6, Math.sqrt(p.n)), color: BAND_COLOR[p.meanScore >= 67 ? 'GOOD' : p.meanScore >= 40 ? 'MODERATE' : 'POOR'], title: `${SITE_BY_CODE[p.site].name}: condition ${p.meanScore}, restoration ${fmt.signed(p.meanRestoration)}, ${p.n} visits` }));
    const dr = visits.length >= 150 ? drivers(visits) : null;
    body.append(h('div', { class: 'grid grid-2 section' },
      h('div', { class: 'card' },
        h('div', { class: 'card-head' }, h('h3', {}, 'Healthier streams, more restored people'), h('span', { class: 'badge info' }, `ρ = ${cvr.rho ?? '—'}`)),
        pts.length >= 3 ? svg(scatter({ points: pts, xLabel: 'Stream condition (citizen view, 0-100)', yLabel: 'Mean restoration', xDomain: [20, 95], yDomain: [Math.min(-0.2, ...pts.map((p) => p.y)) - 0.05, Math.max(...pts.map((p) => p.y)) + 0.1] })) : h('p', { class: 'muted' }, 'Too few sites with visits in this selection.'),
        h('p', { class: 'small muted' }, `Each dot is a site (size = visits). Spearman ρ = ${cvr.rho ?? '—'} across ${cvr.n} sites${cvr.ci && cvr.ci[0] != null ? `, 95% bootstrap CI ${cvr.ci[0]} to ${cvr.ci[1]}` : ''}. This is the OneAquaHealth hypothesis made measurable, visit by visit.`)),
      h('div', { class: 'card' },
        h('div', { class: 'card-head' }, h('h3', {}, 'What would help people most'), dr ? h('span', { class: 'small muted' }, `${fmt.num(dr.n)} visits, ${dr.people} volunteers`) : null),
        dr ? svg(forest({ rows: [...dr.rows].sort((a, b) => a.effect - b.effect).map((r) => ({ label: r.label, effect: r.effect, lo: r.lo, hi: r.hi, emphasis: !!r.fixable })), xLabel: 'Change in restoration when the feature is present (95% CI)' })) : h('p', { class: 'muted' }, 'Needs at least 150 visits in the selection.'),
        dr ? h('p', { class: 'small muted' }, `Linear model of each visit's restoration on stream features and experience tags, adjusted for ${dr.adjust.join(', ')}; intervals from a bootstrap over volunteers (${dr.reps} draws). Associations, not proof of cause. Bold rows are things a city can change.`) : null,
        dr ? actionList(dr) : null)));

    // Lab vs citizens + missions
    const lv = labVsCitizen(agg);
    body.append(h('div', { class: 'grid grid-2 section' },
      h('div', { class: 'card' },
        h('h3', {}, 'Where the lab and citizens disagree'),
        h('p', { class: 'small muted' }, `Citizen condition vs OAH lab health risk: ρ = ${lv.rho ?? '—'} (${lv.n} sites; positive means citizens see healthier streams where the lab finds lower risk). Disagreements are where action pays off.`),
        h('h4', { style: { marginTop: '10px' } }, 'Looks fine, lab says risky'),
        lv.hiddenRisk.length ? h('ul', { class: 'small' }, lv.hiddenRisk.slice(0, 5).map((p) => h('li', {}, h('strong', {}, SITE_BY_CODE[p.site].name), ` (${p.site}): citizens ${fmt.num(p.meanScore, 0)}/100, lab risk ${p.lab.score.toFixed(2)} → signs at access points; prioritise for re-sampling`))) : h('p', { class: 'small muted' }, 'None in this selection.'),
        h('h4', { style: { marginTop: '10px' } }, 'Looks bad, lab has no signal'),
        lv.unsampledConcern.length ? h('ul', { class: 'small' }, lv.unsampledConcern.slice(0, 5).map((p) => h('li', {}, h('strong', {}, SITE_BY_CODE[p.site].name), ` (${p.site}): citizens ${fmt.num(p.meanScore, 0)}/100, lab ${p.lab ? p.lab.score.toFixed(2) : 'never sampled'} → send the next lab visit here`))) : h('p', { class: 'small muted' }, 'None in this selection.')),
      h('div', { class: 'card' },
        h('h3', {}, 'Data gaps → volunteer missions'),
        h('p', { class: 'small muted' }, 'Sites not checked for 30 days or more. StreamWell turns them into missions in the volunteers’ journals, so effort goes where data is missing.'),
        overdue.length ? h('ul', { class: 'small' }, overdue.slice(0, 8).map((s) => h('li', {}, h('strong', {}, s.name), ` (${s.code}) · `, s.agg ? `${s.agg.daysSince} days since last check` : 'never checked'))) : h('p', { class: 'small' }, 'No gaps: every site was checked in the last 30 days.'))));

    // Health measures (k-anonymous) for OAH
    const measures = monthlyHealthMeasures(visits).filter((m) => m.month >= '2026-07');
    body.append(h('div', { class: 'card section' },
      h('div', { class: 'card-head' }, h('h3', {}, 'Health measures for OneAquaHealth (k ≥ 5 visitors)'),
        h('button', { class: 'btn small', onclick: () => exportMeasures(measures) }, icon('download'), 'Export FHIR (ObservationHealthMeasureOah)')),
      h('p', { class: 'small muted' }, 'Monthly site averages of the de-identified well-being data volunteers chose to donate. Cells with fewer than five different visitors are suppressed. Exported on the OAH IG profiles with a GroupOah cohort per site.'),
      h('div', { class: 'table-wrap' }, h('table', { class: 'table' },
        h('thead', {}, h('tr', {}, h('th', {}, 'Month'), h('th', {}, 'Site'), h('th', {}, 'Visitors'), h('th', {}, 'Mean restoration'), h('th', {}, 'Felt better'), h('th', {}, 'Came on foot / bike'))),
        h('tbody', {}, measures.slice(0, 14).map((m) => h('tr', {},
          h('td', {}, m.month), h('td', {}, `${m.name} (${m.site})`), h('td', {}, String(m.people)),
          m.suppressed ? h('td', { colspan: '3', class: 'muted' }, 'Suppressed: fewer than 5 visitors') : [h('td', {}, fmt.signed(m.meanRestoration)), h('td', {}, fmt.pct(m.shareRestored)), h('td', {}, fmt.pct(m.activeShare))])))))));
  }

  function exportMeasures(measures) {
    const ok = measures.filter((m) => !m.suppressed);
    if (!ok.length) { toast('No unsuppressed cells to export'); return; }
    const entries = new Map();
    for (const m of ok) {
      const [y, mo] = m.month.split('-').map(Number);
      const end = new Date(Date.UTC(y, mo, 0)).toISOString().slice(0, 10);
      const b = healthMeasureBundle(m, { id: m.month, label: m.month, start: `${m.month}-01`, end });
      b.entry.forEach((e) => entries.set(`${e.resource.resourceType}/${e.resource.id}`, e));
    }
    download(`streamwell-health-measures-${state.city}.json`, { resourceType: 'Bundle', type: 'collection', timestamp: new Date().toISOString(), entry: [...entries.values()] });
  }

  render();
}

function restorationOf(v) { return v.before && v.after ? ((v.after.joy + v.after.serenity - v.after.anger - v.after.fear) - (v.before.joy + v.before.serenity - v.before.anger - v.before.fear)) / 4 : null; }

function kpi(v, l) { return h('div', { class: 'card kpi' }, h('div', { class: 'v' }, v), h('div', { class: 'l' }, l)); }

function legend(by) {
  const items = by === 'advisory' ? LEVELS.map((l, i) => [LEVEL_COLOR[i], l.label]) : by === 'lab' ? [['var(--good)', 'Low risk (< 0.30)'], ['var(--moderate)', 'Elevated (0.30-0.45)'], ['var(--poor)', 'High (≥ 0.45)'], ['#9aaeb6', 'Not sampled']] : [['var(--good)', 'Good (≥ 67)'], ['var(--moderate)', 'Moderate (40-66)'], ['var(--poor)', 'Poor (< 40)'], ['#9aaeb6', 'No visits']];
  return h('div', { class: 'map-legend' }, items.map(([c, l]) => h('span', {}, h('span', { class: 'legend-swatch', style: { background: c } }), l)));
}

function topTags(a) {
  const labels = { waterSound: 'sound of water', birds: 'birds', shade: 'shade', quiet: 'quiet', clean: 'clean', litter: 'litter', smell: 'bad smell', noise: 'traffic noise', unsafe: 'felt unsafe', concrete: 'concrete' };
  const top = Object.entries(a.tagShare || {}).sort((x, y) => y[1] - x[1]).slice(0, 3);
  return top.length ? h('div', {}, 'Most mentioned: ', top.map(([k, v], i) => `${i ? ', ' : ''}${labels[k] || k} (${Math.round(v * 100)}%)`).join('')) : null;
}

function actionList(dr) {
  const fixes = dr.rows.filter((r) => r.fixable && r.clear && r.effect < 0).sort((a, b) => a.effect - b.effect).slice(0, 3);
  const keep = dr.rows.filter((r) => r.fixable && r.clear && r.effect > 0).sort((a, b) => b.effect - a.effect).slice(0, 2);
  if (!fixes.length && !keep.length) return null;
  return h('div', { class: 'small', style: { marginTop: '8px' } },
    h('strong', {}, 'Translated into action: '),
    h('ul', {},
      fixes.map((r) => h('li', {}, `${r.fixable}: visits with ${r.label.toLowerCase()} restore ${Math.abs(r.effect).toFixed(2)} points less (seen in ${Math.round(r.prevalence * 100)}% of visits).`)),
      keep.map((r) => h('li', {}, `${r.fixable}: ${r.label.toLowerCase()} adds ${r.effect.toFixed(2)} points.`))));
}
