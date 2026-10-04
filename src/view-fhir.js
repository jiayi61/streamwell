// FHIR explorer: the four StreamWell bundles, their structural validation
// against the OneAquaHealth IG profiles, live checks against a public FHIR
// test server, and our proposed additions to the IG.

import { h, svg, clear, jsonBlock, download, toast } from './ui.js';
import { icon } from './icons.js';
import { streamBundle, personalBundle, healthMeasureBundle, bluePrescriptionBundle, toTransaction, OAH } from './fhir.js';
import { validateBundle } from './validate.js';
import { monthlyHealthMeasures } from './insights.js';
import { DEMO_RX, journalVisits } from './view-journal.js';
import { store } from './store.js';

const HAPI = 'https://hapi.fhir.org/baseR4';

export function renderFhir(root, ctx, params) {
  const visits = journalVisits(ctx);
  const own = store.visits();
  const sample = own.length ? own[own.length - 1] : visits[visits.length - 1] || (ctx.demo && ctx.demo.visits[ctx.demo.visits.length - 1]);
  const measures = monthlyHealthMeasures(ctx.allVisits()).filter((m) => !m.suppressed);
  const m0 = measures[0];
  const period = m0 ? (() => { const [y, mo] = m0.month.split('-').map(Number); return { id: m0.month, label: m0.month, start: `${m0.month}-01`, end: new Date(Date.UTC(y, mo, 0)).toISOString().slice(0, 10) }; })() : null;
  const rxVisits = visits.filter((v) => v.date >= DEMO_RX.start);

  const TABS = [
    { id: 'stream', label: 'Stream observation', who: 'OneAquaHealth research', privacy: 'No personal data', build: () => streamBundle(sample),
      text: 'One LocationOah for the research site and one ObservationIndicatorsOah per OAH indicator (hydrology, morphology, riparian vegetation, land use, foam/colour/smell, invasive organisms), coded with the IG’s TemporaryOahSystem. Answers keep the OAH Citizen Science App codes (NAT, FAS, CL…); "not sure" becomes data-absent-reason asked-unknown; second-look decisions travel as notes. The StreamWell condition view is a separate, derived Observation.' },
    { id: 'personal', label: 'My well-being record', who: 'The volunteer (and their GP if they choose)', privacy: 'Personal health data, stays on the phone', build: () => personalBundle(sample),
      text: 'A pseudonymous Patient, the check-in Questionnaire and its QuestionnaireResponse, and an Observation of the restoration change linked to the stream with the core event-location extension. Exported only by the person.' },
    { id: 'measures', label: 'Health measures', who: 'OneAquaHealth research, public health', privacy: 'Aggregated, k ≥ 5 visitors', build: () => (m0 ? healthMeasureBundle(m0, period) : null),
      text: 'ObservationHealthMeasureOah per site and month with a GroupOah cohort (adult visitors of that site, LOINC 30525-0 age ≥ 18). Values: mean restoration, share of visits that left people better, share reached on foot or bike (physical activity). Cells under five visitors are masked.' },
    { id: 'rx', label: 'Blue prescription', who: 'GP and patient', privacy: 'Shared by the patient', build: () => bluePrescriptionBundle({ start: DEMO_RX.start, end: DEMO_RX.end, sites: DEMO_RX.sites, who5Baseline: DEMO_RX.who5Baseline, who5FollowUp: DEMO_RX.who5FollowUp, visits: rxVisits }),
      text: 'A CarePlan (category blue-prescription) from a fictional GP: stream walks twice a week, a Goal of +10 WHO-5 points, WHO-5 QuestionnaireResponses at start and follow-up, every walk’s restoration Observation as activity outcome, and an opt-in Consent.' },
    { id: 'ig', label: 'Proposed IG additions', who: 'hl7-eu/oah maintainers', privacy: '—', build: () => null, text: '' },
  ];

  let tab = (params && params.get('tab')) || 'stream';
  const body = h('div');
  const tabsEl = h('div', { class: 'tabs', role: 'tablist' });
  root.append(
    h('div', {}, h('div', { class: 'eyebrow' }, 'HL7 FHIR R4 · OneAquaHealth IG'), h('h1', { style: { fontSize: '34px' } }, 'One Digital Health, in standard form')),
    h('p', { class: 'lead' }, 'Each StreamWell visit produces two kinds of records with two privacy levels: stream observations for OneAquaHealth, and a personal well-being record that only the volunteer controls. Aggregates and prescriptions connect them to public health and primary care.'),
    h('div', { class: 'card flat section' }, svg(diagram())),
    h('div', { class: 'section' }, tabsEl, body),
  );

  function renderTabs() {
    clear(tabsEl).append(...TABS.map((t) => h('button', { role: 'tab', 'aria-selected': String(tab === t.id), onclick: () => { tab = t.id; renderTabs(); renderBody(); } }, t.label)));
  }

  function renderBody() {
    clear(body);
    const t = TABS.find((x) => x.id === tab);
    if (t.id === 'ig') { body.append(igProposal()); return; }
    const bundle = t.build();
    if (!bundle) { body.append(h('p', { class: 'muted' }, 'No data for this bundle yet.')); return; }
    const v = validateBundle(bundle);
    const result = h('div', { class: 'small' });
    const counts = bundle.entry.reduce((m, e) => ({ ...m, [e.resource.resourceType]: (m[e.resource.resourceType] || 0) + 1 }), {});
    body.append(h('div', { class: 'grid', style: { gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.25fr)' } },
      h('div', { class: 'stack' },
        h('div', { class: 'row' }, h('span', { class: 'badge info' }, t.who), h('span', { class: 'badge neutral' }, t.privacy)),
        h('p', { class: 'small' }, t.text),
        h('p', { class: 'small muted' }, `${bundle.entry.length} resources: ${Object.entries(counts).map(([k, n]) => `${n} ${k}`).join(', ')}.`),
        h('div', { class: 'card flat' },
          h('div', { class: 'row spread' }, h('strong', {}, 'Structural validation'), h('span', { class: `badge ${v.ok ? 'good' : 'poor'}` }, v.ok ? `${v.checked} checks passed` : `${v.errors.length} of ${v.checked} failed`)),
          h('p', { class: 'tiny muted' }, 'Rules of the OAH profiles claimed in meta.profile (LocationOah, ObservationIndicatorsOah, ObservationHealthMeasureOah, GroupOah), FHIR R4 basics, and that every reference resolves inside the bundle.'),
          h('details', {}, h('summary', { class: 'small' }, 'Show all checks'),
            h('div', { class: 'checklist' }, v.results.map((r) => h('div', {}, h('span', { class: r.ok ? 'okk' : 'bad' }, r.ok ? '✓ ' : '✗ '), h('span', { class: 'muted' }, `${r.resource}: `), r.rule))))),
        h('div', { class: 'row' },
          h('button', { class: 'btn small', onclick: () => download(`streamwell-${t.id}-bundle.json`, bundle) }, icon('download'), 'Download JSON'),
          h('button', { class: 'btn small', onclick: () => hapiValidate(bundle, result) }, 'Validate on public HAPI (base R4)'),
          h('button', { class: 'btn small', onclick: () => hapiSend(bundle, result) }, 'Send to HAPI test server')),
        h('p', { class: 'tiny muted' }, 'HAPI is a public test server: only demo or synthetic records, never real personal data. The OAH profiles are not loaded there, so it checks base FHIR R4 and reports the profiles as unknown.'),
        result),
      h('div', {}, jsonBlock(bundle))));
  }

  renderTabs();
  renderBody();
}

async function hapiValidate(bundle, out) {
  out.replaceChildren(h('p', { class: 'muted' }, 'Validating on hapi.fhir.org…'));
  try {
    const res = await fetch(`${HAPI}/Bundle/$validate`, { method: 'POST', headers: { 'Content-Type': 'application/fhir+json', Accept: 'application/fhir+json' }, body: JSON.stringify(bundle) });
    const oo = await res.json();
    const issues = oo.issue || [];
    const by = (s) => issues.filter((i) => i.severity === s);
    out.replaceChildren(
      h('p', {}, h('strong', {}, `HAPI says: ${by('error').length + by('fatal').length} errors, ${by('warning').length} warnings, ${by('information').length} notes`), ` (HTTP ${res.status})`),
      h('ul', { class: 'tiny' }, [...by('fatal'), ...by('error'), ...by('warning')].slice(0, 10).map((i) => h('li', {}, `${i.severity}: ${i.diagnostics || (i.details && i.details.text) || ''}`.slice(0, 260)))));
  } catch (e) {
    out.replaceChildren(h('p', { class: 'muted' }, `Could not reach hapi.fhir.org (${e.message}). The bundle still validates locally.`));
  }
}

async function hapiSend(bundle, out) {
  if (!window.confirm('Send this demo bundle to the public HAPI FHIR test server (hapi.fhir.org)? Only use demo or synthetic data.')) return;
  out.replaceChildren(h('p', { class: 'muted' }, 'Sending transaction to hapi.fhir.org…'));
  try {
    const res = await fetch(HAPI, { method: 'POST', headers: { 'Content-Type': 'application/fhir+json', Accept: 'application/fhir+json' }, body: JSON.stringify(toTransaction(bundle)) });
    const j = await res.json();
    if (!res.ok) throw new Error((j.issue && j.issue[0] && j.issue[0].diagnostics) || `HTTP ${res.status}`);
    const locs = (j.entry || []).map((e) => e.response && e.response.location).filter(Boolean);
    out.replaceChildren(
      h('p', {}, h('strong', {}, `Stored ${locs.length} resources on the test server.`)),
      h('ul', { class: 'tiny' }, locs.slice(0, 8).map((l) => { const url = `${HAPI}/${l.split('/_history')[0]}`; return h('li', {}, h('a', { href: url, target: '_blank', rel: 'noopener' }, url)); })));
    toast('Sent to HAPI test server');
  } catch (e) {
    out.replaceChildren(h('p', { class: 'muted' }, `Send failed: ${e.message}`));
  }
}

function igProposal() {
  const fsh = `// Proposed additions to hl7-eu/oah from StreamWell (IEEE OneAquaHealth Hackathon 2026)

// 1. Well-being measured at the stream, per visit and aggregated per site
//    (add to TemporaryOahSystem and to HealthIndicatorsOahVs)
* #restorative-experience "Restoration at an urban stream" "Mean change in self-rated joy, serenity, anger (reversed) and fear (reversed) from before to after a stream visit, scale -4..4. The four items are those of the OAH Citizen Science App."
* #restored-share "% of stream visits after which the visitor felt better"
* #active-travel-share "% of stream visits reached on foot or by bike"

// 2. The Citizen Science App answer codes as a published CodeSystem, so citizen
//    observations can be validated against the app's own vocabulary
CodeSystem: OahCitizenAnswerCs
Id: oah-citizen-answer
* #FAS "Fast (with waves or high velocity)"
* #NOR "Slow"
* #STA "Stagnant/intermittent"
* #DRY "Dry"
* #CL "Clear/transparent"
* #MU "Muddy/turbid"
* #FO "Has foam"
* #CO "Has colors/altered color"
// ... channel forms, bed and bank types, habitats, fallen biomass,
//     vegetation types, overall assessment (see fhir/CodeSystem-oah-citizen-answer.json)

// 3. A cohort characteristic for "people who visited this site in the period"
//    (add to OahCohortCharacteristicCodeVs, extensible)
* #visited-location "Visited location during the period"

// 4. Allow a citizen-science category on ObservationIndicatorsOah, and a
//    Questionnaire for the citizen stream form, so app submissions map 1:1.`;
  return h('div', { class: 'grid grid-2' },
    h('div', { class: 'stack small' },
      h('p', {}, 'Building StreamWell on the OneAquaHealth Implementation Guide showed four small gaps. Each is written as FSH so the IG maintainers can take it as is:'),
      h('ol', {},
        h('li', {}, h('strong', {}, 'Well-being at the stream. '), 'HealthIndicatorsOahVs covers prevalence, mortality and hospitalisation, but not the restorative experience and physical activity the OAH health protocol names. Three codes close that gap.'),
        h('li', {}, h('strong', {}, 'App answer codes. '), 'The Citizen Science App’s codes (FAS, CL, NAT…) live only in the app API. Publishing them as a CodeSystem makes citizen data checkable.'),
        h('li', {}, h('strong', {}, 'Visitor cohorts. '), 'GroupOah defines cohorts by age, sex and living place; site visitors need a "visited location" characteristic.'),
        h('li', {}, h('strong', {}, 'Citizen category and Questionnaire. '), 'Lets every app submission round-trip through FHIR without loss.')),
      h('p', { class: 'muted' }, `Profiles used: ${[OAH.location, OAH.indicator, OAH.healthMeasure, OAH.group].map((u) => u.split('/').pop()).join(', ')}.`),
      h('a', { class: 'btn small', href: 'https://github.com/hl7-eu/oah', target: '_blank', rel: 'noopener' }, 'hl7-eu/oah on GitHub')),
    h('pre', { class: 'code' }, fsh));
}

function diagram() {
  const box = (x, y, w, t, sub, c) => `<g><rect x="${x}" y="${y}" width="${w}" height="64" rx="12" fill="var(--surface)" stroke="${c}" stroke-width="2"/><text x="${x + 12}" y="${y + 26}" style="font: 700 14px var(--font); fill: var(--text)">${t}</text><text x="${x + 12}" y="${y + 46}" style="font: 12px var(--font); fill: var(--muted)">${sub}</text></g>`;
  const pill = (x, y, label) => {
    const w = label.length * 6.1 + 14;
    return `<rect x="${x - w / 2}" y="${y - 10}" width="${w}" height="20" rx="10" fill="var(--surface)" stroke="var(--line)"/><text x="${x}" y="${y + 4}" text-anchor="middle" style="font: 11px var(--font); fill: var(--muted)">${label}</text>`;
  };
  const arrow = (x1, y1, x2, y2, label) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="var(--muted)" stroke-width="1.6" marker-end="url(#ah)"/>${label ? pill((x1 + x2) / 2, (y1 + y2) / 2, label) : ''}`;
  return `<svg viewBox="0 0 980 250" class="chart" role="img" aria-label="Data flows from a StreamWell visit">
  <defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="var(--muted)"/></marker></defs>
  ${box(10, 93, 180, 'StreamWell visit', 'stream check + check-in/out', 'var(--brand)')}
  ${box(300, 10, 240, 'Stream observations', 'LocationOah · ObservationIndicatorsOah', 'var(--good)')}
  ${box(300, 176, 240, 'Personal well-being record', 'QuestionnaireResponse · Observation', 'var(--moderate)')}
  ${box(650, 10, 320, 'OneAquaHealth research', 'condition, lab overlay, early warning', 'var(--good)')}
  ${box(650, 93, 320, 'Health measures (k ≥ 5)', 'ObservationHealthMeasureOah · GroupOah', 'var(--info)')}
  ${box(650, 176, 320, 'GP: blue prescription', 'CarePlan · Goal · WHO-5 · Consent', 'var(--moderate)')}
  ${arrow(190, 112, 298, 46, 'shared, opt-out')}
  ${arrow(190, 140, 298, 204, 'stays on phone')}
  ${arrow(540, 42, 648, 42, '')}
  ${arrow(540, 196, 648, 132, 'donate, opt-in')}
  ${arrow(540, 214, 648, 214, 'share, opt-in')}
</svg>`;
}
