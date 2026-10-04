# FHIR validation

StreamWell's FHIR output is checked in three ways.

## 1. Structural validation against the OneAquaHealth profiles (in the app and in CI)

`src/validate.js` implements the rules of the OAH IG profiles each resource claims in `meta.profile`, taken from the FSH source of [hl7-eu/oah](https://github.com/hl7-eu/oah) (`input/fsh/profiles/*.fsh`):

| Profile | Rules checked |
|---|---|
| `LocationOah` | identifier 1..*, name 1..1, mode = #instance, position latitude and longitude 1..1 |
| `ObservationIndicatorsOah` | status = #final, code 1..1, subject 1..1 Reference(LocationOah), effective[x] 1..1, performer 1..*, value[x] only CodeableConcept or Quantity, component.value[x] 1..1 and only CodeableConcept, string or Quantity |
| `ObservationHealthMeasureOah` | status = #final, code 1..1, subject 1..1 Reference(LocationOah), effective[x] 1..1, value[x] CodeableConcept or Quantity (or a dataAbsentReason for masked cells), focus only Reference(GroupOah) |
| `GroupOah` | type = #person, actual = false, member 0..0, characteristic 1..* each with code, value[x] and exclude |

Plus FHIR R4 basics (id format, required elements and value sets for Observation, QuestionnaireResponse, CarePlan, Consent; obs-6: no dataAbsentReason when a value is present) and that **every reference resolves inside the bundle**. The tests (`tests/fhir.test.mjs`) also break bundles on purpose to prove the validator catches errors.

| Example bundle | Resources | Checks | Result |
|---|---|---|---|
| `fhir/Bundle-example-stream-observation.json` | 10 | 164 | pass |
| `fhir/Bundle-example-personal-wellbeing.json` | 6 | 34 | pass |
| `fhir/Bundle-example-health-measures.json` | 6 | 69 | pass |
| `fhir/Bundle-example-blue-prescription.json` | 22 | 138 | pass |

## 2. Base FHIR R4 validation on the public HAPI server

The FHIR page of the app has a button that posts the bundle to `https://hapi.fhir.org/baseR4/Bundle/$validate`. On 2026-10-04 all four example bundles returned **0 errors**. HAPI does not have the OneAquaHealth IG or StreamWell's code systems loaded, so it also reports:

- notes that the OAH profiles "could not be found" (they are covered by check 1);
- warnings that `TemporaryOahSystem` and StreamWell's code systems are unknown to its terminology server;
- extensible-binding warnings on `Location.type`, where StreamWell follows the IG's own examples (SNOMED CT 288520005 "City environment").

Best-practice warnings that came up in the first run were fixed: every resource now carries a generated narrative (dom-6), dimensionless quantities use the UCUM unity code `1` instead of curly-brace annotations, and self-reported observations name the person as performer.

Reproduce from any page without a restrictive CSP:

```js
const b = await (await fetch('https://raw.githubusercontent.com/jiayi61/streamwell/main/fhir/Bundle-example-stream-observation.json')).json();
const r = await fetch('https://hapi.fhir.org/baseR4/Bundle/$validate', { method: 'POST', headers: { 'Content-Type': 'application/fhir+json' }, body: JSON.stringify(b) });
console.log((await r.json()).issue.filter((i) => i.severity === 'error' && !/could not be found/.test(i.diagnostics)));
```

## 3. The official HL7 validator

[validator.fhir.org](https://validator.fhir.org) could not load the OneAquaHealth IG on 2026-10-04: the CI build `hl7.eu.fhir.oah#current` has no entry on the build server's package list, and loading it by URL failed. Once the IG is published as a package, validate with:

```
java -jar validator_cli.jar fhir/Bundle-example-*.json -version 4.0.1 -ig hl7.eu.fhir.oah -ig fhir/
```
