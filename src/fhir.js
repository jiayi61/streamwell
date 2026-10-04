// HL7 FHIR R4 for StreamWell, built on the OneAquaHealth Implementation Guide
// (hl7-eu/oah, canonical http://hl7.eu/fhir/ig/oah, version 0.1.0-ci-build).
//
// Three bundles, three audiences, three privacy levels:
//  1. Stream observation bundle (OAH research): LocationOah + one
//     ObservationIndicatorsOah per OAH indicator, coded with the IG's
//     TemporaryOahSystem and the OAH app's own answer codes. No personal data.
//  2. Personal well-being record (the volunteer, and their clinician only if
//     they choose): Questionnaire / QuestionnaireResponse for the before/after
//     check-in, an Observation of the restoration change, a Consent.
//  3. Health measures (OAH research, aggregated): ObservationHealthMeasureOah
//     with a GroupOah cohort per site, suppressed below k visitors.
// Plus the blue-prescription CarePlan that links a clinician, a person and the
// streams they walk along.

import { QUESTIONS, UNSURE } from './protocol.js';
import { SITE_BY_CODE, CITIES } from './sites.js';
import { EMOTIONS, TAGS, TRAVEL, WHO5, restoration, who5Score } from './wellbeing.js';
import { conditionView } from './score.js';

export const OAH = {
  ig: 'http://hl7.eu/fhir/ig/oah',
  cs: 'http://hl7.eu/fhir/ig/oah/CodeSystem/temporarySystem-oah-eu',
  location: 'http://hl7.eu/fhir/ig/oah/StructureDefinition/location-oah',
  indicator: 'http://hl7.eu/fhir/ig/oah/StructureDefinition/observation-indicators-oah',
  healthMeasure: 'http://hl7.eu/fhir/ig/oah/StructureDefinition/observation-health-measure-oah',
  group: 'http://hl7.eu/fhir/ig/oah/StructureDefinition/group-oah',
  locationIdSystem: 'https://oneaquahealth.eu/location-id',
};

export const SW_BASE = 'https://jiayi61.github.io/streamwell/fhir';
export const SW = {
  cs: `${SW_BASE}/CodeSystem/streamwell`,
  answers: `${SW_BASE}/CodeSystem/oah-citizen-answer`,
  questionnaireVisit: `${SW_BASE}/Questionnaire/streamwell-visit`,
  questionnaireWho5: `${SW_BASE}/Questionnaire/who5`,
  pseudonym: `${SW_BASE}/NamingSystem/pseudonym`,
};

const SCT = 'http://snomed.info/sct';
const LOINC = 'http://loinc.org';
const DAR = 'http://terminology.hl7.org/CodeSystem/data-absent-reason';
const OBS_CAT = 'http://terminology.hl7.org/CodeSystem/observation-category';

const oah = (code, display) => ({ coding: [{ system: OAH.cs, code, display }] });
const sw = (code, display) => ({ coding: [{ system: SW.cs, code, display }], text: display });
const present = (b) => (b === true ? oah('present', 'Present') : oah('absent', 'Absent'));
const unknownValue = { coding: [{ system: DAR, code: 'asked-unknown', display: 'Asked But Unknown' }], text: 'Not sure' };

let counter = 0;
export function uuid() {
  if (globalThis.crypto && globalThis.crypto.randomUUID) return globalThis.crypto.randomUUID();
  counter += 1;
  return `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}`;
}

function answerConcept(questionId, code) {
  if (code === UNSURE || code === undefined || code === null) return unknownValue;
  const q = QUESTIONS.find((x) => x.id === questionId);
  const o = q && q.options ? q.options.find((x) => x.code === code) : null;
  return { coding: [{ system: SW.answers, code, display: o ? o.oahLabel : String(code) }], text: o ? o.label : String(code) };
}
const boolConcept = (v) => (v === UNSURE || v === undefined || v === null ? unknownValue : present(v));

// ------------------------------------------------------------------ Location
export function cityLocation(cityId) {
  const c = CITIES[cityId];
  return {
    resourceType: 'Location',
    id: `oah-city-${cityId}`,
    meta: { profile: [OAH.location] },
    identifier: [{ system: OAH.locationIdSystem, value: c.name.toLowerCase() }],
    name: c.name,
    mode: 'instance',
    type: [{ coding: [{ system: SCT, code: '288520005', display: 'City environment' }] }],
    position: { latitude: c.lat, longitude: c.lon },
  };
}

export function siteLocation(code) {
  const s = SITE_BY_CODE[code];
  if (!s) throw new Error(`Unknown OAH site ${code}`);
  const loc = {
    resourceType: 'Location',
    id: `oah-site-${code}`,
    meta: { profile: [OAH.location] },
    identifier: [{ system: OAH.locationIdSystem, value: code }],
    name: s.name,
    description: `OneAquaHealth research site ${code} (${CITIES[s.city].name})`,
    mode: 'instance',
    type: [{ text: 'Urban stream research site' }],
    position: { latitude: s.lat, longitude: s.lon, ...(s.alt != null ? { altitude: s.alt } : {}) },
    partOf: { reference: `Location/oah-city-${s.city}` },
  };
  return loc;
}

// ---------------------------------------------------- stream observations
const PERFORMER = [{ display: 'Citizen scientist (anonymous, StreamWell)' }];

function indicatorObs({ id, code, value, components, visit, notes }) {
  const obs = {
    resourceType: 'Observation',
    id,
    meta: { profile: [OAH.indicator] },
    status: 'final',
    category: [sw('citizen-science', 'Citizen science observation')],
    code,
    subject: { reference: `Location/oah-site-${visit.site}` },
    effectiveDateTime: visit.datetime || visit.date,
    performer: PERFORMER,
  };
  if (value) {
    if (value.value !== undefined) obs.valueQuantity = value;
    else obs.valueCodeableConcept = value;
  }
  const comps = (components || []).filter(Boolean);
  if (comps.length) obs.component = comps;
  if (notes && notes.length) obs.note = notes.map((text) => ({ text }));
  return obs;
}

const comp = (code, display, value) => ({ code: sw(code, display), ...(value.value !== undefined ? { valueQuantity: value } : { valueCodeableConcept: value }) });

/** Second-look decisions as human-readable notes on the observation they concern. */
function notesFor(fields, decisions) {
  return (decisions || [])
    .filter((d) => d.uses && d.uses.some((u) => fields.includes(u)))
    .map((d) => `Second look "${d.title}": volunteer ${d.decision === 'changed' ? 'changed the answer' : d.decision === 'kept' ? 'kept the answer' : 'saw the note'}${d.note ? ` (${d.note})` : ''}.`);
}

export function streamObservations(visit) {
  const a = visit.answers || {};
  const key = visit.id.replace(/[^A-Za-z0-9-]/g, '').slice(0, 40);
  const dec = visit.decisions || [];
  const obs = [];
  obs.push(indicatorObs({
    id: `${key}-hydrology`, visit,
    code: oah('hydrology', 'Hydrology of the stream'),
    value: answerConcept('waterFlow', a.waterFlow),
    components: [
      comp('water-abstraction', 'Water abstraction', boolConcept(a.waterAbstraction)),
      comp('barriers', 'Barriers across the stream', boolConcept(a.hasDams)),
      a.hasDams === true && a.numberOfDams ? comp('barrier-count', 'Number of barriers', { value: Number(a.numberOfDams), unit: 'barriers', system: 'http://unitsofmeasure.org', code: '1' }) : null,
      a.waterHeight !== undefined && a.waterHeight !== '' && a.waterHeight !== null ? comp('water-height', 'Water height', { value: Number(a.waterHeight), unit: 'cm', system: 'http://unitsofmeasure.org', code: 'cm' }) : null,
    ],
    notes: notesFor(['waterFlow', 'waterAbstraction', 'hasDams'], dec),
  }));
  obs.push(indicatorObs({
    id: `${key}-morphology`, visit,
    code: oah('morophology', 'Morphology of the streams'),
    components: [
      comp('channel-form', 'Channel form', answerConcept('channelForm', a.channelForm)),
      comp('bed-type', 'Channel bed type', answerConcept('bottomChannelType', a.bottomChannelType)),
      comp('bank-type', 'Bank type', answerConcept('banksChannelType', a.banksChannelType)),
      ...(Array.isArray(a.habitats) ? a.habitats.map((h) => comp('habitat', 'In-stream habitat', answerConcept('habitats', h))) : []),
      ...(Array.isArray(a.fallenBiomassTypes) ? a.fallenBiomassTypes.map((h) => comp('fallen-biomass', 'Fallen biomass', answerConcept('fallenBiomassTypes', h))) : []),
    ],
    notes: notesFor(['channelForm', 'bottomChannelType', 'banksChannelType', 'habitats', 'fallenBiomassTypes'], dec),
  }));
  const side = (id, s) => (a[id] ? a[id][s] : undefined);
  obs.push(indicatorObs({
    id: `${key}-riparian`, visit,
    code: oah('riparianVegetation', 'Riparian vegetation'),
    components: [
      comp('vegetation-cover-left', 'Left bank covered by vegetation', boolConcept(side('isVegetationCovered', 'left'))),
      comp('vegetation-cover-right', 'Right bank covered by vegetation', boolConcept(side('isVegetationCovered', 'right'))),
      comp('vegetation-type-left', 'Left bank dominant vegetation', answerConcept('vegetationType', side('vegetationType', 'left'))),
      comp('vegetation-type-right', 'Right bank dominant vegetation', answerConcept('vegetationType', side('vegetationType', 'right'))),
      comp('recent-cuts', 'Recent vegetation cuts', boolConcept(a.recentVegetationCuts)),
    ],
    notes: notesFor(['isVegetationCovered', 'vegetationType', 'recentVegetationCuts'], dec),
  }));
  obs.push(indicatorObs({
    id: `${key}-landuse`, visit,
    code: oah('LandUse', 'Land use in the margins'),
    components: [
      comp('impervious-left', 'Impervious area at left bank', boolConcept(side('imperviousAreas', 'left'))),
      comp('impervious-right', 'Impervious area at right bank', boolConcept(side('imperviousAreas', 'right'))),
      comp('outfall-pipes', 'Outfall pipes', boolConcept(a.pipes)),
      comp('construction', 'Construction works', boolConcept(a.construction)),
    ],
    notes: notesFor(['imperviousAreas', 'pipes', 'construction'], dec),
  }));
  obs.push(indicatorObs({
    id: `${key}-water-aspect`, visit,
    code: oah('foam', 'Foam/colour/smell'),
    value: answerConcept('waterColor', a.waterColor),
    components: [
      comp('polluted-discharge', 'Polluted discharge', boolConcept(a.waterDischarge)),
      ...(visit.tags && visit.tags.includes('smell') ? [comp('bad-smell', 'Bad smell noticed', present(true))] : []),
    ],
    notes: notesFor(['waterColor', 'waterDischarge'], dec),
  }));
  obs.push(indicatorObs({
    id: `${key}-invasive`, visit,
    code: oah('invasiveOrganisms', 'Invasive invertebrate, plants and fish'),
    value: boolConcept(a.hasInvasivePlantSpecies),
    components: [a.invasivePlantSpecies ? { code: sw('invasive-species-name', 'Invasive species named by volunteer'), valueString: String(a.invasivePlantSpecies).slice(0, 120) } : null],
    notes: notesFor(['hasInvasivePlantSpecies'], dec),
  }));
  obs.push(indicatorObs({
    id: `${key}-overall`, visit,
    code: sw('overall-assessment', 'Overall stream quality (OAH three-class scale)'),
    value: answerConcept('overallAssessment', a.overallAssessment),
    notes: notesFor(['overallAssessment'], dec),
  }));
  const cond = conditionView(a, a.overallAssessment);
  if (cond.score !== null) {
    const derived = indicatorObs({
      id: `${key}-condition-view`, visit,
      code: sw('condition-view', 'StreamWell condition view (decision support, not a validated index)'),
      value: { value: cond.score, unit: 'points', system: 'http://unitsofmeasure.org', code: '1' },
      components: cond.components.filter((c) => c.score !== null).map((c) => comp(slug(c.label), c.label, { value: c.score, unit: 'points of 25', system: 'http://unitsofmeasure.org', code: '1' })),
    });
    derived.performer = [{ display: 'StreamWell condition view v1 (rules in src/score.js)' }];
    derived.interpretation = [{ text: `${cond.band} (confidence ${cond.confidence.level})` }];
    derived.derivedFrom = obs.map((o) => ({ reference: `Observation/${o.id}` }));
    obs.push(derived);
  }
  return obs;
}

function slug(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''); }

const escHtml = (x) => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const conceptText = (cc) => (cc ? cc.text || (cc.coding && cc.coding[0] && (cc.coding[0].display || cc.coding[0].code)) || '' : '');
function valueText(r) {
  if (r.valueQuantity) return `${r.valueQuantity.value} ${r.valueQuantity.unit || ''}`.trim();
  if (r.valueCodeableConcept) return conceptText(r.valueCodeableConcept);
  if (r.valueString) return r.valueString;
  if (r.dataAbsentReason) return `no value (${conceptText(r.dataAbsentReason)})`;
  return (r.component || []).map((c) => `${conceptText(c.code)}: ${c.valueQuantity ? `${c.valueQuantity.value} ${c.valueQuantity.unit || ''}` : c.valueCodeableConcept ? conceptText(c.valueCodeableConcept) : c.valueString || ''}`).join('; ');
}
/** A short human-readable narrative (Resource.text), generated from the data. */
export function narrative(r) {
  let t;
  switch (r.resourceType) {
    case 'Location': t = `${r.name}${r.identifier ? ` (${r.identifier[0].value})` : ''}${r.description ? `: ${r.description}` : ''}`; break;
    case 'Observation': t = `${conceptText(r.code)}: ${valueText(r)}${r.effectiveDateTime ? ` (${r.effectiveDateTime.slice(0, 10)})` : r.effectivePeriod ? ` (${r.effectivePeriod.start} to ${r.effectivePeriod.end})` : ''}`; break;
    case 'Group': t = r.name || 'Cohort'; break;
    case 'Patient': t = `Pseudonymous person ${r.identifier ? r.identifier[0].value : r.id}`; break;
    case 'Practitioner': t = r.name ? r.name[0].text : 'Practitioner'; break;
    case 'Questionnaire': t = r.title || r.name; break;
    case 'QuestionnaireResponse': t = `Answers to ${r.questionnaire} (${r.status}, ${String(r.authored || '').slice(0, 10)})`; break;
    case 'CarePlan': t = `${r.title}${r.period ? ` (${r.period.start} to ${r.period.end})` : ''}`; break;
    case 'Goal': t = conceptText(r.description); break;
    case 'Consent': t = `Consent: ${conceptText(r.scope)}, ${r.provision ? r.provision.type : ''} (${conceptText(r.policyRule)})`; break;
    default: t = r.resourceType;
  }
  return { status: 'generated', div: `<div xmlns="http://www.w3.org/1999/xhtml"><p>${escHtml(t)}</p></div>` };
}

function entry(resource, transaction) {
  const e = { fullUrl: `urn:uuid:${uuid()}`, resource };
  if (transaction) e.request = { method: 'PUT', url: `${resource.resourceType}/${resource.id}` };
  return e;
}

/** Bundle references use "Type/id"; give every entry a matching fullUrl. */
function bundle(type, resources) {
  const tx = type === 'transaction';
  resources.forEach((r) => { if (!r.text) r.text = narrative(r); });
  const entries = resources.map((r) => entry(r, tx));
  // In a transaction with PUT the server resolves Type/id references directly.
  if (!tx) entries.forEach((e) => { e.fullUrl = `${SW_BASE}/${e.resource.resourceType}/${e.resource.id}`; });
  return { resourceType: 'Bundle', id: uuid(), meta: { lastUpdated: new Date().toISOString() }, type, timestamp: new Date().toISOString(), entry: entries };
}

/** 1. Stream observation bundle for OAH research (no personal data). */
export function streamBundle(visit, type = 'collection') {
  const s = SITE_BY_CODE[visit.site];
  return bundle(type, [cityLocation(s.city), siteLocation(visit.site), ...streamObservations(visit)]);
}

// ---------------------------------------------------- personal well-being
export function visitQuestionnaire() {
  const feelingItems = (prefix) => EMOTIONS.map((e) => ({ linkId: `${prefix}.${e.id}`, text: e.prompt, type: 'integer', required: true, extension: [{ url: 'http://hl7.org/fhir/StructureDefinition/minValue', valueInteger: 1 }, { url: 'http://hl7.org/fhir/StructureDefinition/maxValue', valueInteger: 5 }] }));
  return {
    resourceType: 'Questionnaire',
    id: 'streamwell-visit',
    url: SW.questionnaireVisit,
    version: '1.0.0',
    name: 'StreamWellVisitCheckIn',
    title: 'StreamWell visit check-in and check-out',
    status: 'draft',
    experimental: true,
    subjectType: ['Patient'],
    description: 'Before and after a stream visit: the four feelings recorded by the OneAquaHealth Citizen Science App (joy, serenity, anger, fear) on a 1-5 scale, plus what shaped the visit. The restoration change is the mean improvement across the four feelings.',
    item: [
      { linkId: 'before', text: 'Before you look at the stream', type: 'group', item: feelingItems('before') },
      { linkId: 'after', text: 'After the stream check', type: 'group', item: feelingItems('after') },
      { linkId: 'tags', text: 'What shaped how you felt?', type: 'choice', repeats: true, answerOption: TAGS.map((t) => ({ valueCoding: { system: SW.cs, code: `tag-${t.id}`, display: t.label } })) },
      { linkId: 'minutes', text: 'Minutes spent at the stream', type: 'integer' },
      { linkId: 'travel', text: 'How did you get here?', type: 'choice', answerOption: TRAVEL.map((t) => ({ valueCoding: { system: SW.cs, code: `travel-${t.id}`, display: t.label } })) },
    ],
  };
}

export function who5Questionnaire() {
  return {
    resourceType: 'Questionnaire',
    id: 'who5',
    url: SW.questionnaireWho5,
    version: '1.0.0',
    name: 'WHO5WellBeingIndex',
    title: WHO5.title,
    status: 'draft',
    experimental: true,
    subjectType: ['Patient'],
    copyright: 'WHO-5 Well-Being Index, Psychiatric Research Unit, WHO Collaborating Centre in Mental Health, Mental Health Centre North Zealand. Free to use; cite Topp et al. 2015.',
    description: `${WHO5.period}. Raw score 0-25, multiplied by 4 for a 0-100 percentage score.`,
    item: WHO5.items.map((i) => ({
      linkId: i.id,
      text: i.text,
      type: 'choice',
      required: true,
      answerOption: WHO5.answers.map((a) => ({ valueCoding: { system: SW.cs, code: `who5-${a.value}`, display: a.label } })),
    })),
  };
}

export function pseudonymousPatient(pseudonym) {
  return {
    resourceType: 'Patient',
    id: `sw-${pseudonym}`,
    identifier: [{ system: SW.pseudonym, value: pseudonym }],
    active: true,
  };
}

export function visitQuestionnaireResponse(visit, patientRef) {
  const feelings = (prefix, m) => ({ linkId: prefix, item: EMOTIONS.map((e) => ({ linkId: `${prefix}.${e.id}`, answer: [{ valueInteger: m[e.id] }] })) });
  const items = [feelings('before', visit.before), feelings('after', visit.after)];
  if (visit.tags && visit.tags.length) items.push({ linkId: 'tags', answer: visit.tags.map((t) => ({ valueCoding: { system: SW.cs, code: `tag-${t}` } })) });
  if (visit.minutes) items.push({ linkId: 'minutes', answer: [{ valueInteger: visit.minutes }] });
  if (visit.travel) items.push({ linkId: 'travel', answer: [{ valueCoding: { system: SW.cs, code: `travel-${visit.travel}` } }] });
  return {
    resourceType: 'QuestionnaireResponse',
    id: `${visit.id}-qr`.replace(/[^A-Za-z0-9-.]/g, '').slice(0, 60),
    questionnaire: SW.questionnaireVisit,
    status: 'completed',
    subject: { reference: patientRef },
    authored: visit.datetime || visit.date,
    item: items,
  };
}

const EVENT_LOCATION = 'http://hl7.org/fhir/StructureDefinition/event-location';

export function restorationObservation(visit, patientRef, qrId) {
  const r = restoration(visit.before, visit.after);
  return {
    resourceType: 'Observation',
    id: `${visit.id}-restoration`.replace(/[^A-Za-z0-9-.]/g, '').slice(0, 60),
    extension: [{ url: EVENT_LOCATION, valueReference: { reference: `Location/oah-site-${visit.site}` } }],
    status: 'final',
    category: [{ coding: [{ system: OBS_CAT, code: 'survey', display: 'Survey' }] }],
    code: sw('restoration-change', 'Restoration change during a stream visit'),
    subject: { reference: patientRef },
    performer: [{ reference: patientRef }],
    effectiveDateTime: visit.datetime || visit.date,
    valueQuantity: { value: r, unit: 'score', system: 'http://unitsofmeasure.org', code: '1' },
    referenceRange: [{ low: { value: -4, unit: 'score', system: 'http://unitsofmeasure.org', code: '1' }, high: { value: 4, unit: 'score', system: 'http://unitsofmeasure.org', code: '1' }, text: 'Mean change across joy, calm, irritation (reversed) and worry (reversed); 0 = no change' }],
    derivedFrom: [{ reference: `QuestionnaireResponse/${qrId}` }],
  };
}

export function researchConsent(patientRef, dateTime) {
  return {
    resourceType: 'Consent',
    id: 'sw-consent-wellbeing',
    status: 'active',
    scope: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/consentscope', code: 'research', display: 'Research' }] },
    category: [{ coding: [{ system: LOINC, code: '59284-0', display: 'Patient Consent' }] }],
    patient: { reference: patientRef },
    dateTime,
    policyRule: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'OPTIN', display: 'opt-in' }] },
    provision: {
      type: 'permit',
      purpose: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-ActReason', code: 'HRESCH', display: 'healthcare research' }],
    },
  };
}

/** 2. Personal well-being record for one visit (stays with the person unless they share it). */
export function personalBundle(visit, pseudonym = 'me') {
  const patient = pseudonymousPatient(pseudonym);
  const ref = `Patient/${patient.id}`;
  const qr = visitQuestionnaireResponse(visit, ref);
  const q = visitQuestionnaire();
  return bundle('collection', [patient, q, cityLocation(SITE_BY_CODE[visit.site].city), siteLocation(visit.site), qr, restorationObservation(visit, ref, qr.id)]);
}

// ------------------------------------------------- aggregated health measures
export function cohortGroup(siteCode, period) {
  return {
    resourceType: 'Group',
    id: `sw-cohort-${siteCode}-${period.id}`,
    meta: { profile: [OAH.group] },
    type: 'person',
    actual: false,
    name: `Adult StreamWell visitors at OAH site ${siteCode}, ${period.label}`,
    characteristic: [
      { code: { coding: [{ system: LOINC, code: '30525-0', display: 'Age' }] }, valueRange: { low: { value: 18, unit: 'a', system: 'http://unitsofmeasure.org', code: 'a' } }, exclude: false },
      { code: sw('visited-location', 'Visited location during the period'), valueReference: { reference: `Location/oah-site-${siteCode}` }, exclude: false },
    ],
  };
}

/**
 * 3. Aggregated health measures bundle for one site and period.
 * measure = {site, visits, people, meanRestoration, shareRestored, activeShare, suppressed}
 */
export function healthMeasureBundle(measure, period, k = 5) {
  const s = SITE_BY_CODE[measure.site];
  const group = cohortGroup(measure.site, period);
  const base = (id, code, value, extra = {}) => ({
    resourceType: 'Observation',
    id: `sw-hm-${measure.site}-${period.id}-${id}`,
    meta: { profile: [OAH.healthMeasure] },
    status: 'final',
    code,
    subject: { reference: `Location/oah-site-${measure.site}` },
    focus: [{ reference: `Group/${group.id}` }],
    effectivePeriod: { start: period.start, end: period.end },
    performer: [{ display: 'StreamWell aggregation service (k-anonymity k=' + k + ')' }],
    ...value,
    ...extra,
  });
  const sample = [
    { code: sw('visits-count', 'Number of visits'), valueQuantity: { value: measure.visits, unit: 'visits', system: 'http://unitsofmeasure.org', code: '1' } },
    { code: sw('people-count', 'Number of distinct visitors'), valueQuantity: { value: measure.people, unit: 'people', system: 'http://unitsofmeasure.org', code: '1' } },
  ];
  const obs = [];
  if (measure.suppressed || measure.people < k) {
    obs.push(base('restoration', sw('mean-restoration', 'Mean restoration change among visitors'), {
      dataAbsentReason: { coding: [{ system: DAR, code: 'masked', display: 'Masked' }], text: `Fewer than ${k} visitors: suppressed to protect privacy` },
    }));
  } else {
    obs.push(base('restoration', sw('mean-restoration', 'Mean restoration change among visitors'), { valueQuantity: { value: measure.meanRestoration, unit: 'score', system: 'http://unitsofmeasure.org', code: '1' } }, { component: sample }));
    obs.push(base('restored-share', sw('share-restored', 'Share of visits after which visitors felt better'), { valueQuantity: { value: Math.round(measure.shareRestored * 100), unit: '%', system: 'http://unitsofmeasure.org', code: '%' } }, { component: sample }));
    if (measure.activeShare != null) {
      obs.push(base('active-travel', sw('active-travel-share', 'Share of visits reached on foot or by bike (physical activity)'), { valueQuantity: { value: Math.round(measure.activeShare * 100), unit: '%', system: 'http://unitsofmeasure.org', code: '%' } }, { component: sample }));
    }
  }
  return bundle('collection', [cityLocation(s.city), siteLocation(measure.site), group, ...obs]);
}

// ---------------------------------------------------------- blue prescription
/**
 * 4. Blue prescription: a clinician prescribes regular stream walks with
 * StreamWell check-ins; WHO-5 at start and follow-up; visit outcomes linked.
 * All people in the example are fictional.
 */
export function bluePrescriptionBundle({ pseudonym = 'demo-2026', start, end, sites, who5Baseline, who5FollowUp, visits = [] }) {
  const patient = pseudonymousPatient(pseudonym);
  const pRef = `Patient/${patient.id}`;
  const practitioner = {
    resourceType: 'Practitioner',
    id: 'sw-demo-gp',
    name: [{ text: 'Dr. Demo (fictional general practitioner)' }],
  };
  const goal = {
    resourceType: 'Goal',
    id: 'sw-goal-who5',
    lifecycleStatus: 'active',
    description: { text: 'Improve well-being: WHO-5 up by at least 10 points' },
    subject: { reference: pRef },
    target: [{ measure: sw('who5-score', 'WHO-5 percentage score'), detailQuantity: { value: who5Baseline.score + 10, comparator: '>=', unit: '%', system: 'http://unitsofmeasure.org', code: '%' }, dueDate: end }],
  };
  const qr = (id, date, responses) => ({
    resourceType: 'QuestionnaireResponse',
    id,
    questionnaire: SW.questionnaireWho5,
    status: 'completed',
    subject: { reference: pRef },
    authored: date,
    item: WHO5.items.map((i) => ({ linkId: i.id, answer: [{ valueCoding: { system: SW.cs, code: `who5-${responses[i.id]}` } }] })),
  });
  const who5Obs = (id, date, qrId, score) => ({
    resourceType: 'Observation',
    id,
    status: 'final',
    category: [{ coding: [{ system: OBS_CAT, code: 'survey', display: 'Survey' }] }],
    code: sw('who5-score', 'WHO-5 percentage score'),
    subject: { reference: pRef },
    performer: [{ reference: pRef }],
    effectiveDateTime: date,
    valueQuantity: { value: score, unit: '%', system: 'http://unitsofmeasure.org', code: '%' },
    derivedFrom: [{ reference: `QuestionnaireResponse/${qrId}` }],
  });
  const qrB = qr('sw-who5-baseline', start, who5Baseline.responses);
  const qrF = who5FollowUp ? qr('sw-who5-followup', who5FollowUp.date, who5FollowUp.responses) : null;
  const visitObs = visits.map((v) => restorationObservation(v, pRef, `${v.id}-qr`.replace(/[^A-Za-z0-9-.]/g, '').slice(0, 60)));
  const visitQrs = visits.map((v) => visitQuestionnaireResponse(v, pRef));
  const carePlan = {
    resourceType: 'CarePlan',
    id: 'sw-blue-prescription',
    status: 'active',
    intent: 'plan',
    category: [sw('blue-prescription', 'Blue prescription (nature-based social prescribing)')],
    title: 'Blue prescription: regular urban stream walks with StreamWell check-ins',
    description: 'Walk to a stream at least twice a week for 20 minutes or more, do the StreamWell check-in and stream check, and avoid streams with an "Avoid" advisory.',
    subject: { reference: pRef },
    period: { start, end },
    author: { reference: 'Practitioner/sw-demo-gp' },
    goal: [{ reference: 'Goal/sw-goal-who5' }],
    activity: [{
      outcomeReference: visitObs.map((o) => ({ reference: `Observation/${o.id}` })),
      detail: {
        kind: 'ServiceRequest',
        code: sw('stream-walk', 'Urban stream walk with StreamWell check-in'),
        status: 'in-progress',
        scheduledTiming: { repeat: { frequency: 2, period: 1, periodUnit: 'wk', duration: 20, durationUnit: 'min' } },
        location: { reference: `Location/oah-site-${sites[0]}` },
        description: `Suggested streams: ${sites.map((c) => `${SITE_BY_CODE[c].name} (${c})`).join(', ')}`,
      },
    }],
  };
  const allSites = [...new Set([...sites, ...visits.map((v) => v.site)])];
  const cities = [...new Set(allSites.map((c) => SITE_BY_CODE[c].city))];
  const res = [patient, practitioner, carePlan, goal, ...cities.map(cityLocation), ...allSites.map(siteLocation), qrB, who5Obs('sw-who5-baseline-score', start, qrB.id, who5Baseline.score)];
  if (qrF) res.push(qrF, who5Obs('sw-who5-followup-score', who5FollowUp.date, qrF.id, who5FollowUp.score));
  res.push(...visitQrs, ...visitObs, researchConsent(pRef, start));
  return bundle('collection', res);
}

/** Convert a collection bundle to a transaction (PUT by id) for a FHIR server. */
export function toTransaction(b) {
  return {
    ...b,
    type: 'transaction',
    entry: b.entry.map((e) => ({ fullUrl: e.fullUrl, resource: e.resource, request: { method: 'PUT', url: `${e.resource.resourceType}/${e.resource.id}` } })),
  };
}

export { who5Score };
