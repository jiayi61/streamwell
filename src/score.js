// StreamWell condition view: a transparent, points-based reading of the
// citizen's answers on the OAH three-class scale (Good / Moderate / Poor).
// It is decision support for the volunteer and the city, not a validated
// ecological index: every point is listed so anyone can see where it came from.

import { UNSURE } from './protocol.js';

export const BANDS = [
  { id: 'GOOD', label: 'Good', min: 67 },
  { id: 'MODERATE', label: 'Moderate', min: 40 },
  { id: 'POOR', label: 'Poor', min: -Infinity },
];

export function bandFor(score) {
  if (score == null || Number.isNaN(score)) return null;
  return BANDS.find((b) => score >= b.min).id;
}

const known = (v) => v !== undefined && v !== null && v !== UNSURE && v !== '';

/**
 * A component collects earned and possible points; unknown answers are left
 * out of both, so "not sure" never counts as good or bad.
 */
function component(label, parts) {
  let earned = 0;
  let possible = 0;
  const reasons = [];
  let unknown = 0;
  for (const p of parts) {
    if (p.unknown) {
      unknown += 1;
      reasons.push({ text: p.text, points: null });
      continue;
    }
    earned += p.earned;
    possible += p.possible;
    reasons.push({ text: p.text, points: p.earned, possible: p.possible });
  }
  const score = possible > 0 ? Math.max(0, Math.min(1, earned / possible)) * 25 : null;
  return { label, score, reasons, unknown, items: parts.length };
}

function channel(a) {
  const bed = { NAT: 12, ART: 0 };
  const banks = { NAT: 13, LAS: 7, ART: 0 };
  return component('Channel & banks', [
    known(a.bottomChannelType)
      ? { earned: bed[a.bottomChannelType] ?? 0, possible: 12, text: `Bed: ${a.bottomChannelType === 'NAT' ? 'natural' : 'built'}` }
      : { unknown: true, text: 'Bed type not known' },
    known(a.banksChannelType)
      ? { earned: banks[a.banksChannelType] ?? 0, possible: 13, text: `Banks: ${{ NAT: 'natural', LAS: 'loose stones', ART: 'built' }[a.banksChannelType]}` }
      : { unknown: true, text: 'Bank type not known' },
  ]);
}

function habitat(a) {
  const ladder = [0, 6, 11, 15, 18, 20];
  const n = Array.isArray(a.habitats) ? a.habitats.length : null;
  const debris = Array.isArray(a.fallenBiomassTypes) ? a.fallenBiomassTypes.length > 0 : null;
  const dry = a.waterFlow === 'DRY';
  return component('Places for life', [
    n === null
      ? { unknown: true, text: 'Habitats not recorded' }
      : { earned: dry ? Math.min(ladder[Math.min(n, 5)], 6) : ladder[Math.min(n, 5)], possible: 20, text: `${n} habitat type${n === 1 ? '' : 's'} seen${dry ? ' (channel dry)' : ''}` },
    debris === null
      ? { unknown: true, text: 'Natural debris not recorded' }
      : { earned: debris ? 5 : 0, possible: 5, text: debris ? 'Natural wood or leaves present' : 'No natural wood or leaves' },
  ]);
}

function margins(a) {
  const parts = [];
  for (const side of ['left', 'right']) {
    const cov = a.isVegetationCovered ? a.isVegetationCovered[side] : undefined;
    const typ = a.vegetationType ? a.vegetationType[side] : undefined;
    const imp = a.imperviousAreas ? a.imperviousAreas[side] : undefined;
    parts.push(known(cov)
      ? { earned: cov === true ? 6 : 0, possible: 6, text: `${cap(side)} bank ${cov === true ? 'covered by plants' : 'mostly bare'}` }
      : { unknown: true, text: `${cap(side)} bank cover not known` });
    parts.push(known(typ)
      ? { earned: { T: 4.5, B: 3, H: 1.5 }[typ] ?? 0, possible: 4.5, text: `${cap(side)} bank: ${{ T: 'trees', B: 'shrubs', H: 'grass and herbs' }[typ]}` }
      : { unknown: true, text: `${cap(side)} bank plants not known` });
    parts.push(known(imp)
      ? { earned: imp === true ? 0 : 2, possible: 2, text: `${cap(side)} bank ${imp === true ? 'paved or built right to the edge' : 'not paved'}` }
      : { unknown: true, text: `${cap(side)} bank paving not known` });
  }
  parts.push(known(a.hasInvasivePlantSpecies)
    ? { earned: a.hasInvasivePlantSpecies === true ? 0 : 2, possible: 2, text: a.hasInvasivePlantSpecies === true ? 'Invasive plants seen' : 'No invasive plants seen' }
    : { unknown: true, text: 'Invasive plants not known' });
  parts.push(known(a.recentVegetationCuts)
    ? { earned: a.recentVegetationCuts === true ? 0 : 1, possible: 1, text: a.recentVegetationCuts === true ? 'Bank plants recently cut' : 'No recent cutting' }
    : { unknown: true, text: 'Cutting not known' });
  return component('Banks & margins', parts);
}

function water(a) {
  const colour = { CL: 10, MU: 4, FO: 2, CO: 0 };
  const flow = { FAS: 5, NOR: 5, STA: 2, DRY: 0 };
  const parts = [
    known(a.waterColor)
      ? { earned: colour[a.waterColor] ?? 0, possible: 10, text: `Water ${{ CL: 'clear', MU: 'muddy', FO: 'foamy', CO: 'strange colour' }[a.waterColor]}` }
      : { unknown: true, text: 'Water look not known' },
    known(a.waterFlow)
      ? { earned: flow[a.waterFlow] ?? 0, possible: 5, text: `Flow ${{ FAS: 'fast', NOR: 'slow', STA: 'still', DRY: 'dry' }[a.waterFlow]}` }
      : { unknown: true, text: 'Flow not known' },
  ];
  const pressures = [
    ['waterAbstraction', 2, 'Water being taken out'],
    ['hasDams', 2, 'Barriers across the water'],
    ['pipes', 1.5, 'Pipes or drains at the stream'],
    ['waterDischarge', 3, 'Dirty water flowing in'],
    ['construction', 1.5, 'Building works nearby'],
  ];
  for (const [id, weight, text] of pressures) {
    parts.push(known(a[id])
      ? { earned: a[id] === true ? 0 : weight, possible: weight, text: a[id] === true ? text : `No: ${text.toLowerCase()}` }
      : { unknown: true, text: `${text}: not known` });
  }
  return component('Water & pressures', parts);
}

function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

/**
 * Compute the condition view for a set of answers.
 * @returns {{score:number|null, band:string|null, components:object[], unknown:number, items:number, confidence:{level:string,value:number}, agreement:object|null}}
 */
export function conditionView(answers, citizenRating) {
  const a = answers || {};
  const components = [channel(a), habitat(a), margins(a), water(a)];
  const scored = components.filter((c) => c.score !== null);
  const score = scored.length === components.length
    ? components.reduce((s, c) => s + c.score, 0)
    : scored.length > 0
      ? (scored.reduce((s, c) => s + c.score, 0) / scored.length) * 4
      : null;
  const unknown = components.reduce((s, c) => s + c.unknown, 0);
  const items = components.reduce((s, c) => s + c.items, 0);
  const coverage = items ? (items - unknown) / items : 0;
  const level = coverage >= 0.85 ? 'High' : coverage >= 0.6 ? 'Medium' : 'Low';
  const band = bandFor(score);
  return {
    score: score === null ? null : Math.round(score),
    band,
    components: components.map((c) => ({ ...c, score: c.score === null ? null : Math.round(c.score * 10) / 10 })),
    unknown,
    items,
    confidence: { level, value: Math.round(coverage * 100) / 100 },
    agreement: citizenRating && band ? agreement(citizenRating, band) : null,
  };
}

const ORDER = { GOOD: 2, MODERATE: 1, POOR: 0 };

export function agreement(citizen, computed) {
  const gap = Math.abs(ORDER[citizen] - ORDER[computed]);
  return {
    gap,
    label: gap === 0 ? 'Matches your rating' : gap === 1 ? 'One step from your rating' : 'Far from your rating',
  };
}

/**
 * One Health notes: what the answers (and weather, if known) mean for the
 * ecosystem, for animals and for people. Each note lists the answers it used.
 */
export function oneHealthNotes(answers, weather) {
  const a = answers || {};
  const notes = [];
  const add = (domain, level, title, text, uses) => notes.push({ domain, level, title, text, uses });
  const warm = weather && weather.tmax3 != null && weather.tmax3 >= 25;

  if (a.waterDischarge === true || a.waterColor === 'FO' || (a.pipes === true && a.waterColor === 'MU')) {
    add('people', 'caution', 'Keep skin and paws out of the water',
      'Discharges, foam or muddy water at an outfall can carry sewage bacteria. Wash hands after the visit and keep dogs on the bank.',
      ['waterDischarge', 'waterColor', 'pipes']);
  }
  if (a.waterColor === 'CO' && (a.waterFlow === 'STA' || warm)) {
    add('people', 'caution', 'Possible algal bloom',
      'Unusual colour in still or warm water can mean an algal (cyanobacteria) bloom. Avoid contact and report it with a photo.',
      ['waterColor', 'waterFlow']);
  }
  if (a.waterFlow === 'STA') {
    add('animals', warm ? 'caution' : 'info', 'Still water and mosquitoes',
      warm ? 'Warm, still pools are where mosquitoes breed. Note any larvae you see.' : 'Still pools can breed mosquitoes when it gets warm.',
      ['waterFlow']);
  }
  if (a.hasInvasivePlantSpecies === true) {
    add('ecosystem', 'info', 'Invasive plants spread along streams',
      'Brush off shoes and tools before you leave, so seeds and fragments do not travel to the next stream.',
      ['hasInvasivePlantSpecies']);
  }
  const trees = a.vegetationType && (a.vegetationType.left === 'T' || a.vegetationType.right === 'T');
  if (trees) {
    add('people', 'benefit', 'Shade along the bank',
      'Trees cool the water for fish and insects, and make this stretch a cooler place to walk on hot days.',
      ['vegetationType']);
  }
  const habitats = Array.isArray(a.habitats) ? a.habitats.length : 0;
  if (habitats >= 3 && a.bottomChannelType === 'NAT') {
    add('ecosystem', 'benefit', 'Varied homes for wildlife',
      'A natural bed with several habitat types usually supports more kinds of insects, fish and birds.',
      ['habitats', 'bottomChannelType']);
  }
  if (a.waterFlow === 'DRY') {
    add('ecosystem', 'caution', 'Dry channel',
      'A dry urban stream loses most aquatic life. Repeated dry visits help the city plan for drought.',
      ['waterFlow']);
  }
  return notes;
}

/** Practical actions the community or city could take, from the weakest parts. */
export function suggestedActions(answers, tags = []) {
  const a = answers || {};
  const out = [];
  const either = (obj, v) => obj && (obj.left === v || obj.right === v);
  if (a.waterDischarge === true) out.push({ who: 'city', text: 'Report the discharge to the water utility with location and photo.' });
  if (either(a.isVegetationCovered, false)) out.push({ who: 'community', text: 'Plant native shrubs or trees on the bare bank.' });
  if (either(a.imperviousAreas, true)) out.push({ who: 'city', text: 'Green the paved edge (rain garden or planted buffer) to slow runoff.' });
  if (a.hasDams === true) out.push({ who: 'city', text: 'Check whether the barrier still has a purpose; a fish pass or removal reconnects the stream.' });
  if (a.hasInvasivePlantSpecies === true) out.push({ who: 'community', text: 'Map and flag the invasive stand for a supervised removal day.' });
  if (tags.includes('litter')) out.push({ who: 'community', text: 'Organise a clean-up: litter is the feature that most lowers how restorative a stream feels.' });
  if (tags.includes('unsafe')) out.push({ who: 'city', text: 'Improve lighting or sightlines on the path; feeling unsafe cancels the benefit of the visit.' });
  return out;
}
