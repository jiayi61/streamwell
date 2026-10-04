// Structural checks of StreamWell bundles against the rules of the hl7-eu/oah
// profiles they claim (cardinalities, fixed values, allowed types, reference
// targets) and FHIR R4 basics. This is a fast in-browser pre-check; the
// official HL7 validator remains the reference (see docs/fhir-validation.md).

import { OAH } from './fhir.js';

const isRef = (r, type) => r && typeof r.reference === 'string' && (!type || r.reference.startsWith(`${type}/`));
const hasValue = (o) => ['valueQuantity', 'valueCodeableConcept', 'valueString', 'valueBoolean', 'valueInteger', 'valueRange', 'valueReference'].some((k) => o[k] !== undefined);
const valueType = (o) => ['valueQuantity', 'valueCodeableConcept', 'valueString', 'valueBoolean', 'valueInteger', 'valueRange', 'valueReference'].find((k) => o[k] !== undefined);

const RULES = {
  [OAH.location]: (r, ok) => {
    ok(Array.isArray(r.identifier) && r.identifier.length >= 1, 'identifier 1..*');
    ok(!!r.name, 'name 1..1');
    ok(r.mode === 'instance', 'mode = #instance');
    if (r.position) ok(typeof r.position.latitude === 'number' && typeof r.position.longitude === 'number', 'position.latitude and longitude 1..1');
  },
  [OAH.indicator]: (r, ok) => {
    ok(r.status === 'final', 'status = #final');
    ok(!!(r.code && r.code.coding && r.code.coding.length), 'code 1..1');
    ok(isRef(r.subject, 'Location'), 'subject 1..1 Reference(LocationOah)');
    ok(!!(r.effectiveDateTime || r.effectivePeriod), 'effective[x] 1..1');
    ok(Array.isArray(r.performer) && r.performer.length >= 1, 'performer 1..*');
    const vt = valueType(r);
    ok(!vt || vt === 'valueQuantity' || vt === 'valueCodeableConcept', 'value[x] only CodeableConcept or Quantity');
    (r.component || []).forEach((c, i) => {
      ok(hasValue(c), `component[${i}].value[x] 1..1`);
      const t = valueType(c);
      ok(!t || ['valueQuantity', 'valueCodeableConcept', 'valueString'].includes(t), `component[${i}].value[x] only CodeableConcept, string or Quantity`);
    });
  },
  [OAH.healthMeasure]: (r, ok) => {
    ok(r.status === 'final', 'status = #final');
    ok(!!(r.code && r.code.coding && r.code.coding.length), 'code 1..1');
    ok(isRef(r.subject, 'Location'), 'subject 1..1 Reference(LocationOah)');
    ok(!!(r.effectiveDateTime || r.effectivePeriod), 'effective[x] 1..1');
    const vt = valueType(r);
    ok(vt === 'valueQuantity' || vt === 'valueCodeableConcept' || !!r.dataAbsentReason, 'value[x] (CodeableConcept or Quantity) or dataAbsentReason');
    ok(!r.focus || r.focus.every((f) => isRef(f, 'Group')), 'focus only Reference(GroupOah)');
  },
  [OAH.group]: (r, ok) => {
    ok(r.type === 'person', 'type = #person');
    ok(r.actual === false, 'actual = false');
    ok(!r.member || r.member.length === 0, 'member 0..0');
    ok(Array.isArray(r.characteristic) && r.characteristic.length >= 1, 'characteristic 1..*');
    (r.characteristic || []).forEach((c, i) => {
      ok(!!c.code, `characteristic[${i}].code 1..1`);
      ok(['valueCodeableConcept', 'valueQuantity', 'valueRange', 'valueBoolean', 'valueReference'].some((k) => c[k] !== undefined), `characteristic[${i}].value[x] 1..1`);
      ok(typeof c.exclude === 'boolean', `characteristic[${i}].exclude 1..1`);
    });
  },
};

function baseChecks(r, ok) {
  ok(typeof r.resourceType === 'string', 'resourceType present');
  ok(typeof r.id === 'string' && /^[A-Za-z0-9\-.]{1,64}$/.test(r.id), 'id matches [A-Za-z0-9-.]{1,64}');
  if (r.resourceType === 'Observation') {
    ok(['registered', 'preliminary', 'final', 'amended', 'corrected', 'cancelled', 'entered-in-error', 'unknown'].includes(r.status), 'Observation.status valid');
    ok(!!r.code, 'Observation.code 1..1');
    ok(!(hasValue(r) && r.dataAbsentReason), 'obs-6: dataAbsentReason only when value[x] is absent');
  }
  if (r.resourceType === 'QuestionnaireResponse') ok(['in-progress', 'completed', 'amended', 'entered-in-error', 'stopped'].includes(r.status), 'QuestionnaireResponse.status valid');
  if (r.resourceType === 'CarePlan') {
    ok(!!r.subject, 'CarePlan.subject 1..1');
    ok(['draft', 'active', 'on-hold', 'revoked', 'completed', 'entered-in-error', 'unknown'].includes(r.status), 'CarePlan.status valid');
    ok(['proposal', 'plan', 'order', 'option'].includes(r.intent), 'CarePlan.intent valid');
  }
  if (r.resourceType === 'Consent') {
    ok(!!r.scope && Array.isArray(r.category) && r.category.length > 0, 'Consent.scope and category 1..');
  }
}

/** Collect every relative reference ("Type/id") inside a resource. */
function references(obj, out = []) {
  if (Array.isArray(obj)) obj.forEach((x) => references(x, out));
  else if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) {
      if (k === 'reference' && typeof v === 'string' && /^[A-Z][A-Za-z]+\/[A-Za-z0-9\-.]+$/.test(v)) out.push(v);
      else references(v, out);
    }
  }
  return out;
}

/**
 * Validate a Bundle. Returns {ok, errors, results:[{resource, rule, ok}]}.
 */
export function validateBundle(b) {
  const results = [];
  const push = (resource, rule, pass) => results.push({ resource, rule, ok: !!pass });
  push('Bundle', 'resourceType = Bundle', b && b.resourceType === 'Bundle');
  push('Bundle', 'type is collection, transaction or batch', b && ['collection', 'transaction', 'batch', 'document', 'message', 'searchset'].includes(b.type));
  const entries = (b && b.entry) || [];
  const ids = new Set(entries.map((e) => `${e.resource.resourceType}/${e.resource.id}`));
  push('Bundle', 'every entry has fullUrl and resource', entries.every((e) => e.fullUrl && e.resource));
  push('Bundle', 'resource ids unique per type', ids.size === entries.length);
  if (b && b.type === 'transaction') push('Bundle', 'transaction entries have request.method and url', entries.every((e) => e.request && e.request.method && e.request.url));
  for (const e of entries) {
    const r = e.resource;
    const label = `${r.resourceType}/${r.id}`;
    const ok = (pass, rule) => push(label, rule, pass);
    baseChecks(r, (pass, rule) => ok(pass, rule));
    for (const p of (r.meta && r.meta.profile) || []) {
      if (RULES[p]) RULES[p](r, (pass, rule) => ok(pass, `${short(p)}: ${rule}`));
    }
    for (const ref of references(r)) ok(ids.has(ref), `reference ${ref} resolves inside the bundle`);
  }
  const errors = results.filter((x) => !x.ok);
  return { ok: errors.length === 0, errors, results, checked: results.length };
}

function short(url) { return url.split('/').pop(); }
