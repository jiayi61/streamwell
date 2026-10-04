import { test } from 'node:test';
import assert from 'node:assert/strict';

import { SITES, SITE_BY_CODE, CITIES, nearestSites, distanceM } from '../src/sites.js';
import { HEALTH_RISK, riskBand } from '../src/health-risks.js';
import { QUESTIONS, UNSURE, toOahSubmission, isAnswered, QUESTION_BY_ID } from '../src/protocol.js';
import { conditionView, bandFor, oneHealthNotes, suggestedActions } from '../src/score.js';
import { secondLook, countUnsure } from '../src/checks.js';
import { restoration, moodBalance, feelingChanges, who5Score, who5Change } from '../src/wellbeing.js';

const natural = {
  waterFlow: 'NOR', waterColor: 'CL', channelForm: 'U', bottomChannelType: 'NAT', banksChannelType: 'NAT',
  habitats: ['SD', 'RF', 'AV'], fallenBiomassTypes: ['FB'],
  imperviousAreas: { left: false, right: false }, isVegetationCovered: { left: true, right: true }, vegetationType: { left: 'T', right: 'T' },
  hasInvasivePlantSpecies: false, recentVegetationCuts: false,
  waterAbstraction: false, hasDams: false, pipes: false, waterDischarge: false, construction: false,
  overallAssessment: 'GOOD',
};
const builtUp = {
  ...natural, waterColor: 'FO', bottomChannelType: 'ART', banksChannelType: 'ART', habitats: [], fallenBiomassTypes: [],
  imperviousAreas: { left: true, right: true }, isVegetationCovered: { left: false, right: false }, vegetationType: { left: 'H', right: 'H' },
  pipes: true, waterDischarge: true, overallAssessment: 'GOOD',
};

test('106 real OAH sites across five cities, unique codes, sane coordinates', () => {
  assert.equal(SITES.length, 106);
  assert.equal(new Set(SITES.map((s) => s.code)).size, 106);
  const perCity = Object.fromEntries(Object.keys(CITIES).map((c) => [c, SITES.filter((s) => s.city === c).length]));
  assert.deepEqual(perCity, { CO: 20, TO: 24, GH: 22, BE: 20, OS: 20 });
  for (const s of SITES) {
    const c = CITIES[s.city];
    assert.ok(distanceM(s.lat, s.lon, c.lat, c.lon) < 60000, `${s.code} is far from ${c.name}`);
  }
  assert.equal(SITE_BY_CODE.T21.name, 'Site T21');
});

test('nearest site lookup', () => {
  const near = nearestSites(40.19307, -8.41945, 3);
  assert.equal(near[0].code, 'C3');
  assert.ok(near[0].distance < 1);
});

test('OAH lab health-risk data: 96 sites, scores in 0..1', () => {
  assert.equal(Object.keys(HEALTH_RISK).length, 96);
  for (const r of Object.values(HEALTH_RISK)) for (const k of ['pathogen', 'fecal', 'arg', 'score']) assert.ok(r[k] >= 0 && r[k] <= 1);
  assert.equal(riskBand(0.5), 'high');
  assert.equal(riskBand(0.35), 'elevated');
  assert.equal(riskBand(0.1), 'low');
});

test('protocol mirrors the OAH CitizenSubmissionPutDTO', () => {
  const sub = toOahSubmission({ site: 'C3', lat: 40.19, lon: -8.42, answers: natural, after: { joy: 4, serenity: 5, anger: 1, fear: 1 } });
  for (const k of ['latitude', 'longitude', 'researchSite', 'overallAssessment', 'waterFlow', 'waterColor', 'channelForm', 'bottomChannelType', 'banksChannelType', 'imperviousAreasLeft', 'vegetationTypeRight', 'joy', 'serenity', 'anger', 'fear']) assert.ok(k in sub, k);
  assert.equal(sub.vegetationTypeLeft, 'T');
  assert.equal(sub.numberOfDams, 0);
  const unsure = toOahSubmission({ site: 'C3', answers: { ...natural, waterColor: UNSURE } });
  assert.equal(unsure.waterColor, null, 'not sure is sent as null, never invented');
  assert.ok(isAnswered(QUESTION_BY_ID.habitats, []));
  assert.ok(!isAnswered(QUESTION_BY_ID.habitats, undefined));
  assert.ok(QUESTIONS.every((q) => q.type !== 'single' || q.options.every((o) => o.oahLabel)), 'every option keeps its OAH label');
});

test('condition view: natural stretch is Good, built-up polluted stretch is Poor', () => {
  const a = conditionView(natural, 'GOOD');
  assert.equal(a.band, 'GOOD');
  assert.equal(a.score, 95, '3 of 5 habitat types: 15/20 habitat points, everything else full');
  assert.equal(a.confidence.level, 'High');
  assert.equal(a.agreement.gap, 0);
  const b = conditionView(builtUp, 'GOOD');
  assert.equal(b.band, 'POOR');
  assert.equal(b.agreement.gap, 2);
  assert.equal(bandFor(66.9), 'MODERATE');
  assert.equal(bandFor(67), 'GOOD');
});

test('"not sure" is left out, never counted as good or bad, and lowers confidence', () => {
  const unsure = { ...natural };
  for (const q of QUESTIONS) {
    if (q.type === 'side') unsure[q.id] = { left: UNSURE, right: UNSURE };
    else if (q.type === 'single' || q.type === 'bool') unsure[q.id] = UNSURE;
  }
  const v = conditionView({ ...unsure, habitats: ['RF'], fallenBiomassTypes: [] });
  assert.equal(v.confidence.level, 'Low');
  assert.ok(countUnsure(unsure) >= 10);
});

test('second look flags contradictions and explains them', () => {
  const ids = secondLook(builtUp).map((f) => f.id);
  assert.ok(ids.includes('good-with-pollution'));
  assert.ok(ids.includes('good-fully-built'));
  assert.ok(ids.includes('sewage-signs'));
  assert.equal(secondLook(natural).length, 0);
  const poor = secondLook({ ...natural, overallAssessment: 'POOR' });
  assert.equal(poor[0].id, 'poor-but-natural');
  const riffle = secondLook({ ...natural, waterFlow: 'STA' }).map((f) => f.id);
  assert.ok(riffle.includes('riffles-without-flow'));
  for (const f of secondLook(builtUp)) {
    assert.ok(f.title && f.why && f.source, 'every flag says what, why and where from');
  }
});

test('second look uses weather, distance and the photo hint', () => {
  const rain = secondLook(natural, { weather: { rain48: 22, rain72: 25, tmax3: 20 } }).map((f) => f.id);
  assert.ok(rain.includes('clear-after-rain'));
  const dry = secondLook({ ...natural, waterColor: 'MU' }, { weather: { rain48: 0, rain72: 0, tmax3: 20 } }).map((f) => f.id);
  assert.ok(dry.includes('muddy-no-rain'));
  const heat = secondLook({ ...natural, waterFlow: 'STA', habitats: [] }, { weather: { rain48: 0, rain72: 0, tmax3: 31 } }).map((f) => f.id);
  assert.ok(heat.includes('heat-still-water'));
  assert.ok(secondLook(natural, { distanceM: 900 }).some((f) => f.id === 'far-from-site'));
  assert.ok(secondLook(natural, { photoHint: { suggest: 'MU', label: 'muddy', confidence: 0.8, explanation: 'x' } }).some((f) => f.id === 'photo-colour'));
});

test('One Health notes and actions', () => {
  const notes = oneHealthNotes(builtUp).map((n) => n.title);
  assert.ok(notes.some((t) => /Keep skin and paws/.test(t)));
  const good = oneHealthNotes(natural).map((n) => n.domain);
  assert.ok(good.includes('ecosystem') && good.includes('people'));
  const acts = suggestedActions(builtUp, ['litter']).map((a) => a.text);
  assert.ok(acts.some((t) => /discharge/.test(t)));
  assert.ok(acts.some((t) => /clean-up/i.test(t)));
});

test('restoration score from before/after feelings', () => {
  const before = { joy: 2, serenity: 2, anger: 3, fear: 3 };
  const after = { joy: 3, serenity: 4, anger: 2, fear: 2 };
  assert.equal(moodBalance(before), -2);
  assert.equal(restoration(before, after), 1.25);
  assert.equal(restoration(before, before), 0);
  assert.equal(restoration(before, {}), null);
  const ch = feelingChanges(before, after);
  assert.deepEqual(ch.map((c) => c.better), [1, 2, 1, 1]);
});

test('WHO-5 scoring', () => {
  assert.equal(who5Score({ 'who5-1': 2, 'who5-2': 3, 'who5-3': 2, 'who5-4': 2, 'who5-5': 2 }), 44);
  assert.equal(who5Score({ 'who5-1': 2 }), null);
  assert.deepEqual(who5Change(44, 60), { delta: 16, meaningful: true, direction: 'better' });
});
