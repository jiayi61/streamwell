// The stream check follows the OneAquaHealth Citizen Science App submission
// (CitizenSubmissionPutDTO in https://api.enora-oah.eu/v3/api-docs) field by
// field, and reuses the app's own answer codes from its lookup endpoints
// (/api/citizens/water_flows, water_colors, channel_types, channel_forms,
// bank_types, habitats, fallen_biomass, vegetation_types, stream_assessments),
// retrieved 2026-10-03. StreamWell adds plain-language wording, a "not sure"
// answer, and the scientific term under each question.

export const UNSURE = 'UNSURE';

/** Indicator codes from the hl7-eu/oah IG TemporaryOahSystem used for each question. */
export const OAH_INDICATOR = {
  hydrology: 'hydrology',
  morphology: 'morophology', // spelled this way in the IG code system
  landUse: 'LandUse',
  riparian: 'riparianVegetation',
  foam: 'foam',
  invasive: 'invasiveOrganisms',
};

export const STEPS = [
  { id: 'water', title: 'The water', hint: 'Look at the water in front of you.' },
  { id: 'channel', title: 'The channel', hint: 'The bed and banks that hold the water.' },
  { id: 'life', title: 'Places for life', hint: 'Spots where small animals and plants live.' },
  { id: 'margins', title: 'The banks, left and right', hint: 'Stand facing downstream: left is your left hand.' },
  { id: 'pressures', title: 'Human pressures', hint: 'Things people built or do here.' },
  { id: 'overall', title: 'Your overall view', hint: 'Your rating is the one that gets recorded.' },
];

/**
 * Question types:
 *  single  - one option
 *  multi   - any number of options (none allowed)
 *  bool    - yes / no
 *  side    - asked for the left and the right bank (value: {left, right})
 *  number  - optional number
 */
export const QUESTIONS = [
  {
    id: 'waterFlow', step: 'water', type: 'single', oah: OAH_INDICATOR.hydrology,
    prompt: 'How is the water moving?',
    science: 'Flow type',
    help: 'Watch a leaf or bubble for a few seconds.',
    options: [
      { code: 'FAS', label: 'Fast', detail: 'waves, splashing or a quick current', oahLabel: 'Fast (with waves or high velocity) (A)', icon: 'flowFast' },
      { code: 'NOR', label: 'Slow', detail: 'moving gently', oahLabel: 'Slow (B)', icon: 'flowSlow' },
      { code: 'STA', label: 'Still', detail: 'barely moving, or only in pools', oahLabel: 'Stagnant/intermittent (C)', icon: 'flowStill' },
      { code: 'DRY', label: 'Dry', detail: 'no water in the channel', oahLabel: 'Dry (D)', icon: 'flowDry' },
    ],
  },
  {
    id: 'waterColor', step: 'water', type: 'single', oah: OAH_INDICATOR.foam,
    prompt: 'What does the water look like?',
    science: 'Water aspect (colour, turbidity, foam)',
    help: 'Pick the strongest thing you notice.',
    options: [
      { code: 'CL', label: 'Clear', detail: 'you can see the bottom where it is shallow', oahLabel: 'Clear/transparent (A)', swatch: '#9fd3e6' },
      { code: 'MU', label: 'Muddy', detail: 'brown or cloudy', oahLabel: 'Muddy/turbid (B)', swatch: '#a07d52' },
      { code: 'FO', label: 'Foamy', detail: 'foam or bubbles that stay on the surface', oahLabel: 'Has foam (C)', swatch: '#eef1f2' },
      { code: 'CO', label: 'Strange colour', detail: 'green, milky, grey, oily or other', oahLabel: 'Has colors/altered color (D)', swatch: '#6f9a3c' },
    ],
  },
  {
    id: 'waterHeight', step: 'water', type: 'number', optional: true, unit: 'cm', min: 0, max: 500,
    prompt: 'About how deep is the water where you stand? (optional)',
    science: 'Water height',
    help: 'A rough guess is fine. Never step into the water to measure.',
  },
  {
    id: 'channelForm', step: 'channel', type: 'single', oah: OAH_INDICATOR.morphology,
    prompt: 'What shape is the channel?',
    science: 'Channel form (cross-section)',
    help: 'Imagine cutting the stream across and looking at the slice.',
    options: [
      { code: 'FLAT', label: 'Wide and flat', oahLabel: 'Flat (Α)', icon: 'formFlat' },
      { code: 'U', label: 'U shape', oahLabel: 'U Shape (Β)', icon: 'formU' },
      { code: 'V', label: 'V shape', detail: 'steep sides, narrow bottom', oahLabel: 'V Shape (C)', icon: 'formV' },
    ],
  },
  {
    id: 'bottomChannelType', step: 'channel', type: 'single', oah: OAH_INDICATOR.morphology,
    prompt: 'What is the stream bed made of?',
    science: 'Channel bed type',
    options: [
      { code: 'NAT', label: 'Natural', detail: 'stones, gravel, sand or mud', oahLabel: 'Natural (Α)', icon: 'bedNatural' },
      { code: 'ART', label: 'Built', detail: 'concrete, or stones set in concrete', oahLabel: 'Artificial (concrete or stones with concrete) (Β)', icon: 'bedConcrete' },
    ],
  },
  {
    id: 'banksChannelType', step: 'channel', type: 'single', oah: OAH_INDICATOR.morphology,
    prompt: 'What are the banks made of?',
    science: 'Bank type',
    options: [
      { code: 'NAT', label: 'Natural', detail: 'soil, roots, plants', oahLabel: 'Natural (Α)', icon: 'bankNatural' },
      { code: 'LAS', label: 'Loose stones', detail: 'stones laid without concrete', oahLabel: 'Layed stones with no concrete (C)', icon: 'bankStones' },
      { code: 'ART', label: 'Built', detail: 'concrete walls or stones with concrete', oahLabel: 'Artificial (concrete or stones with concrete) (Β)', icon: 'bankConcrete' },
    ],
  },
  {
    id: 'habitats', step: 'life', type: 'multi', oah: OAH_INDICATOR.morphology,
    prompt: 'Which of these can you see in the water?',
    science: 'In-stream habitats',
    help: 'Choose all that apply. Each one is a home for different animals.',
    options: [
      { code: 'SB', label: 'Sand banks', detail: 'sand along the edge', oahLabel: 'Sand banks (A)', icon: 'habSandBank' },
      { code: 'SI', label: 'Sand islands', detail: 'sand or gravel in the middle', oahLabel: 'Sand islands (B)', icon: 'habIsland' },
      { code: 'SD', label: 'Stones', detail: 'piles of pebbles or rocks', oahLabel: 'Stone deposits (C)', icon: 'habStones' },
      { code: 'RF', label: 'Riffles or small falls', detail: 'water rushing over stones', oahLabel: 'Riffles, rapids, falls (D)', icon: 'habRiffle' },
      { code: 'AV', label: 'Water plants', detail: 'plants growing in the water', oahLabel: 'Aquatic vegetation (E)', icon: 'habPlants' },
    ],
  },
  {
    id: 'fallenBiomassTypes', step: 'life', type: 'multi', oah: OAH_INDICATOR.morphology,
    prompt: 'Is there natural debris in or by the water?',
    science: 'Fallen biomass (woody debris, leaf packs)',
    help: 'Wood and leaves are food and shelter, not mess.',
    options: [
      { code: 'FT', label: 'Fallen trees', oahLabel: 'Fallen trees (A)', icon: 'bioTree' },
      { code: 'FB', label: 'Fallen branches', oahLabel: 'Fallen branches (B)', icon: 'bioBranch' },
      { code: 'FL', label: 'Piles of leaves', oahLabel: 'Deposits of fallen leaves (C)', icon: 'bioLeaves' },
    ],
  },
  {
    id: 'imperviousAreas', step: 'margins', type: 'side', valueType: 'bool', oah: OAH_INDICATOR.landUse,
    oahFields: { left: 'imperviousAreasLeft', right: 'imperviousAreasRight' },
    prompt: 'Is there paving, a road or buildings right next to the water?',
    science: 'Impervious areas in the margin',
  },
  {
    id: 'isVegetationCovered', step: 'margins', type: 'side', valueType: 'bool', oah: OAH_INDICATOR.riparian,
    oahFields: { left: 'isVegetationCoveredLeft', right: 'isVegetationCoveredRight' },
    prompt: 'Are the banks mostly covered by plants?',
    science: 'Riparian vegetation cover',
  },
  {
    id: 'vegetationType', step: 'margins', type: 'side', valueType: 'single', oah: OAH_INDICATOR.riparian,
    oahFields: { left: 'vegetationTypeLeft', right: 'vegetationTypeRight' },
    prompt: 'What are the tallest plants on each bank?',
    science: 'Dominant riparian vegetation type',
    options: [
      { code: 'H', label: 'Grass and herbs', oahLabel: 'Herbs (A)', icon: 'vegHerbs' },
      { code: 'B', label: 'Shrubs', oahLabel: 'Shrubs (B)', icon: 'vegShrubs' },
      { code: 'T', label: 'Trees', oahLabel: 'Trees (C)', icon: 'vegTrees' },
    ],
  },
  {
    id: 'hasInvasivePlantSpecies', step: 'margins', type: 'bool', oah: OAH_INDICATOR.invasive,
    prompt: 'Do you see plants that are known to be invasive here?',
    science: 'Invasive plant species',
    help: 'For example giant reed, Japanese knotweed or Himalayan balsam. Say "not sure" if you do not know.',
    followUp: { id: 'invasivePlantSpecies', type: 'text', prompt: 'Which one(s), if you know?' },
  },
  {
    id: 'recentVegetationCuts', step: 'margins', type: 'bool', oah: OAH_INDICATOR.riparian,
    prompt: 'Have the bank plants been cut or mowed recently?',
    science: 'Recent vegetation cuts',
  },
  {
    id: 'waterAbstraction', step: 'pressures', type: 'bool', oah: OAH_INDICATOR.hydrology,
    prompt: 'Is anyone taking water out (pumps, hoses, channels)?',
    science: 'Water abstraction',
  },
  {
    id: 'hasDams', step: 'pressures', type: 'bool', oah: OAH_INDICATOR.hydrology,
    prompt: 'Are there dams, weirs or other barriers across the water?',
    science: 'Barriers to connectivity',
    followUp: { id: 'numberOfDams', type: 'number', prompt: 'How many can you see?', min: 1, max: 20 },
  },
  {
    id: 'pipes', step: 'pressures', type: 'bool', oah: OAH_INDICATOR.landUse,
    prompt: 'Do you see pipes or drains ending at the stream?',
    science: 'Outfall pipes',
  },
  {
    id: 'waterDischarge', step: 'pressures', type: 'bool', oah: OAH_INDICATOR.foam,
    prompt: 'Is dirty or smelly water flowing in from a pipe or ditch?',
    science: 'Polluted discharge',
    help: 'Do not touch it. A photo from a safe distance helps the city act.',
  },
  {
    id: 'construction', step: 'pressures', type: 'bool', oah: OAH_INDICATOR.landUse,
    prompt: 'Are there building works or machines near the stream?',
    science: 'Construction works',
  },
  {
    id: 'overallAssessment', step: 'overall', type: 'single', noUnsure: true,
    prompt: 'Overall, how healthy does this stretch look to you?',
    science: 'Overall assessment (OAH three-class scale)',
    options: [
      { code: 'GOOD', label: 'Good', detail: 'natural channel, plants on the banks, water looks good, lots of life', oahLabel: 'Good quality' },
      { code: 'MODERATE', label: 'Moderate', detail: 'some changes, but still plants on the banks and water looks fine', oahLabel: 'Moderate quality' },
      { code: 'POOR', label: 'Poor', detail: 'heavily built-up, few plants or habitats, signs of pollution', oahLabel: 'Poor quality' },
    ],
  },
];

export const QUESTION_BY_ID = Object.fromEntries(QUESTIONS.map((q) => [q.id, q]));

export function questionsForStep(stepId) {
  return QUESTIONS.filter((q) => q.step === stepId);
}

export function optionLabel(questionId, code) {
  if (code === UNSURE) return 'Not sure';
  const q = QUESTION_BY_ID[questionId];
  const o = q && q.options && q.options.find((x) => x.code === code);
  return o ? o.label : String(code);
}

/** True when an answer has been given (including "not sure"). */
export function isAnswered(q, value) {
  if (q.optional) return true;
  if (q.type === 'multi') return Array.isArray(value);
  if (q.type === 'side') return value && value.left !== undefined && value.right !== undefined;
  return value !== undefined && value !== null && value !== '';
}

/**
 * Turn StreamWell answers into the OAH Citizen Science App submission shape
 * (CitizenSubmissionPutDTO). "Not sure" becomes null so nothing is invented.
 */
export function toOahSubmission(visit) {
  const a = visit.answers || {};
  const val = (v) => (v === UNSURE || v === undefined ? null : v);
  const side = (id, s) => (a[id] ? val(a[id][s]) : null);
  const emo = visit.after || {};
  return {
    latitude: visit.lat,
    longitude: visit.lon,
    researchSite: visit.site,
    channelForm: val(a.channelForm),
    bottomChannelType: val(a.bottomChannelType),
    banksChannelType: val(a.banksChannelType),
    habitats: Array.isArray(a.habitats) ? a.habitats : [],
    fallenBiomassTypes: Array.isArray(a.fallenBiomassTypes) ? a.fallenBiomassTypes : [],
    waterFlow: val(a.waterFlow),
    waterColor: val(a.waterColor),
    waterAbstraction: val(a.waterAbstraction),
    hasDams: val(a.hasDams),
    numberOfDams: a.hasDams === true ? Number(a.numberOfDams || 1) : 0,
    pipes: val(a.pipes),
    waterDischarge: val(a.waterDischarge),
    construction: val(a.construction),
    waterHeight: a.waterHeight === undefined || a.waterHeight === '' ? null : Number(a.waterHeight),
    imperviousAreasLeft: side('imperviousAreas', 'left'),
    imperviousAreasRight: side('imperviousAreas', 'right'),
    isVegetationCoveredLeft: side('isVegetationCovered', 'left'),
    isVegetationCoveredRight: side('isVegetationCovered', 'right'),
    vegetationTypeLeft: side('vegetationType', 'left'),
    vegetationTypeRight: side('vegetationType', 'right'),
    hasInvasivePlantSpecies: val(a.hasInvasivePlantSpecies),
    invasivePlantSpecies: a.invasivePlantSpecies || null,
    recentVegetationCuts: val(a.recentVegetationCuts),
    overallAssessment: val(a.overallAssessment),
    // The OAH app records how the place made you feel. StreamWell sends the
    // after-visit values, and keeps the before-visit baseline on the phone.
    joy: emo.joy ?? null,
    serenity: emo.serenity ?? null,
    anger: emo.anger ?? null,
    fear: emo.fear ?? null,
  };
}
