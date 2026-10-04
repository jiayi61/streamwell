# Methods

Everything StreamWell computes, in the order a visit produces it. All rules are in plain JavaScript in `src/` and covered by `tests/`.

## 1. The stream check (OAH protocol)

The questions mirror the OneAquaHealth Citizen Science App submission (`CitizenSubmissionPutDTO` in the OAH API's OpenAPI document) field by field: flow, water aspect, water height, channel form, bed and bank type, in-stream habitats, fallen biomass, left/right impervious areas, vegetation cover and dominant vegetation, invasive plants, recent cuts, water abstraction, barriers, outfall pipes, polluted discharge, construction, and the overall assessment (Good / Moderate / Poor). Answer codes are the app's own (`FAS`, `NOR`, `STA`, `DRY`, `CL`, `MU`, `FO`, `CO`, `NAT`, `ART`, `LAS`, `SB`, `SI`, `SD`, `RF`, `AV`, `FT`, `FB`, `FL`, `H`, `B`, `T`, `GOOD`, `MODERATE`, `POOR`), taken from the lookup endpoints `/api/citizens/*` on 2026-10-03.

StreamWell adds: plain-language prompts, pictograms, the scientific term under each prompt, a "not sure" answer for every question except the overall rating, and safety reminders (never enter the water). `toOahSubmission()` converts a StreamWell visit back into the app's submission shape; "not sure" becomes `null` so nothing is invented.

## 2. Condition view

A transparent reading of the answers on the OAH three-class scale. Four components of 25 points:

| Component | Points |
|---|---|
| Channel & banks | bed natural 12 / built 0; banks natural 13 / loose stones 7 / built 0 |
| Places for life | habitat types 0→0, 1→6, 2→11, 3→15, 4→18, 5→20 (capped at 6 if the channel is dry); natural wood or leaves 5 |
| Banks & margins | per bank: covered by plants 6, trees 4.5 / shrubs 3 / herbs 1.5, not paved 2; no invasive plants 2; no recent cutting 1 |
| Water & pressures | clear 10 / muddy 4 / foamy 2 / odd colour 0; flow fast or slow 5 / still 2 / dry 0; absence of abstraction 2, barriers 2, pipes 1.5, discharge 3, works 1.5 |

Unknown answers are removed from both earned and possible points, so "not sure" never counts as good or bad. Bands: Good ≥ 67, Moderate 40–66, Poor < 40. Confidence is the share of scored items that were answered (High ≥ 85%, Medium ≥ 60%). The volunteer's own rating is the recorded one; the view only reports how far it is from that rating. It is decision support, not a validated ecological index.

## 3. Second look

Explainable rules run before saving (`src/checks.js`). Each returns a title, a reason, the answers it used, the data source and, where useful, the question to revisit.

- **Rating vs description:** Good with discharge, foam or odd colour; Good with bed and both banks built; Poor although everything described is natural, clear and pressure-free.
- **Physical consistency:** riffles in still or dry water; a dry channel whose water was described; a mostly bare bank whose tallest plants are trees or shrubs; a discharge without any pipe.
- **Weather (Open-Meteo, model grid):** clear water after ≥ 15 mm of rain in 48 h; muddy water with < 1 mm in 72 h and no works nearby (possible upstream discharge); hot days (≥ 28 °C) with still or coloured water (safety).
- **Safety:** discharge together with foam or odd colour (possible sewage).
- **Evidence:** more than 300 m from the chosen site; a photo whose colour reading disagrees with the answer (confidence ≥ 0.6); six or more "not sure" answers (suggest photos).

"Please check" flags need a decision: keep the answer (with an optional note) or change it. Safety and information flags never block. Decisions travel with the record and into FHIR as `Observation.note`.

## 4. Photo check

On the device, the photo is drawn into a 180 px canvas and the lower-middle region (where water usually is) is classified pixel by pixel in HSV: bright and unsaturated (foam), brown-yellow (muddy), saturated green (algae or plants), blue-grey or neutral (clear water and reflections). A colour that dominates becomes a suggestion with its own explanation ("48% of the water area is brown-yellow..."). It only ever prompts a second look. The image is never uploaded; a SHA-256 fingerprint and the hint are kept.

## 5. Well-being: restoration score

Before and after the stream check, four feelings on a 1–5 scale: joy, calm (serenity), irritation (anger), worry (fear). These are the four items the OAH Citizen Science App records; StreamWell asks them twice.

Mood balance = joy + calm − irritation − worry (range −8..8). **Restoration** = (balance after − balance before) / 4, range −4..4; 0 means no change. Labels: ≥ 1 strongly restored, ≥ 0.4 restored, > −0.25 about the same, otherwise felt worse.

Experience tags (sound of water, birds or wildlife, shade and trees, quiet, clean; litter, bad smell, traffic noise, felt unsafe, concrete), minutes at the stream and travel mode (walk, cycle, transit, car) complete the visit. Walking or cycling counts as active minutes, the physical-activity outcome in the OAH health protocol.

For blue-prescription participants, the WHO-5 Well-Being Index (5 items, 0–5, raw × 4 = 0–100; a 10-point change is the usual threshold for a meaningful change) is taken at the start and at follow-up.

## 6. Personal insights

For each feature (natural banks, trees, both banks vegetated, clear water, paving, discharge, sound of water, wildlife, litter, smell, noise, felt unsafe), the volunteer's mean restoration with vs without it, with a Welch 95% interval, shown only when each side has at least three visits. If the interval crosses zero the card says "not clear yet". Streak = consecutive Monday-to-Sunday weeks with a visit, counting back from this or last week. A stream with three or more visits is "adopted".

## 7. City and research analytics

- **Site aggregates:** visits, distinct visitors, mean condition score, mean restoration, last visit, share of visits reporting a discharge, tag shares, and the OAH lab health-risk record.
- **One Health link:** Spearman correlation between site mean condition and site mean restoration over sites with enough visits; percentile bootstrap CI resampling sites (800 draws).
- **Drivers model:** visit-level OLS of restoration on the twelve features, mood on arrival (balance / 4), log(visit minutes / 20) and city indicators; 95% CIs from a cluster bootstrap that resamples whole volunteers (200 draws, sufficient statistics per volunteer so it runs in the browser in ~150 ms). Associational, not causal. `scripts/analysis.py` adds a within-person version with volunteer fixed effects and cluster-robust standard errors.
- **Lab vs citizens:** Spearman between citizen condition and minus the OAH lab health-risk score; "looks fine, lab says risky" = lab score ≥ 0.40 and citizen score ≥ 58; "looks bad, no lab signal" = citizen score < 45 and lab score < 0.25 or no sample.
- **Data gaps:** sites without a visit for 30 days or more become volunteer missions.
- **Health measures:** monthly per-site mean restoration, share of visits that left people better and share reached on foot or by bike, suppressed when fewer than k = 5 distinct visitors contributed.

## 8. Safe-blue-walk advisories

Per site, three levels: Go, Care (walk, keep out of the water), Avoid (avoid water contact, pick another stream).

- Rain ≥ 20 mm over 48 h (past two days plus today, or today plus the next two): Avoid where the OAH lab faecal score is ≥ 0.5 or volunteers recently reported a discharge, otherwise Care.
- Rain 10–20 mm: Care where there is a faecal or discharge signal.
- Forecast maximum ≥ 30 °C with recent still-water reports: Care (algal bloom, mosquitoes); ≥ 35 °C: Care (heat advice for walkers).
- OAH lab faecal score ≥ 0.75: Care.
- A recent discharge report (the latest visit within 21 days, or two of the last five visits): Care.

Each advisory lists its reasons and sources. For Care and Avoid, the nearest Go sites in the same city are suggested. Storm (+28 mm tonight) and heatwave (36 °C) scenarios re-run the same rules for planning and demonstration.

## 9. Synthetic pilot data

`scripts/simulate.py` (seed 20261004) generates 1,664 visits by 261 volunteers between 6 April and 2 October 2026 at the real OAH sites. Each site gets a latent quality tied to its real OAH lab health-risk score, plus urban-ness, channel and bank types, vegetation, pipes and discharge propensity. Each city gets daily weather with seasonal temperature and random rain events. Volunteers have their own skill (misreading 8–16% of answers, "not sure" 4–9%), baseline feelings, sensitivity to setting and travel habits. Restoration depends on the stream condition the volunteer recorded, experience tags, visit length and arrival mood, with a person-specific slope and noise; it is spread over the four feelings, rounded and clipped to 1–5. Effect sizes are illustrative and chosen to be plausible in the light of blue-space research (e.g. Vert et al. 2020, Environmental Research 188:109812; Wyles et al. 2016, Environment and Behavior 48(9):1095–1126). The whole simulation is meant to be replaced by real data.

## 10. Power for a pilot

`scripts/analysis.py` simulates pilots with six visits per volunteer, a person random effect (SD 0.3), residual SD 0.45 and a feature present on 20% of visits. A within-person model detects a 0.25-point effect (|t| > 1.96) in 54% of pilots with 120 visits, 84% with 240 and 96% with 360.
