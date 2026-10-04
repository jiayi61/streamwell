// Turning paired visits into insight, for one person (their journal) and for a
// city (the One Health dashboard). All analysis is descriptive or
// associational and says so; small samples are labelled as such.

import { conditionView } from './score.js';
import { restoration, moodBalance } from './wellbeing.js';
import { mean, median, meanDiff, spearman, bootstrapCI, olsClusterBootstrap, round } from './stats.js';
import { HEALTH_RISK } from './health-risks.js';
import { SITE_BY_CODE } from './sites.js';

/** Add derived fields once: condition score/band and restoration. */
export function enrich(v) {
  if (v._enriched) return v;
  const cond = conditionView(v.answers, v.answers && v.answers.overallAssessment);
  return {
    ...v,
    _enriched: true,
    score: cond.score,
    band: cond.band,
    restoration: restoration(v.before, v.after),
    balanceBefore: moodBalance(v.before),
  };
}

const any = (o, v) => !!o && (o.left === v || o.right === v);
const both = (o, v) => !!o && o.left === v && o.right === v;

/** Binary features used for contrasts and for the drivers model. */
export const FEATURES = [
  { id: 'naturalBanks', label: 'Natural banks', fixable: 'Restore banks (remove concrete)', fn: (v) => v.answers.banksChannelType === 'NAT' },
  { id: 'trees', label: 'Trees on a bank', fixable: 'Plant trees along the bank', fn: (v) => any(v.answers.vegetationType, 'T') },
  { id: 'vegetated', label: 'Both banks vegetated', fixable: 'Let bank vegetation grow back', fn: (v) => both(v.answers.isVegetationCovered, true) },
  { id: 'clearWater', label: 'Clear water', fixable: null, fn: (v) => v.answers.waterColor === 'CL' },
  { id: 'paved', label: 'Paving at the edge', fixable: 'Green the paved edge', fn: (v) => any(v.answers.imperviousAreas, true) },
  { id: 'discharge', label: 'Polluted discharge', fixable: 'Fix the outfall', fn: (v) => v.answers.waterDischarge === true },
  { id: 'waterSound', label: 'Sound of water', fixable: null, fn: (v) => v.tags.includes('waterSound') },
  { id: 'birds', label: 'Birds or wildlife', fixable: null, fn: (v) => v.tags.includes('birds') },
  { id: 'litter', label: 'Litter', fixable: 'Clean-ups and bins', fn: (v) => v.tags.includes('litter') },
  { id: 'smell', label: 'Bad smell', fixable: 'Trace the smell to its source', fn: (v) => v.tags.includes('smell') },
  { id: 'noise', label: 'Traffic noise', fixable: 'Calm or screen traffic', fn: (v) => v.tags.includes('noise') },
  { id: 'unsafe', label: 'Felt unsafe', fixable: 'Light and open up the path', fn: (v) => v.tags.includes('unsafe') },
];

// ----------------------------------------------------------- personal journal
export function personalInsights(rawVisits, today = new Date()) {
  const visits = rawVisits.map(enrich).filter((v) => v.restoration !== null).sort((a, b) => a.date.localeCompare(b.date));
  const n = visits.length;
  if (!n) return { n: 0, cards: [] };
  const rs = visits.map((v) => v.restoration);
  const bySite = groupBy(visits, (v) => v.site);
  const siteStats = Object.entries(bySite).map(([site, vs]) => ({ site, n: vs.length, mean: mean(vs.map((v) => v.restoration)), last: vs[vs.length - 1].date }));
  const adopted = siteStats.filter((s) => s.n >= 3);
  const best = siteStats.filter((s) => s.n >= 2).sort((a, b) => b.mean - a.mean)[0] || null;
  const contrasts = [];
  for (const f of FEATURES) {
    const yes = visits.filter((v) => f.fn(v)).map((v) => v.restoration);
    const no = visits.filter((v) => !f.fn(v)).map((v) => v.restoration);
    if (yes.length >= 3 && no.length >= 3) {
      const md = meanDiff(yes, no);
      contrasts.push({ feature: f.id, label: f.label, ...md });
    }
  }
  contrasts.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
  const activeMinutes = sumBy(visits.filter((v) => v.travel === 'walk' || v.travel === 'cycle'), (v) => v.minutes || 0);
  return {
    n,
    meanRestoration: round(mean(rs)),
    medianRestoration: round(median(rs)),
    shareBetter: round(rs.filter((r) => r > 0).length / n, 2),
    streakWeeks: weekStreak(visits.map((v) => v.date), today),
    sites: siteStats.sort((a, b) => b.n - a.n),
    adopted,
    best,
    contrasts,
    activeMinutes,
    observations: n,
    visits,
  };
}

function weekKey(dateStr) {
  const d = new Date(`${dateStr}T12:00:00Z`);
  const day = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}

/** Consecutive weeks (Mon-Sun) with at least one visit, counting back from this week or last week. */
export function weekStreak(dates, today = new Date()) {
  const weeks = new Set(dates.map(weekKey));
  let cursor = weekKey(today.toISOString().slice(0, 10));
  if (!weeks.has(cursor)) {
    const d = new Date(`${cursor}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 7);
    cursor = d.toISOString().slice(0, 10);
  }
  let streak = 0;
  while (weeks.has(cursor)) {
    streak += 1;
    const d = new Date(`${cursor}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 7);
    cursor = d.toISOString().slice(0, 10);
  }
  return streak;
}

// ------------------------------------------------------------- city / research
export function siteAggregates(rawVisits, today) {
  const visits = rawVisits.map(enrich);
  const by = groupBy(visits, (v) => v.site);
  const out = {};
  for (const [site, vs] of Object.entries(by)) {
    vs.sort((a, b) => a.date.localeCompare(b.date));
    const scores = vs.map((v) => v.score).filter((x) => x !== null);
    const rs = vs.map((v) => v.restoration).filter((x) => x !== null);
    const recent = vs.slice(-5);
    const last = vs[vs.length - 1];
    const tagCount = {};
    vs.forEach((v) => v.tags.forEach((t) => { tagCount[t] = (tagCount[t] || 0) + 1; }));
    out[site] = {
      site,
      n: vs.length,
      people: new Set(vs.map((v) => v.person)).size,
      meanScore: round(mean(scores), 1),
      recentScore: round(mean(recent.map((v) => v.score).filter((x) => x !== null)), 1),
      meanRestoration: round(mean(rs)),
      bands: countBy(vs, (v) => v.band),
      ratings: countBy(vs, (v) => v.answers.overallAssessment),
      lastDate: last.date,
      daysSince: today ? Math.round((today - new Date(`${last.date}T12:00:00Z`)) / 86400000) : null,
      dischargeShare: round(vs.filter((v) => v.answers.waterDischarge === true).length / vs.length, 2),
      // A discharge signal needs the latest visit (within 21 days) or two of the last five to report it.
      recentDischarge: (last.answers.waterDischarge === true && (!today || (today - new Date(`${last.date}T12:00:00Z`)) / 86400000 <= 21))
        || recent.filter((v) => v.answers.waterDischarge === true).length >= 2,
      recentStill: recent.filter((v) => v.answers.waterFlow === 'STA').length >= 2,
      tagShare: Object.fromEntries(Object.entries(tagCount).map(([k, c]) => [k, round(c / vs.length, 2)])),
      lab: HEALTH_RISK[site] || null,
    };
  }
  return out;
}

/**
 * Site-level association between stream condition (citizen view) and
 * restoration, with a site-resampling bootstrap CI.
 */
export function conditionVsRestoration(aggregates, minVisits = 5) {
  const pts = Object.values(aggregates).filter((a) => a.n >= minVisits && a.meanScore != null && a.meanRestoration != null);
  const xs = pts.map((p) => p.meanScore);
  const ys = pts.map((p) => p.meanRestoration);
  const rho = spearman(xs, ys);
  const ci = pts.length >= 8 ? bootstrapCI(pts.length, (idx) => spearman(idx.map((i) => xs[i]), idx.map((i) => ys[i])), { reps: 800 }) : [NaN, NaN];
  return { n: pts.length, rho: round(rho), ci: ci.map((c) => round(c)), points: pts };
}

/**
 * Drivers model: visit-level restoration on stream features and experience
 * tags, adjusting for arrival mood, visit length and city; 95% CIs from a
 * bootstrap that resamples volunteers. Associational, not causal.
 */
export function drivers(rawVisits, { reps = 200 } = {}) {
  const visits = rawVisits.map(enrich).filter((v) => v.restoration !== null && v.balanceBefore !== null);
  if (visits.length < 60) return null;
  const cities = [...new Set(visits.map((v) => v.city))].sort();
  const X = visits.map((v) => [
    ...FEATURES.map((f) => (f.fn(v) ? 1 : 0)),
    v.balanceBefore / 4,
    Math.log(Math.max(5, v.minutes || 20) / 20),
    ...cities.slice(1).map((c) => (v.city === c ? 1 : 0)),
  ]);
  const y = visits.map((v) => v.restoration);
  const fit = olsClusterBootstrap(X, y, visits.map((v) => v.person), { reps });
  const rows = FEATURES.map((f, j) => ({
    id: f.id,
    label: f.label,
    fixable: f.fixable,
    effect: round(fit.beta[j + 1], 2),
    lo: round(fit.ci[j + 1][0], 2),
    hi: round(fit.ci[j + 1][1], 2),
    prevalence: round(mean(X.map((r) => r[j])), 2),
  }));
  rows.forEach((r) => { r.clear = r.lo > 0 || r.hi < 0; });
  return { n: visits.length, people: new Set(visits.map((v) => v.person)).size, rows, reps: fit.reps, adjust: ['mood on arrival', 'visit length', 'city'] };
}

/** Where citizen views and OAH lab risk disagree: the most useful places to act. */
export function labVsCitizen(aggregates, minVisits = 3) {
  const out = { hiddenRisk: [], unsampledConcern: [], rho: null, n: 0 };
  const pts = Object.values(aggregates).filter((a) => a.n >= minVisits && a.meanScore != null);
  const withLab = pts.filter((p) => p.lab);
  out.n = withLab.length;
  if (withLab.length >= 8) out.rho = round(spearman(withLab.map((p) => p.meanScore), withLab.map((p) => -p.lab.score)));
  for (const p of pts) {
    if (p.lab && p.lab.score >= 0.4 && p.meanScore >= 58) out.hiddenRisk.push(p);
    if (p.meanScore < 45 && (!p.lab || p.lab.score < 0.25)) out.unsampledConcern.push(p);
  }
  out.hiddenRisk.sort((a, b) => b.lab.score - a.lab.score);
  out.unsampledConcern.sort((a, b) => a.meanScore - b.meanScore);
  return out;
}

export function overdueSites(aggregates, allSites, days = 30) {
  return allSites
    .map((s) => ({ ...s, agg: aggregates[s.code] || null }))
    .filter((s) => !s.agg || s.agg.daysSince > days)
    .sort((a, b) => (b.agg ? b.agg.daysSince : 9999) - (a.agg ? a.agg.daysSince : 9999));
}

/** Monthly aggregate per site, with k-anonymity: cells with fewer than k visitors are suppressed. */
export function monthlyHealthMeasures(rawVisits, k = 5) {
  const visits = rawVisits.map(enrich).filter((v) => v.restoration !== null);
  const by = groupBy(visits, (v) => `${v.site}|${v.date.slice(0, 7)}`);
  return Object.entries(by).map(([key, vs]) => {
    const [site, month] = key.split('|');
    const people = new Set(vs.map((v) => v.person)).size;
    const suppressed = people < k;
    return {
      site,
      month,
      visits: vs.length,
      people,
      suppressed,
      meanRestoration: suppressed ? null : round(mean(vs.map((v) => v.restoration))),
      shareRestored: suppressed ? null : round(vs.filter((v) => v.restoration > 0).length / vs.length, 2),
      activeShare: suppressed ? null : round(vs.filter((v) => v.travel === 'walk' || v.travel === 'cycle').length / vs.length, 2),
      name: SITE_BY_CODE[site] ? SITE_BY_CODE[site].name : site,
    };
  }).sort((a, b) => (a.month === b.month ? a.site.localeCompare(b.site) : b.month.localeCompare(a.month)));
}

// ------------------------------------------------------------------ helpers
export function groupBy(xs, keyFn) {
  const m = {};
  for (const x of xs) {
    const k = keyFn(x);
    (m[k] = m[k] || []).push(x);
  }
  return m;
}
function countBy(xs, keyFn) {
  const m = {};
  for (const x of xs) {
    const k = keyFn(x);
    if (k != null) m[k] = (m[k] || 0) + 1;
  }
  return m;
}
function sumBy(xs, fn) { return xs.reduce((s, x) => s + fn(x), 0); }
