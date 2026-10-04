# Devpost submission: StreamWell

Copy each block into the matching Devpost field. Written in the first person singular; switch to "we" if you submit as a team.

## Project name
StreamWell

## Elevator pitch (tagline, max 200 characters)
Check the stream. Check yourself. One urban-stream visit, two health checks: the OAH citizen protocol plus a 30-second before/after well-being check-in, in FHIR.

## Track
Primary: **Community & Gamification** (sustained participation through a personal benefit).
Also addresses: Citizen Science UX, Data-to-Insight, AI-Supported Assessment, Awareness & Storytelling, Resilience Informatics, Digital Health Standards.

## Links
- Live app: https://jiayi61.github.io/streamwell/
- Code: https://github.com/jiayi61/streamwell
- Video: (YouTube / Vimeo link)

---

## Inspiration

OneAquaHealth asks a simple question with a hard answer: do healthy urban streams make healthier people? Citizen science can watch hundreds of streams, but two things get in the way. Volunteers drift away: across seven large citizen-science projects, only 27% came back for a second session, yet returners made 85% of the contributions (Sauermann & Franzoni, PNAS 2015). And a stream record describes the stream, not how it made anyone feel, so the human half of One Health is missing.

I have spent five years supporting people with hemophilia, including building a follow-up tool where patients report how they are doing. The lesson from that work carried straight over: people keep reporting when reporting gives something back to them. So the question became: what if every stream check also told volunteers something true about themselves?

## What it does

StreamWell turns every visit to an urban stream into **two health checks**:

1. **Check in (30 s).** Before looking closely, rate four feelings: joy, calm, irritation, worry. They are the same four items the OAH Citizen Science App already records.
2. **Check the stream (~4 min).** The OAH citizen protocol, field by field and with the app's own answer codes, in plain words, with pictograms, the scientific term underneath and an honest "not sure".
3. **Second look.** Explainable checks compare the answers with each other, with the last 72 hours of weather (Open-Meteo) and with an on-device colour reading of an optional photo. Each flag says what it noticed, why, which answers it used and where the data came from. The volunteer decides; nothing is changed automatically.
4. **Check out (30 s).** The same feelings again, plus what shaped them (sound of water, litter, felt unsafe...).

The result shows the stream's condition and the volunteer's **restoration** side by side, with One Health notes for the ecosystem, animals and people, and what would help this stretch.

**For volunteers**, a journal shows which streams restore *them* most (with honest intervals), weekly streaks, adopted streams and missions to streams nobody has checked for 30 days.

**For cities and researchers**, a dashboard maps all 106 OAH research sites with the citizens' condition view and the real OAH lab health-risk scores, measures the link between stream condition and restoration, estimates which fixes (litter, lighting, trees, outfalls) are linked to the biggest well-being gains, flags where lab and citizens disagree, and issues **safe-blue-walk advisories** from live forecasts, lab faecal scores and recent reports, with storm and heatwave scenarios.

**For health systems**, every record is HL7 FHIR R4 on the OneAquaHealth Implementation Guide, at two privacy levels: stream observations (no personal data) and a personal well-being record that only the volunteer controls. Donated well-being data becomes k-anonymous `ObservationHealthMeasureOah` site averages. A GP can issue a **blue prescription** (regular stream walks) as a FHIR CarePlan and follow WHO-5 outcomes, if the patient shares them.

## Who it is for

Volunteers and residents near urban streams; OAH researchers and city environment and public-health teams in Coimbra, Toulouse, Ghent, Benevento and Oslo; GPs and social-prescribing link workers.

## Ecosystem and health impact

- **More, better ecosystem data:** a personal reason to return means repeat visits at the same sites, and the second look catches contradictions before they enter the dataset. Data-gap missions send volunteers where data is missing.
- **The missing human half:** paired before/after measures per visit make OneAquaHealth's central hypothesis testable at the level of a single visit, with each person compared with themselves.
- **Action, not just maps:** the dashboard names the fixes linked to the largest well-being gains and the sites where lab and citizen views disagree.
- **Safer contact with water:** advisories steer people away from streams after storm overflows or during heat, and towards safer nearby streams.
- **Health-system reach:** blue prescriptions connect healthy streams to primary care through standard FHIR.

## How I built it

- **Real OAH data:** the 106 research sites, the Citizen Science App's submission schema and answer codes, and lab health-risk scores for 96 sites, all from the OneAquaHealth public API; FHIR profiles from the hl7-eu/oah IG; live weather from Open-Meteo.
- **App:** plain ES modules with no framework and no build step, an offline-first PWA, a vendored Leaflet map, hand-drawn SVG charts. Everything runs in the browser; personal data stays in local storage.
- **Analytics in the browser:** Spearman with bootstrap CIs; a visit-level model with a cluster bootstrap over volunteers (sufficient statistics per volunteer, ~150 ms); Welch intervals for personal insights; k-anonymity for health measures.
- **FHIR:** LocationOah, ObservationIndicatorsOah (coded with the IG's TemporaryOahSystem), ObservationHealthMeasureOah with GroupOah cohorts, Questionnaire/QuestionnaireResponse, CarePlan, Goal and Consent; an in-browser validator for the profiles' rules; one-click base-R4 validation on the public HAPI server.
- **Science and honesty:** no paired eco-health dataset exists yet, so the pilot visits come from a seeded, documented simulation (`scripts/simulate.py`) on the real sites and lab scores, labelled as synthetic everywhere. `scripts/analysis.py` adds a fixed-effects model and a power analysis.
- **Quality:** 26 unit tests and a headless browser walk-through of every view.

## Challenges

- **Adding the human half without a burden.** The answer was to reuse the four feelings the OAH app already asks and ask them twice, which adds about a minute and creates a change score.
- **Making AI assistance trustworthy.** I chose transparent rules and an on-device colour check over a black box: every flag shows its inputs and source, and the volunteer always decides.
- **Standards that fit.** The OAH IG has no code yet for restorative experience at a stream or for site-visitor cohorts, so I used the IG wherever possible, kept my own codes in a published CodeSystem, and wrote the gaps up as an FSH proposal for the IG.
- **Privacy.** Well-being is health data under GDPR, so it stays on the phone by default and research only sees site averages over at least five visitors.

## Accomplishments

- Uses the OAH project's own questions, codes, sites, lab data and FHIR IG end to end.
- Every example FHIR bundle passes structural validation against the OAH profiles.
- A pilot design with numbers: about 240 paired visits (40 volunteers × 6) detect a 0.25-point effect with 84% power, one summer in one city.

## What I learned

Engagement and data quality are the same problem: a volunteer who gets something back answers more carefully and comes back. Explainability is a UX feature: people accept a second look when it shows its reasons.

## What's next

A summer pilot with an OAH city partner; a data-protection impact assessment; translations (PT, FR, IT, NL, NO); proposing the IG additions to HL7 Europe; replacing simulated effect sizes with real estimates; integration as a module of the OAH Citizen Science App.

## Built with
javascript, html5, css3, leaflet, openstreetmap, open-meteo, hl7-fhir, fhir-r4, python, numpy, playwright, github-pages, pwa

---

## Submission checklist

- [ ] Repository is **public** (Settings → General → Danger Zone → Change visibility)
- [ ] GitHub Pages is on (Settings → Pages → Deploy from branch `main`, folder `/ (root)`) and the live link works
- [ ] Video (3–5 min) uploaded as public or unlisted on YouTube/Vimeo; link added to Devpost and to the README
- [ ] Track selected on Devpost
- [ ] Team members added on Devpost (the participation page says a team is required)
- [ ] Submitted before **4 October 2026, 9:00 pm PDT** (midnight in New York)
