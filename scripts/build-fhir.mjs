// Generate StreamWell's FHIR conformance resources and example bundles from
// the source code, so the published files never drift from what the app emits.
// Usage: node scripts/build-fhir.mjs   ->  fhir/*.json
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { QUESTIONS } from '../src/protocol.js';
import { TAGS, TRAVEL, WHO5 } from '../src/wellbeing.js';
import { SITE_BY_CODE } from '../src/sites.js';
import { decodeDataset } from '../src/demo-data.js';
import { monthlyHealthMeasures } from '../src/insights.js';
import { SW, SW_BASE, visitQuestionnaire, who5Questionnaire, streamBundle, personalBundle, healthMeasureBundle, bluePrescriptionBundle } from '../src/fhir.js';
import { validateBundle } from '../src/validate.js';

const out = new URL('../fhir/', import.meta.url);
mkdirSync(out, { recursive: true });
const write = (name, obj) => writeFileSync(new URL(name, out), `${JSON.stringify(obj, null, 2)}\n`);

// --- CodeSystem: OAH Citizen Science App answer codes -------------------------
const answerConcepts = new Map();
for (const q of QUESTIONS) {
  for (const o of q.options || []) {
    if (!answerConcepts.has(o.code)) answerConcepts.set(o.code, { code: o.code, display: o.oahLabel, definition: `${o.label}${o.detail ? `: ${o.detail}` : ''}`, usedBy: [] });
    answerConcepts.get(o.code).usedBy.push(q.id);
  }
}
write('CodeSystem-oah-citizen-answer.json', {
  resourceType: 'CodeSystem',
  id: 'oah-citizen-answer',
  url: SW.answers,
  version: '0.1.0',
  name: 'OahCitizenAnswer',
  title: 'OneAquaHealth Citizen Science App answer codes (proposed)',
  status: 'draft',
  experimental: true,
  publisher: 'StreamWell (IEEE OneAquaHealth Global Hackathon 2026)',
  description: 'The answer codes used by the OneAquaHealth Citizen Science App lookup endpoints (api.enora-oah.eu /api/citizens/water_flows, water_colors, channel_types, channel_forms, bank_types, habitats, fallen_biomass, vegetation_types, stream_assessments), retrieved 2026-10-03, published here so citizen observations can be validated. Some codes (NAT, ART) are shared by several questions; the question gives the context.',
  caseSensitive: true,
  content: 'complete',
  count: answerConcepts.size,
  concept: [...answerConcepts.values()].map((c) => ({ code: c.code, display: c.display, definition: `${c.definition} (used by: ${[...new Set(c.usedBy)].join(', ')})` })),
});

// --- CodeSystem: StreamWell concepts -------------------------------------------
const concepts = [
  ['citizen-science', 'Citizen science observation', 'Observation category for observations recorded by volunteers.'],
  ['overall-assessment', 'Overall stream quality (OAH three-class scale)', 'The volunteer\'s overall rating: Good, Moderate or Poor.'],
  ['condition-view', 'StreamWell condition view', 'Transparent points-based reading of a stream check, 0-100, on the OAH three-class scale. Decision support, not a validated index.'],
  ['channel-form', 'Channel form'], ['bed-type', 'Channel bed type'], ['bank-type', 'Bank type'], ['habitat', 'In-stream habitat'], ['fallen-biomass', 'Fallen biomass'],
  ['water-abstraction', 'Water abstraction'], ['barriers', 'Barriers across the stream'], ['barrier-count', 'Number of barriers'], ['water-height', 'Water height'],
  ['vegetation-cover-left', 'Left bank covered by vegetation'], ['vegetation-cover-right', 'Right bank covered by vegetation'],
  ['vegetation-type-left', 'Left bank dominant vegetation'], ['vegetation-type-right', 'Right bank dominant vegetation'], ['recent-cuts', 'Recent vegetation cuts'],
  ['impervious-left', 'Impervious area at left bank'], ['impervious-right', 'Impervious area at right bank'], ['outfall-pipes', 'Outfall pipes'], ['construction', 'Construction works'],
  ['polluted-discharge', 'Polluted discharge'], ['bad-smell', 'Bad smell noticed'], ['invasive-species-name', 'Invasive species named by volunteer'],
  ['channel-banks', 'Channel & banks (condition view component)'], ['places-for-life', 'Places for life (condition view component)'], ['banks-margins', 'Banks & margins (condition view component)'], ['water-pressures', 'Water & pressures (condition view component)'],
  ['restoration-change', 'Restoration change during a stream visit', 'Mean change in self-rated joy, serenity, anger (reversed) and fear (reversed), from before to after a visit; range -4..4.'],
  ['mean-restoration', 'Mean restoration change among visitors', 'Aggregate of restoration-change over visits at a site and period.'],
  ['share-restored', 'Share of visits after which visitors felt better'],
  ['active-travel-share', 'Share of visits reached on foot or by bike'],
  ['visits-count', 'Number of visits'], ['people-count', 'Number of distinct visitors'],
  ['visited-location', 'Visited location during the period', 'Cohort characteristic for GroupOah.'],
  ['blue-prescription', 'Blue prescription (nature-based social prescribing)'],
  ['stream-walk', 'Urban stream walk with StreamWell check-in'],
  ['who5-score', 'WHO-5 percentage score', 'WHO-5 Well-Being Index raw score (0-25) multiplied by 4.'],
  ...[1, 2, 3, 4, 5].map((v) => [`scale-${v}`, ['Not at all', 'A little', 'Moderately', 'Quite a lot', 'Very much'][v - 1]]),
  ...TAGS.map((t) => [`tag-${t.id}`, t.label, `Visit experience tag (${t.positive ? 'positive' : 'negative'}).`]),
  ...TRAVEL.map((t) => [`travel-${t.id}`, t.label, t.active ? 'Active travel.' : 'Passive travel.']),
  ...WHO5.answers.map((a) => [`who5-${a.value}`, a.label, `WHO-5 answer worth ${a.value} points.`]),
];
write('CodeSystem-streamwell.json', {
  resourceType: 'CodeSystem',
  id: 'streamwell',
  url: SW.cs,
  version: '0.1.0',
  name: 'StreamWellConcepts',
  title: 'StreamWell concepts',
  status: 'draft',
  experimental: true,
  publisher: 'StreamWell (IEEE OneAquaHealth Global Hackathon 2026)',
  description: 'Concepts used by StreamWell where neither the OneAquaHealth IG (TemporaryOahSystem) nor an international terminology has a code yet. Candidates for the OAH IG are listed in docs/ig-proposal.fsh.',
  caseSensitive: true,
  content: 'complete',
  count: concepts.length,
  concept: concepts.map(([code, display, definition]) => ({ code, display, ...(definition ? { definition } : {}) })),
});

write('Questionnaire-streamwell-visit.json', visitQuestionnaire());
write('Questionnaire-who5.json', who5Questionnaire());

// --- Example bundles from the synthetic pilot data ----------------------------
const json = JSON.parse(readFileSync(new URL('../data/demo-visits.json', import.meta.url), 'utf8'));
const ds = decodeDataset(json, SITE_BY_CODE);
const me = ds.visits.filter((v) => v.person === ds.demoPerson);
const visit = { ...me[me.length - 1], id: 'example-visit', decisions: [{ id: 'bare-but-trees-left', title: 'The left bank: mostly bare, with trees as tallest plants?', uses: ['isVegetationCovered', 'vegetationType'], decision: 'kept', note: 'a few old trees on a mown bank' }] };
const cell = monthlyHealthMeasures(ds.visits).find((c) => !c.suppressed && c.month === '2026-09');
const [y, m] = cell.month.split('-').map(Number);
const period = { id: cell.month, label: cell.month, start: `${cell.month}-01`, end: new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10) };
const examples = {
  'Bundle-example-stream-observation.json': streamBundle(visit),
  'Bundle-example-personal-wellbeing.json': personalBundle(visit, 'example'),
  'Bundle-example-health-measures.json': healthMeasureBundle(cell, period),
  'Bundle-example-blue-prescription.json': bluePrescriptionBundle({
    start: '2026-08-17', end: '2026-10-12', sites: ['C3', 'C10', 'C15'],
    who5Baseline: { score: 44, responses: { 'who5-1': 2, 'who5-2': 3, 'who5-3': 2, 'who5-4': 2, 'who5-5': 2 } },
    who5FollowUp: { date: '2026-09-28', score: 60, responses: { 'who5-1': 3, 'who5-2': 3, 'who5-3': 3, 'who5-4': 3, 'who5-5': 3 } },
    visits: me.slice(-4),
  }),
};
let failed = 0;
for (const [name, b] of Object.entries(examples)) {
  const v = validateBundle(b);
  if (!v.ok) { failed += 1; console.error(name, v.errors.slice(0, 5)); }
  write(name, b);
  console.log(`${name}: ${b.entry.length} resources, ${v.checked} checks, ${v.ok ? 'valid' : 'INVALID'}`);
}
console.log(`canonical base: ${SW_BASE}`);
if (failed) process.exit(1);
