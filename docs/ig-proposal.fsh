// Proposed additions to the OneAquaHealth FHIR IG (hl7-eu/oah), from
// StreamWell, IEEE OneAquaHealth Global Hackathon 2026.
// Context: StreamWell builds on LocationOah, ObservationIndicatorsOah,
// ObservationHealthMeasureOah and GroupOah. Four small gaps came up.

// ---------------------------------------------------------------------------
// 1. Well-being measured at the stream
//    HealthIndicatorsOahVs covers prevalence, mortality and hospitalisation,
//    but not the restorative experience and physical activity named in the
//    OAH health protocol (Anastasaki et al., Applied Medical Informatics).
//    Add to TemporaryOahSystem and include in HealthIndicatorsOahVs:

* #restorative-experience "Restoration at an urban stream" "Mean change in self-rated joy, serenity, anger (reversed) and fear (reversed) from before to after a stream visit, scale -4..4. The four items are those of the OAH Citizen Science App."
* #restored-share "% of stream visits after which the visitor felt better" "Share of visits with a positive restoration change, per site and period."
* #active-travel-share "% of stream visits reached on foot or by bike" "Physical-activity indicator for blue-space visits, per site and period."

// ---------------------------------------------------------------------------
// 2. The Citizen Science App answer codes as a published CodeSystem
//    The codes live only in the app API (/api/citizens/*). Publishing them
//    lets citizen observations be validated. Full draft:
//    fhir/CodeSystem-oah-citizen-answer.json (28 codes).

CodeSystem: OahCitizenAnswerCs
Id: oah-citizen-answer
Title: "OAH Citizen Science App answer codes"
* ^caseSensitive = true
* #FAS "Fast (with waves or high velocity)"
* #NOR "Slow"
* #STA "Stagnant/intermittent"
* #DRY "Dry"
* #CL "Clear/transparent"
* #MU "Muddy/turbid"
* #FO "Has foam"
* #CO "Has colors/altered color"
* #FLAT "Flat"
* #U "U Shape"
* #V "V Shape"
* #NAT "Natural"
* #ART "Artificial (concrete or stones with concrete)"
* #LAS "Layed stones with no concrete"
* #SB "Sand banks"
* #SI "Sand islands"
* #SD "Stone deposits"
* #RF "Riffles, rapids, falls"
* #AV "Aquatic vegetation"
* #FT "Fallen trees"
* #FB "Fallen branches"
* #FL "Deposits of fallen leaves"
* #H "Herbs"
* #B "Shrubs"
* #T "Trees"
* #GOOD "Good quality"
* #MODERATE "Moderate quality"
* #POOR "Poor quality"

// ---------------------------------------------------------------------------
// 3. Cohorts of site visitors
//    GroupOah describes cohorts by age, sex and living place. Aggregated
//    well-being of a site's visitors needs "visited location".
//    Add to OahCohortCharacteristicCodeVs (extensible):

* #visited-location "Visited location during the period"

// ---------------------------------------------------------------------------
// 4. Citizen observations end to end
//    a) allow a "citizen-science" category on ObservationIndicatorsOah, so
//       volunteer records can be told apart from lab and sensor data;
//    b) publish a Questionnaire for the citizen stream form, so an app
//       submission maps 1:1 to a QuestionnaireResponse and back.
