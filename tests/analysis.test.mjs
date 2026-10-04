import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { SITE_BY_CODE, SITES } from '../src/sites.js';
import { decodeDataset, decodeAnswers } from '../src/demo-data.js';
import { spearman, pearson, ranks, ols, olsClusterBootstrap, meanDiff, bootstrapCI, mean } from '../src/stats.js';
import { siteAggregates, conditionVsRestoration, drivers, labVsCitizen, personalInsights, monthlyHealthMeasures, overdueSites, weekStreak } from '../src/insights.js';
import { advisory, applyScenario, summariseDaily, saferAlternatives } from '../src/earlywarning.js';
import { classifyPixels, suggestFromShares, rgbToHsv } from '../src/photo.js';

const json = JSON.parse(readFileSync(new URL('../data/demo-visits.json', import.meta.url), 'utf8'));
const ds = decodeDataset(json, SITE_BY_CODE);
const today = new Date('2026-10-03T12:00:00Z');

test('statistics helpers', () => {
  assert.deepEqual(ranks([10, 20, 20, 5]), [2, 3.5, 3.5, 1]);
  assert.ok(Math.abs(pearson([1, 2, 3, 4], [2, 4, 6, 8]) - 1) < 1e-12);
  assert.ok(Math.abs(spearman([1, 2, 3, 4], [1, 4, 9, 16]) - 1) < 1e-12);
  const beta = ols([[1], [2], [3], [4]], [3, 5, 7, 9]);
  assert.ok(Math.abs(beta[0] - 1) < 1e-4 && Math.abs(beta[1] - 2) < 1e-4);
  const md = meanDiff([2, 3, 4, 5], [1, 1, 2, 2]);
  assert.ok(md.diff > 0 && md.lo < md.diff && md.hi > md.diff);
  const ci = bootstrapCI(50, (idx) => mean(idx.map((i) => i)), { reps: 200 });
  assert.ok(ci[0] < 24.5 && ci[1] > 24.5);
});

test('cluster bootstrap recovers a known effect', () => {
  const X = [];
  const y = [];
  const cl = [];
  let s = 1;
  const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let p = 0; p < 60; p += 1) {
    const u = r() - 0.5;
    for (let k = 0; k < 6; k += 1) {
      const x = r() < 0.5 ? 1 : 0;
      X.push([x]);
      y.push(0.5 * x + u + (r() - 0.5) * 0.4);
      cl.push(p);
    }
  }
  const fit = olsClusterBootstrap(X, y, cl, { reps: 150 });
  assert.ok(Math.abs(fit.beta[1] - 0.5) < 0.1, 'estimate close to the true effect');
  assert.ok(fit.ci[1][0] < fit.beta[1] && fit.ci[1][1] > fit.beta[1], 'interval brackets the estimate');
  assert.ok(fit.ci[1][1] - fit.ci[1][0] < 0.3, 'interval is informative');
  assert.ok(fit.ci[1][0] > 0, 'effect is clearly positive');
});

test('synthetic dataset decodes into visit objects', () => {
  assert.equal(ds.visits.length, json.meta.visits);
  assert.ok(json.meta.synthetic);
  const v = ds.visits[0];
  for (const k of ['site', 'date', 'answers', 'before', 'after', 'tags', 'minutes']) assert.ok(k in v, k);
  const a = decodeAnswers('NCUNLc3YNYNTH?NNYYNNG');
  assert.equal(a.waterFlow, 'NOR');
  assert.deepEqual(a.habitats, ['SD', 'RF']);
  assert.deepEqual(a.fallenBiomassTypes, ['FT', 'FB']);
  assert.equal(a.imperviousAreas.left, true);
  assert.equal(a.vegetationType.left, 'T');
  assert.equal(a.hasInvasivePlantSpecies, 'UNSURE');
  assert.equal(a.overallAssessment, 'GOOD');
});

test('dashboard analytics run on the pilot data', () => {
  const agg = siteAggregates(ds.visits, today);
  assert.ok(Object.keys(agg).length > 90);
  const cvr = conditionVsRestoration(agg);
  assert.ok(cvr.n > 50 && cvr.rho > 0.3, 'healthier streams, more restoration in the simulation');
  const dr = drivers(ds.visits, { reps: 60 });
  const row = (id) => dr.rows.find((r) => r.id === id);
  assert.ok(row('litter').hi < 0, 'litter lowers restoration');
  assert.ok(row('unsafe').hi < 0);
  assert.ok(row('waterSound').lo > 0);
  const lv = labVsCitizen(agg);
  assert.ok(lv.n > 50);
  const od = overdueSites(agg, SITES);
  assert.ok(Array.isArray(od));
});

test('health measures are suppressed below k visitors', () => {
  const m = monthlyHealthMeasures(ds.visits, 5);
  for (const cell of m) {
    if (cell.people < 5) { assert.equal(cell.suppressed, true); assert.equal(cell.meanRestoration, null); }
    else assert.equal(cell.suppressed, false);
  }
});

test('personal insights for the demo journal', () => {
  const me = ds.visits.filter((v) => v.person === ds.demoPerson);
  const pi = personalInsights(me, today);
  assert.equal(pi.n, 14);
  assert.ok(pi.adopted.length >= 1);
  assert.ok(pi.streakWeeks >= 1);
  assert.equal(weekStreak(['2026-09-28', '2026-09-21', '2026-09-14'], today), 3);
  assert.equal(weekStreak(['2026-08-01'], today), 0);
});

test('safe-blue-walk advisories', () => {
  const daily = { time: ['a', 'b', 'c', 'd', 'e'], precipitation_sum: [0, 0, 1, 0, 0], temperature_2m_max: [20, 21, 22, 23, 24] };
  const w = summariseDaily(daily, 'test');
  const site = SITE_BY_CODE.C5; // high faecal score in OAH lab data
  const lab = { fecal: 0.9, pathogen: 0.9, score: 0.78, date: '2023-06-29' };
  assert.equal(advisory(site, w, null, null).level, 0);
  assert.equal(advisory(site, w, lab, null).level, 1, 'very high faecal lab score alone means care');
  const storm = applyScenario({ CO: w }, 'storm').CO;
  assert.equal(advisory(site, storm, lab, null).level, 2, 'storm + faecal signal means avoid');
  assert.equal(advisory(SITE_BY_CODE.C4, storm, { fecal: 0.1, pathogen: 0.05, score: 0.07, date: 'x' }, null).level, 1);
  const heat = applyScenario({ CO: w }, 'heat').CO;
  assert.equal(advisory(SITE_BY_CODE.C4, heat, null, { recentStill: true }).level, 1);
  const advs = ['C1', 'C2', 'C3'].map((c) => ({ site: c, city: 'CO', level: c === 'C1' ? 1 : 0 }));
  const alt = saferAlternatives(SITE_BY_CODE.C1, advs, SITES);
  assert.deepEqual(alt.map((s) => s.code).sort(), ['C2', 'C3']);
  const stormAdvs = ['C1', 'C2', 'C3'].map((c) => ({ site: c, city: 'CO', level: c === 'C1' ? 2 : 1 }));
  assert.deepEqual(saferAlternatives(SITE_BY_CODE.C1, stormAdvs, SITES).map((s) => s.code).sort(), ['C2', 'C3'], 'after a storm, "care" sites are safer than "avoid" ones');
});

test('photo check classifies colours and explains itself', () => {
  const px = (r, g, b, n) => { const a = new Uint8ClampedArray(n * 4); for (let i = 0; i < n; i += 1) a.set([r, g, b, 255], i * 4); return a; };
  assert.deepEqual(rgbToHsv(255, 0, 0).map((x) => Math.round(x * 100) / 100), [0, 1, 1]);
  assert.equal(suggestFromShares(classifyPixels(px(150, 110, 60, 100)).share).suggest, 'MU');
  assert.equal(suggestFromShares(classifyPixels(px(245, 245, 240, 100)).share).suggest, 'FO');
  assert.equal(suggestFromShares(classifyPixels(px(60, 140, 50, 100)).share).suggest, 'CO');
  assert.equal(suggestFromShares(classifyPixels(px(80, 120, 160, 100)).share).suggest, 'CL');
  assert.ok(suggestFromShares(classifyPixels(px(150, 110, 60, 100)).share).explanation.includes('%'));
});
