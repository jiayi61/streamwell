# Demo video narration

The video, [`docs/streamwell-demo.mp4`](streamwell-demo.mp4), is recorded by `node scripts/record-demo.mjs`: Playwright drives the live app while each numbered line below is spoken, and every scene waits for its line to finish, so picture and voice always match. Captions are written to [`docs/streamwell-demo.srt`](streamwell-demo.srt).

**To use a human voice:** record each line as its own file named by its number (`01.m4a`, `02.m4a` … `25.m4a`; m4a, mp3 or wav), put them in one folder and run `VOICE_DIR=path/to/folder node scripts/record-demo.mjs`.

Each line says what is on screen *and* why it matters. The right-hand column is the judging criterion the line is aimed at.

| # | Screen | Line | Aimed at |
|---|---|---|---|
| 1 | Title card | StreamWell. Check the stream. Check yourself. | |
| 2 | Home | OneAquaHealth asks: do healthy urban streams make healthier people? Today, nobody can answer that, for two reasons. | Mission alignment |
| 3 | Home | Volunteers drift away: in large citizen-science projects, only about a quarter ever come back. | Impact |
| 4 | Home | And the human half is missing: a stream record says nothing about how the stream made anyone feel. | Impact |
| 5 | Home, the four steps | StreamWell solves both with one loop. Every visit becomes two health checks, the stream's and yours. The personal answer brings volunteers back, and every return visit adds the paired data OneAquaHealth needs. | Innovation |
| 6 | Visit: choose a stream | Meet Ana. She walks to a stream in Coimbra. Everything here is built on OneAquaHealth's real data: all 106 research sites, the app's own answer codes, and the project's lab results. | Tool / API use |
| 7 | Visit: advisory | She sees today's safe-walk advisory, from live weather and the lab's health-risk score. | Tool / API use |
| 8 | Check-in | Thirty seconds to check in, with the four feelings the OneAquaHealth app already asks. We ask them again after the visit, so each person is compared with themselves, which removes most of the bias in mood data. | Innovation, scientific quality |
| 9 | Stream check | Then the official stream check, redesigned for non-experts: plain words, pictures, and an honest "not sure" that never counts against the stream. | UX & accessibility |
| 10 | Second look | Then a second look. No black box: every check shows what it noticed, why it matters, and which data it used: her other answers, recent weather, and her photo, analysed on the phone. | Responsible AI |
| 11 | Second look: keep answer | The AI suggests. Ana decides, and her decision stays with the record. | Responsible AI |
| 12 | Result | Two health checks, side by side. The stream is Good, every point explained, and Ana left more restored than she arrived. No other stream tool records that. | Innovation |
| 13 | Result: sharing | Privacy is built in. Her feelings stay on her phone unless she opts in, and researchers only see averages over at least five people. | Architecture, trust |
| 14 | Journal | This is the reason to come back. Not points or badges, but an answer that matters to her: which streams restore me most? | Community track |
| 15 | Journal: intervals | With thin data, it says "not clear yet", instead of overclaiming. | Scientific honesty |
| 16 | Journal: missions | Missions send volunteers to streams nobody has checked for a month, so engagement fills the gaps in monitoring. | Impact |
| 17 | Journal: blue prescription | And it reaches health care: a doctor can prescribe stream walks, and follow the outcome with the WHO-5 well-being index. | One Health, scalability |
| 18 | City dashboard | For cities, one map brings together citizen reports, real lab results and live weather. These visits are simulated, because this paired dataset does not exist yet. Creating it is exactly what StreamWell is for. | Data-to-insight, honesty |
| 19 | City: correlation | Healthier streams, more restored people: OneAquaHealth's central hypothesis, made measurable. | Mission alignment |
| 20 | City: drivers | And it shows where to act. Feeling unsafe, bad smells and litter cost the most, and each one becomes a concrete fix for the city. | Actionable insight |
| 21 | City: storm scenario | If a storm hits tonight, risky streams turn red, with safer ones nearby. | Resilience |
| 22 | Health data (FHIR) | It all speaks the language of health systems: HL7 FHIR, on the OneAquaHealth Implementation Guide, at two privacy levels. | Architecture, standards |
| 23 | FHIR validation | Zero validation errors, ready for the project's own infrastructure. | Architecture |
| 24 | Home: evidence | And we tested our own claims. In two hundred simulated pilots, the model recovered every planted effect, with only four percent false alarms. Zero accessibility issues on every screen. And a pre-registered pilot is ready for one summer in one OneAquaHealth city. | Rigour, feasibility |
| 25 | Closing card | StreamWell works offline on any phone, needs no server, and costs almost nothing to run. Check the stream. Check yourself. Thank you. | Scalability |

About 540 words: at a calm 150 words per minute the finished video stays under five minutes.

**Tips for recording.** A quiet room, the phone about 20 cm away, one take per line (re-record a single line if you stumble). Stress the contrast words: *nobody*, *both*, *no black box*, *Ana decides*, *no other stream tool*, *not points or badges*, *tested our own claims*.
