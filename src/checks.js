// "Second look": explainable consistency checks that run before a stream
// check is saved. Each check says what it noticed, why it matters, which
// answers it used and where any outside data came from. The volunteer always
// decides: keep the answer (optionally with a note) or change it. Nothing is
// changed automatically, and every decision is kept with the record.

import { UNSURE, QUESTIONS } from './protocol.js';

const yes = (v) => v === true;
const no = (v) => v === false;

/**
 * @param {object} answers  stream-check answers
 * @param {object} ctx      { weather?, distanceM?, photoHint? }
 * @returns {Array<{id:string,severity:'check'|'safety'|'info',title:string,why:string,uses:string[],source:string,fix?:{field:string,label:string}}>}
 */
export function secondLook(answers, ctx = {}) {
  const a = answers || {};
  const w = ctx.weather || null;
  const out = [];
  const flag = (id, severity, title, why, uses, source = 'Your answers', fix) =>
    out.push({ id, severity, title, why, uses, source, ...(fix ? { fix } : {}) });

  // 1. Rating vs. what was described --------------------------------------
  if (a.overallAssessment === 'GOOD' && (yes(a.waterDischarge) || a.waterColor === 'FO' || a.waterColor === 'CO')) {
    flag('good-with-pollution', 'check', 'Rated Good, but you saw signs of pollution',
      'On the OneAquaHealth scale "Good" means good water quality. A discharge, lasting foam or an odd colour usually points to Moderate or Poor.',
      ['overallAssessment', 'waterDischarge', 'waterColor'], 'Your answers', { field: 'overallAssessment', label: 'Review my overall rating' });
  }
  if (a.overallAssessment === 'GOOD' && a.bottomChannelType === 'ART' && a.banksChannelType === 'ART') {
    flag('good-fully-built', 'check', 'Rated Good, but bed and banks are built',
      'A channel that is concrete on the bed and both banks has lost most natural habitat, which is part of what "Good" describes.',
      ['overallAssessment', 'bottomChannelType', 'banksChannelType'], 'Your answers', { field: 'overallAssessment', label: 'Review my overall rating' });
  }
  const pressures = ['waterAbstraction', 'hasDams', 'pipes', 'waterDischarge', 'construction'];
  const noPressure = pressures.every((p) => no(a[p]));
  const bothCovered = a.isVegetationCovered && yes(a.isVegetationCovered.left) && yes(a.isVegetationCovered.right);
  if (a.overallAssessment === 'POOR' && a.bottomChannelType === 'NAT' && a.banksChannelType === 'NAT' && bothCovered && a.waterColor === 'CL' && noPressure) {
    flag('poor-but-natural', 'check', 'Rated Poor, but everything you described looks natural',
      'Natural bed and banks, plants on both sides, clear water and no pressures usually read as Good or Moderate. If something else made it feel poor (litter, smell, noise), keep your rating and add a note so researchers can see why.',
      ['overallAssessment', 'bottomChannelType', 'banksChannelType', 'isVegetationCovered', 'waterColor'], 'Your answers', { field: 'overallAssessment', label: 'Review my overall rating' });
  }

  // 2. Physical consistency -------------------------------------------------
  if (Array.isArray(a.habitats) && a.habitats.includes('RF') && (a.waterFlow === 'STA' || a.waterFlow === 'DRY')) {
    flag('riffles-without-flow', 'check', 'Riffles need moving water',
      'Riffles and small falls are water rushing over stones, but the flow was recorded as still or dry. One of the two may need a second look.',
      ['habitats', 'waterFlow'], 'Your answers', { field: 'waterFlow', label: 'Review the flow' });
  }
  if (a.waterFlow === 'DRY' && ['CL', 'MU', 'FO', 'CO'].includes(a.waterColor)) {
    flag('dry-with-water', 'check', 'Dry channel, but the water was described',
      'If the channel is dry there is no water to describe. Maybe there are only a few pools? Then "Still" fits better.',
      ['waterFlow', 'waterColor'], 'Your answers', { field: 'waterFlow', label: 'Review the flow' });
  }
  for (const side of ['left', 'right']) {
    const cov = a.isVegetationCovered && a.isVegetationCovered[side];
    const typ = a.vegetationType && a.vegetationType[side];
    if (no(cov) && (typ === 'T' || typ === 'B')) {
      flag(`bare-but-${typ === 'T' ? 'trees' : 'shrubs'}-${side}`, 'check', `The ${side} bank: mostly bare, with ${typ === 'T' ? 'trees' : 'shrubs'} as tallest plants?`,
        'This can be right (a few trees on a mown bank), but it is a common mix-up between "how much is covered" and "what grows there".',
        ['isVegetationCovered', 'vegetationType'], 'Your answers', { field: 'isVegetationCovered', label: `Review the ${side} bank` });
    }
  }
  if (yes(a.waterDischarge) && no(a.pipes)) {
    flag('discharge-no-pipe', 'info', 'Discharge without a pipe',
      'Dirty water usually arrives through a pipe or a ditch. If it is a ditch, your answers are fine; a photo of where it enters helps the city find the source.',
      ['waterDischarge', 'pipes']);
  }

  // 3. Weather context (Open-Meteo, model grid, not a stream gauge) ---------
  if (w && w.rain48 != null) {
    if (w.rain48 >= 15 && a.waterColor === 'CL') {
      flag('clear-after-rain', 'check', `Clear water after ${fmt(w.rain48)} mm of rain`,
        'After heavy rain most urban streams carry mud and run-off for a day or two. Clear water is possible (for example below a pond), but worth a second look.',
        ['waterColor'], 'Weather: Open-Meteo, last 48 h', { field: 'waterColor', label: 'Review the water' });
    }
    if (w.rain72 != null && w.rain72 < 1 && a.waterColor === 'MU' && !yes(a.construction)) {
      flag('muddy-no-rain', 'info', 'Muddy water with no rain and no works nearby',
        'Without rain or building works, cloudy water can come from a discharge upstream. Your answer stands; a photo helps the city check.',
        ['waterColor', 'construction'], 'Weather: Open-Meteo, last 72 h');
    }
  }
  if (w && w.tmax3 != null && w.tmax3 >= 28 && (a.waterFlow === 'STA' || a.waterColor === 'CO')) {
    flag('heat-still-water', 'safety', `Hot days (${fmt(w.tmax3)} °C) and still or coloured water`,
      'Heat plus still water favours algal blooms and mosquito breeding, and lowers oxygen for fish. Avoid contact and keep pets out.',
      ['waterFlow', 'waterColor'], 'Weather: Open-Meteo, last 3 days');
  }
  if (yes(a.waterDischarge) && (a.waterColor === 'FO' || a.waterColor === 'CO')) {
    flag('sewage-signs', 'safety', 'Possible sewage: do not touch the water',
      'A discharge together with foam or an odd colour is a classic sign of sewage. Keep your distance and wash your hands after the visit.',
      ['waterDischarge', 'waterColor']);
  }

  // 4. Evidence -------------------------------------------------------------
  if (ctx.distanceM != null && ctx.distanceM > 300) {
    flag('far-from-site', 'check', `You seem to be ${Math.round(ctx.distanceM)} m from the site`,
      'Answers are linked to the research site you picked. If you are at a different stretch, choose the nearest site or "my own spot".',
      [], 'Phone location (stays on the phone)');
  }
  if (ctx.photoHint && ctx.photoHint.suggest && a.waterColor && a.waterColor !== UNSURE && ctx.photoHint.suggest !== a.waterColor && ctx.photoHint.confidence >= 0.6) {
    flag('photo-colour', 'check', `The photo looks "${ctx.photoHint.label}"`,
      `${ctx.photoHint.explanation} You answered differently. Light, shade and reflections can fool the camera, so your eyes win; this is just a prompt to look again.`,
      ['waterColor'], 'On-device photo check (the photo never leaves the phone)', { field: 'waterColor', label: 'Review the water' });
  }
  const unsure = countUnsure(a);
  if (unsure >= 6) {
    flag('many-unsure', 'info', `${unsure} answers are "not sure"`,
      'That is fine and honest. Adding upstream and downstream photos lets a researcher fill the gaps later.',
      []);
  }
  return out;
}

export function countUnsure(a) {
  let n = 0;
  for (const q of QUESTIONS) {
    const v = a[q.id];
    if (q.type === 'side') {
      if (v && v.left === UNSURE) n += 1;
      if (v && v.right === UNSURE) n += 1;
    } else if (v === UNSURE) n += 1;
  }
  return n;
}

function fmt(x) { return Math.round(x * 10) / 10; }

/** Summarise decisions for the record: {checkId: {decision:'kept'|'changed', note?}} */
export function decisionSummary(flags, decisions) {
  return flags.map((f) => ({ id: f.id, title: f.title, severity: f.severity, decision: (decisions[f.id] && decisions[f.id].decision) || (f.severity === 'check' ? 'open' : 'seen'), note: decisions[f.id] && decisions[f.id].note }));
}
