// The "check yourself" half of a StreamWell visit.
//
// Before and after the stream check, the volunteer rates four feelings: joy,
// serenity, anger and fear. These are the same four items the OneAquaHealth
// Citizen Science App records (CitizenSubmissionPutDTO.joy/serenity/anger/fear),
// so the after-visit answers drop straight into an OAH submission. Asking them
// twice turns one rating into a change score for the visit.
//
// For blue-prescription participants StreamWell also uses the WHO-5 Well-Being
// Index (WHO Collaborating Centre in Mental Health, Psychiatric Centre North
// Zealand; free to use with citation) at the start and end of the programme.

export const EMOTIONS = [
  { id: 'joy', label: 'Joy', positive: true, prompt: 'How joyful do you feel?' },
  { id: 'serenity', label: 'Calm', positive: true, prompt: 'How calm and at peace do you feel?' },
  { id: 'anger', label: 'Irritation', positive: false, prompt: 'How irritated or angry do you feel?' },
  { id: 'fear', label: 'Worry', positive: false, prompt: 'How worried or uneasy do you feel?' },
];

export const SCALE = [
  { value: 1, label: 'Not at all' },
  { value: 2, label: 'A little' },
  { value: 3, label: 'Moderately' },
  { value: 4, label: 'Quite a lot' },
  { value: 5, label: 'Very much' },
];

/** What shaped how the visit felt. Short, concrete, and mappable to stream features. */
export const TAGS = [
  { id: 'waterSound', label: 'Sound of water', positive: true },
  { id: 'birds', label: 'Birds or wildlife', positive: true },
  { id: 'shade', label: 'Shade and trees', positive: true },
  { id: 'quiet', label: 'Quiet', positive: true },
  { id: 'clean', label: 'Clean and cared for', positive: true },
  { id: 'litter', label: 'Litter', positive: false },
  { id: 'smell', label: 'Bad smell', positive: false },
  { id: 'noise', label: 'Traffic noise', positive: false },
  { id: 'unsafe', label: 'Felt unsafe', positive: false },
  { id: 'concrete', label: 'Concrete and walls', positive: false },
];
export const TAG_BY_ID = Object.fromEntries(TAGS.map((t) => [t.id, t]));

export const TRAVEL = [
  { id: 'walk', label: 'Walked', active: true },
  { id: 'cycle', label: 'Cycled', active: true },
  { id: 'transit', label: 'Bus, tram or metro', active: false },
  { id: 'car', label: 'Car', active: false },
];

/** Mood balance on a 1-5 scale per item: positive items minus negative items, range -8..8. */
export function moodBalance(m) {
  if (!m) return null;
  if (EMOTIONS.some((e) => typeof m[e.id] !== 'number')) return null;
  return m.joy + m.serenity - m.anger - m.fear;
}

/**
 * Restoration for one visit: the average improvement across the four
 * feelings (negative feelings count as improvement when they go down).
 * Range -4..4; 0 means no change.
 */
export function restoration(before, after) {
  const b = moodBalance(before);
  const a = moodBalance(after);
  if (b === null || a === null) return null;
  return Math.round(((a - b) / 4) * 100) / 100;
}

/** Per-feeling change, signed so that positive = better. */
export function feelingChanges(before, after) {
  if (!before || !after) return [];
  return EMOTIONS.map((e) => {
    const raw = (after[e.id] ?? NaN) - (before[e.id] ?? NaN);
    return { id: e.id, label: e.label, before: before[e.id], after: after[e.id], better: e.positive ? raw : -raw };
  });
}

export function restorationLabel(r) {
  if (r === null || r === undefined) return '—';
  if (r >= 1) return 'Strongly restored';
  if (r >= 0.4) return 'Restored';
  if (r > -0.25) return 'About the same';
  return 'Felt worse';
}

// --- WHO-5 --------------------------------------------------------------------
export const WHO5 = {
  title: 'WHO-5 Well-Being Index',
  period: 'Over the last two weeks',
  items: [
    { id: 'who5-1', text: 'I have felt cheerful and in good spirits' },
    { id: 'who5-2', text: 'I have felt calm and relaxed' },
    { id: 'who5-3', text: 'I have felt active and vigorous' },
    { id: 'who5-4', text: 'I woke up feeling fresh and rested' },
    { id: 'who5-5', text: 'My daily life has been filled with things that interest me' },
  ],
  answers: [
    { value: 5, label: 'All of the time' },
    { value: 4, label: 'Most of the time' },
    { value: 3, label: 'More than half of the time' },
    { value: 2, label: 'Less than half of the time' },
    { value: 1, label: 'Some of the time' },
    { value: 0, label: 'At no time' },
  ],
  citation: 'Topp CW, Østergaard SD, Søndergaard S, Bech P. The WHO-5 Well-Being Index: a systematic review of the literature. Psychother Psychosom. 2015;84(3):167-176.',
};

/** WHO-5 percentage score 0-100 (raw 0-25 multiplied by 4). */
export function who5Score(responses) {
  const vals = WHO5.items.map((i) => responses && responses[i.id]);
  if (vals.some((v) => typeof v !== 'number')) return null;
  return vals.reduce((s, v) => s + v, 0) * 4;
}

/** A 10-point change is the commonly used threshold for a meaningful change. */
export function who5Change(baseline, followUp) {
  if (baseline == null || followUp == null) return null;
  const d = followUp - baseline;
  return { delta: d, meaningful: Math.abs(d) >= 10, direction: d > 0 ? 'better' : d < 0 ? 'worse' : 'same' };
}
