# Pilot pre-registration (draft for an OAH city partner)

This plan is written **before any real StreamWell data exist**, so the analysis cannot be bent to fit the results. It is meant to be filed (e.g. on OSF) with a OneAquaHealth city partner before the first volunteer visit.

## 1. Questions

- **Q1 (primary).** Within the same person, are visits to streams in better citizen-assessed condition followed by greater restoration (change in the four OAH feelings from check-in to check-out)?
- **Q2.** Which experience features (sound of water, wildlife, litter, bad smell, traffic noise, feeling unsafe) are associated with restoration, within person?
- **Q3 (engagement).** Do volunteers who see their personal "what restores you" insights return more often than the 27% second-session rate reported for large citizen-science projects (Sauermann & Franzoni 2015)?

## 2. Design

- **Setting:** one OAH city (Coimbra, Toulouse, Ghent, Benevento or Oslo), one summer (June–September), at the city's OAH research sites.
- **Participants:** adult volunteers recruited through the OAH city partner; informed consent in the app; no clinical population.
- **Procedure:** the StreamWell visit as shipped: check-in (joy, calm, irritation, worry, 1–5), OAH citizen stream check, second look, check-out with the same four feelings and experience tags.
- **Engagement arm (Q3):** volunteers are randomised 1:1 at enrolment to see the personal journal insights from their third visit onward, or only a visit counter. Randomisation is done in the app with a recorded seed.

## 3. Outcome and predictors

- **Restoration** (primary outcome) = ((joy + calm − irritation − worry) after − the same before) / 4, range −4 to 4. Exactly as in `src/wellbeing.js` and `scripts/analysis.py`.
- **Q1 predictor:** the StreamWell condition score (0–100, `src/score.js`) of the same visit.
- **Q2 predictors:** the six experience tags above, as recorded by the volunteer.
- **Covariates (fixed in advance):** mood balance on arrival, log(visit minutes / 20).
- **Q3 outcome:** returned for a second visit within 60 days (yes/no).

## 4. Sample size and stopping rule

- **Target:** 40 volunteers × 6 visits = 240 paired visits. By simulation (`scripts/analysis.py`), this detects a 0.25-point feature effect present on 20% of visits with about 84% power at α = 0.05.
- **Stopping:** data collection ends on 30 September or at 360 paired visits, whichever comes first. No interim analysis of Q1/Q2.

## 5. Analysis

- **Q1 and Q2:** linear model with volunteer fixed effects (each person compared with themselves), cluster-robust (CR1) standard errors by volunteer, two-sided α = 0.05. Q2 reports all six tags with 95% intervals; no stepwise selection. Holm correction across the six Q2 tags.
- **Q3:** difference in 60-day return proportions between arms, with a Newcombe 95% interval.
- **Method check already run:** on 200 simulated pilots with known effects, this model's 95% intervals covered the true effect 89–98% of the time, and a no-effect placebo was flagged in 4% of pilots (target 5%). See [recovery.md](recovery.md).

## 6. Exclusions (decided now)

- Visits shorter than 5 minutes or longer than 3 hours.
- Visits where the check-out was completed more than 2 hours after the check-in.
- Volunteers with only one visit are kept for Q3 but contribute nothing to the within-person estimates (by design of the fixed-effects model).
- No other exclusions. Every exclusion is reported with counts.

## 7. Privacy and ethics

- Feelings are health data under GDPR Art. 9: kept on the phone by default; shared only with explicit opt-in; research receives de-identified visit rows for this pilot under the partner's ethics approval, and public outputs are site/month aggregates with at least 5 distinct visitors.
- A data-protection impact assessment is completed before recruitment.
- StreamWell is not a medical device. Nobody is asked to enter the water.

## 8. What would change our mind

- If the Q1 interval includes zero at 240+ visits, the dashboard's "healthier streams, more restored people" panel is relabelled "no clear link in this city yet".
- If the placebo-style check on real data (a random tag) is flagged, the drivers panel is withdrawn until the cause is found.
- If the engagement arm shows no difference, the journal stays (volunteers asked for it) but StreamWell no longer claims it raises return rates.
