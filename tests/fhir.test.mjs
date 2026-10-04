import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { SITE_BY_CODE } from '../src/sites.js';
import { decodeDataset } from '../src/demo-data.js';
import { monthlyHealthMeasures } from '../src/insights.js';
import { streamBundle, personalBundle, healthMeasureBundle, bluePrescriptionBundle, toTransaction, streamObservations, OAH, SW } from '../src/fhir.js';
import { validateBundle } from '../src/validate.js';
import { UNSURE } from '../src/protocol.js';

const json = JSON.parse(readFileSync(new URL('../data/demo-visits.json', import.meta.url), 'utf8'));
const ds = decodeDataset(json, SITE_BY_CODE);
const me = ds.visits.filter((v) => v.person === ds.demoPerson);
const visit = { ...me[me.length - 1], decisions: [{ id: 'good-with-pollution', title: 'Rated Good, but you saw signs of pollution', uses: ['overallAssessment'], decision: 'kept', note: 'only litter' }] };

const byType = (b, t) => b.entry.map((e) => e.resource).filter((r) => r.resourceType === t);

test('stream bundle follows the OAH IG profiles and validates', () => {
  const b = streamBundle(visit);
  const v = validateBundle(b);
  assert.ok(v.ok, JSON.stringify(v.errors.slice(0, 3)));
  const locs = byType(b, 'Location');
  assert.ok(locs.every((l) => l.meta.profile[0] === OAH.location && l.mode === 'instance'));
  assert.equal(locs.find((l) => l.id === `oah-site-${visit.site}`).identifier[0].system, OAH.locationIdSystem);
  const obs = byType(b, 'Observation');
  const codes = obs.map((o) => o.code.coding[0].code);
  for (const c of ['hydrology', 'morophology', 'riparianVegetation', 'LandUse', 'foam', 'invasiveOrganisms']) assert.ok(codes.includes(c), c);
  assert.ok(obs.filter((o) => o.code.coding[0].system === OAH.cs).every((o) => o.meta.profile[0] === OAH.indicator && o.performer.length && o.subject.reference.startsWith('Location/')));
  const overall = obs.find((o) => o.id.endsWith('-overall'));
  assert.ok(overall.note[0].text.includes('kept the answer'), 'second-look decision travels as a note');
  assert.ok(obs.find((o) => o.id.endsWith('-condition-view')).derivedFrom.length >= 6);
});

test('"not sure" becomes data-absent-reason asked-unknown', () => {
  const obs = streamObservations({ ...visit, answers: { ...visit.answers, waterFlow: UNSURE } });
  const hyd = obs.find((o) => o.id.endsWith('-hydrology'));
  assert.equal(hyd.valueCodeableConcept.coding[0].code, 'asked-unknown');
});

test('personal bundle carries no stream-free identifiers and validates', () => {
  const b = personalBundle(visit);
  assert.ok(validateBundle(b).ok);
  const p = byType(b, 'Patient')[0];
  assert.deepEqual(Object.keys(p).sort(), ['active', 'id', 'identifier', 'resourceType', 'text'], 'pseudonymous patient only: no name, birth date, address or contact');
  assert.ok(/Pseudonymous person/.test(p.text.div));
  const qr = byType(b, 'QuestionnaireResponse')[0];
  assert.equal(qr.questionnaire, SW.questionnaireVisit);
  const obs = byType(b, 'Observation')[0];
  assert.equal(obs.extension[0].url, 'http://hl7.org/fhir/StructureDefinition/event-location');
});

test('health-measure bundle uses ObservationHealthMeasureOah + GroupOah and masks small cells', () => {
  const cells = monthlyHealthMeasures(ds.visits);
  const ok = cells.find((c) => !c.suppressed);
  const period = { id: ok.month, label: ok.month, start: `${ok.month}-01`, end: `${ok.month}-28` };
  const b = healthMeasureBundle(ok, period);
  assert.ok(validateBundle(b).ok);
  const g = byType(b, 'Group')[0];
  assert.equal(g.meta.profile[0], OAH.group);
  assert.equal(g.actual, false);
  const hm = byType(b, 'Observation');
  assert.ok(hm.every((o) => o.meta.profile[0] === OAH.healthMeasure && o.focus[0].reference === `Group/${g.id}`));
  const small = cells.find((c) => c.suppressed);
  const bs = healthMeasureBundle(small, { id: small.month, label: small.month, start: `${small.month}-01`, end: `${small.month}-28` });
  const masked = byType(bs, 'Observation')[0];
  assert.equal(masked.dataAbsentReason.coding[0].code, 'masked');
  assert.equal(masked.valueQuantity, undefined);
  assert.ok(validateBundle(bs).ok);
});

test('blue-prescription bundle links CarePlan, Goal, WHO-5 and visit outcomes', () => {
  const resp = (v) => Object.fromEntries([1, 2, 3, 4, 5].map((i) => [`who5-${i}`, v]));
  const b = bluePrescriptionBundle({ start: '2026-08-17', end: '2026-10-12', sites: ['C3', 'C10'], who5Baseline: { score: 40, responses: resp(2) }, who5FollowUp: { date: '2026-09-28', score: 60, responses: resp(3) }, visits: me.slice(-3) });
  const v = validateBundle(b);
  assert.ok(v.ok, JSON.stringify(v.errors.slice(0, 3)));
  const cp = byType(b, 'CarePlan')[0];
  assert.equal(cp.activity[0].outcomeReference.length, 3);
  assert.equal(cp.activity[0].detail.scheduledTiming.repeat.frequency, 2);
  assert.ok(byType(b, 'Consent').length === 1);
});

test('validator catches broken references and profile violations', () => {
  const b = streamBundle(visit);
  const obs = b.entry.find((e) => e.resource.resourceType === 'Observation').resource;
  obs.subject = { reference: 'Location/does-not-exist' };
  delete obs.performer;
  const v = validateBundle(b);
  assert.equal(v.ok, false);
  const rules = v.errors.map((e) => e.rule).join(' | ');
  assert.ok(/resolves inside the bundle/.test(rules));
  assert.ok(/performer 1\.\.\*/.test(rules));
});

test('transaction conversion', () => {
  const tx = toTransaction(streamBundle(visit));
  assert.equal(tx.type, 'transaction');
  assert.ok(tx.entry.every((e) => e.request.method === 'PUT' && e.request.url === `${e.resource.resourceType}/${e.resource.id}`));
  assert.ok(validateBundle(tx).ok);
});

test('validator rejects each kind of deliberately broken record', () => {
  const cell = monthlyHealthMeasures(ds.visits).find((c) => !c.suppressed);
  const hm = () => healthMeasureBundle(cell, { id: cell.month, label: cell.month, start: `${cell.month}-01`, end: `${cell.month}-28` });
  const first = (b, t) => byType(b, t)[0];
  const cases = {
    'citizen observation not final': () => { const b = streamBundle(visit); first(b, 'Observation').status = 'preliminary'; return b; },
    'observation without a stream': () => { const b = streamBundle(visit); delete first(b, 'Observation').subject; return b; },
    'site without a latitude': () => { const b = streamBundle(visit); delete first(b, 'Location').position.latitude; return b; },
    'value and data-absent-reason together': () => { const b = streamBundle(visit); const o = first(b, 'Observation'); o.dataAbsentReason = { text: 'x' }; o.valueQuantity = o.valueQuantity || { value: 1 }; return b; },
    'cohort lists individual members': () => { const b = hm(); first(b, 'Group').member = [{ entity: { reference: 'Patient/x' } }]; return b; },
    'invalid resource id': () => { const b = streamBundle(visit); first(b, 'Location').id = 'not a valid id!'; return b; },
  };
  assert.ok(validateBundle(hm()).ok && validateBundle(streamBundle(visit)).ok);
  for (const [name, make] of Object.entries(cases)) {
    assert.equal(validateBundle(make()).ok, false, `not rejected: ${name}`);
  }
});
