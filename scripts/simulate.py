#!/usr/bin/env python3
"""
Generate the StreamWell *synthetic* pilot dataset: paired stream checks and
well-being check-ins at the 106 real OneAquaHealth research sites.

Why synthetic: no dataset pairs citizen stream assessments with before/after
well-being for the same visit. Producing that data is what StreamWell is for.
The dashboard therefore runs on a seeded, reproducible simulation whose
assumptions are written down here, next to the code that uses them.

Real inputs
  * src/sites.js        106 OAH research sites (OAH public API)
  * src/health-risks.js OAH lab health-risk scores per site (OAH public API)

Modelling assumptions (all effects are on the StreamWell restoration score,
the mean change across joy, calm, irritation and worry, range -4..4)
  * Short visits to blue space improve mood and well-being on average
    (e.g. Vert et al. 2020, Environ Res 188:109812, randomised crossover of
    20-min walks along an urban blue space in Barcelona).
  * Litter lowers how restorative a waterside place feels
    (Wyles et al. 2016, Environment and Behavior 48(9):1095-1126).
  * More natural, vegetated and biodiverse places are rated as more
    restorative (attention restoration / stress reduction literature).
  * People who arrive in a worse mood gain more (regression to the mean is
    modelled explicitly so the dashboard can adjust for it).
  * Each volunteer has their own sensitivity to the setting (random slope).
  * Citizens misread some features (10-15 %) and answer "not sure" sometimes.
Effect sizes are illustrative, chosen to be plausible, and must be replaced by
estimates from real StreamWell data.

Usage:  python3 scripts/simulate.py  ->  data/demo-visits.json
"""
from __future__ import annotations

import json
import math
import os
import re
from datetime import date, timedelta
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
SEED = int(os.environ.get("STREAMWELL_SEED", 20261004))  # override only for scripts/recovery.py
rng = np.random.default_rng(SEED)

START = date(2026, 4, 6)
END = date(2026, 10, 2)
N_DAYS = (END - START).days + 1


# ---------------------------------------------------------------- real inputs
def load_sites():
    text = (ROOT / "src" / "sites.js").read_text(encoding="utf-8")
    raw = re.search(r"const RAW = `(.*?)`;", text, re.S).group(1)
    sites = []
    for line in raw.strip().splitlines():
        code, name, city, lat, lon, alt = line.split("|")
        sites.append({"code": code, "name": name or f"Site {code}", "city": city, "lat": float(lat), "lon": float(lon)})
    return sites


def load_risks():
    text = (ROOT / "src" / "health-risks.js").read_text(encoding="utf-8")
    raw = re.search(r"const RAW = `(.*?)`;", text, re.S).group(1)
    out = {}
    for line in raw.strip().splitlines():
        code, d, pathogen, fecal, arg, score = line.split(",")
        out[code] = {"pathogen": float(pathogen), "fecal": float(fecal), "arg": float(arg), "score": float(score)}
    return out


SITES = load_sites()
RISKS = load_risks()

CITY = {
    # climate: mean summer max temperature (deg C), rain events per 30 days, urban-ness of the network
    "CO": {"tmax_summer": 29, "tmax_spring": 21, "rain_events": 4, "urban": 0.55, "dry_risk": 0.25},
    "TO": {"tmax_summer": 30, "tmax_spring": 21, "rain_events": 5, "urban": 0.55, "dry_risk": 0.3},
    "GH": {"tmax_summer": 23, "tmax_spring": 16, "rain_events": 9, "urban": 0.45, "dry_risk": 0.05},
    "BE": {"tmax_summer": 31, "tmax_spring": 21, "rain_events": 3, "urban": 0.35, "dry_risk": 0.45},
    "OS": {"tmax_summer": 22, "tmax_spring": 13, "rain_events": 9, "urban": 0.5, "dry_risk": 0.02},
}


def sigmoid(x):
    return 1 / (1 + math.exp(-x))


def clip(x, lo, hi):
    return max(lo, min(hi, x))


# ------------------------------------------------------------------- weather
def make_weather():
    """Daily rain (mm) and max temperature per city, simple seasonal model."""
    w = {}
    for cid, c in CITY.items():
        rain = np.zeros(N_DAYS)
        tmax = np.zeros(N_DAYS)
        for d in range(N_DAYS):
            day = START + timedelta(days=d)
            doy = day.timetuple().tm_yday
            season = math.sin((doy - 100) / 365 * 2 * math.pi)  # peaks around late July
            base = c["tmax_spring"] + (c["tmax_summer"] - c["tmax_spring"]) * max(0, season) ** 0.8
            tmax[d] = base + rng.normal(0, 3)
            p = c["rain_events"] / 30 * (0.6 if season > 0.7 and cid in ("CO", "BE", "TO") else 1.0)
            if rng.random() < p:
                rain[d] = float(rng.gamma(1.4, 7))
        w[cid] = {"rain": rain, "tmax": tmax}
    return w


WEATHER = make_weather()


def weather_for(city, d):
    r = WEATHER[city]["rain"]
    t = WEATHER[city]["tmax"]
    rain48 = float(r[max(0, d - 1): d + 1].sum())
    rain72 = float(r[max(0, d - 2): d + 1].sum())
    tmax3 = float(t[max(0, d - 2): d + 1].max())
    return rain48, rain72, tmax3


# --------------------------------------------------------------- site truths
def make_site_truth(s):
    c = CITY[s["city"]]
    risk = RISKS.get(s["code"], {}).get("score", 0.3)
    fecal = RISKS.get(s["code"], {}).get("fecal", 0.35)
    q = clip(0.5 - 0.9 * (risk - 0.3) + rng.normal(0, 0.14), 0.05, 0.97)  # latent ecological quality
    urban = clip(c["urban"] + rng.normal(0, 0.2) - 0.25 * (q - 0.5), 0.02, 0.98)
    t = {
        "q": q,
        "urban": urban,
        "fecal": fecal,
        "bottom": "N" if rng.random() < sigmoid(4 * (q - 0.25)) else "A",
        "form": rng.choice(["F", "U", "V"], p=[0.3, 0.45, 0.25]),
        "veg_cov": [rng.random() < sigmoid(5 * (q - 0.35)) for _ in range(2)],
        "veg_type": [rng.choice(["H", "B", "T"], p=_veg_p(q)) for _ in range(2)],
        "imperv": [rng.random() < sigmoid(5 * (urban - 0.55)) for _ in range(2)],
        "invasive": rng.random() < 0.18 + 0.15 * (1 - q),
        "pipes": rng.random() < sigmoid(5 * (urban - 0.45)),
        "abstraction": rng.random() < 0.08,
        "dams": rng.random() < 0.15 + 0.1 * urban,
        "construction_rate": 0.03 + 0.08 * urban,
        "discharge_rate": clip(0.02 + 0.35 * max(0, fecal - 0.3) + 0.08 * urban * (1 - q), 0, 0.5),
        "riffles": rng.random() < 0.25 + 0.5 * q,
        "habitat_rich": q,
        "debris": rng.random() < 0.3 + 0.55 * q,
        "flow_base": rng.choice(["F", "N", "S"], p=_flow_p(s["city"], q)),
        "dry_risk": c["dry_risk"] * (1.2 - q),
        # visit popularity: urban, nicer sites get more visits
        "pop": float(rng.lognormal(0, 0.6)) * (0.6 + urban) * (0.5 + q),
    }
    banks_p = [sigmoid(4 * (q - 0.35)), 0.25, 0]
    banks_p[2] = max(0.05, 1 - banks_p[0] - banks_p[1])
    tot = sum(banks_p)
    t["banks"] = rng.choice(["N", "L", "A"], p=[x / tot for x in banks_p])
    if t["bottom"] == "A" and t["banks"] == "N":
        t["banks"] = "L"
    return t


def _veg_p(q):
    trees = 0.15 + 0.6 * q
    shrubs = 0.3
    herbs = max(0.05, 1 - trees - shrubs)
    tot = trees + shrubs + herbs
    return [herbs / tot, shrubs / tot, trees / tot]


def _flow_p(city, q):
    if city in ("OS", "GH"):
        p = [0.35, 0.55, 0.10]
    elif city == "TO":
        p = [0.15, 0.55, 0.30]
    else:
        p = [0.25, 0.5, 0.25]
    p = [p[0] + 0.1 * q, p[1], max(0.02, p[2] - 0.1 * q)]
    tot = sum(p)
    return [x / tot for x in p]


TRUTH = {s["code"]: make_site_truth(s) for s in SITES}

# ------------------------------------------------------------- observations
HAB_BITS = {"SB": 1, "SI": 2, "SD": 4, "RF": 8, "AV": 16}
BIO_BITS = {"FT": 1, "FB": 2, "FL": 4}
B32 = "0123456789abcdefghijklmnopqrstuv"
TAG_BITS = {"waterSound": 1, "birds": 2, "shade": 4, "quiet": 8, "clean": 16, "litter": 32, "smell": 64, "noise": 128, "unsafe": 256, "concrete": 512}


def noisy(value, options, err=0.1, unsure=0.05):
    u = rng.random()
    if u < unsure:
        return "?"
    if u < unsure + err:
        others = [o for o in options if o != value]
        return str(rng.choice(others))
    return value


def yn(b, err=0.08, unsure=0.05):
    return noisy("Y" if b else "N", ["Y", "N"], err, unsure)


def observe(t, city, d, skill):
    """One volunteer's answers for a site on a day. Returns (answer string, aux dict)."""
    rain48, rain72, tmax3 = weather_for(city, d)
    month = (START + timedelta(days=d)).month
    err = 0.16 - 0.08 * skill
    uns = 0.09 - 0.05 * skill

    # flow: summer drying in Mediterranean cities, rain raises flow
    flow = t["flow_base"]
    if month in (7, 8, 9) and rng.random() < t["dry_risk"]:
        flow = "D" if rng.random() < 0.5 else "S"
    if rain48 > 12 and flow in ("S", "N"):
        flow = "F" if rng.random() < 0.5 else "N"

    discharge = rng.random() < t["discharge_rate"]
    construction = rng.random() < t["construction_rate"]
    # water look
    if flow == "D":
        colour = "?"
    elif discharge and rng.random() < 0.55:
        colour = "F" if rng.random() < 0.5 else "O"
    elif rain48 > 10 or construction:
        colour = "M" if rng.random() < 0.75 else "C"
    elif flow == "S" and tmax3 > 27 and rng.random() < 0.35:
        colour = "O"
    else:
        colour = "C" if rng.random() < 0.55 + 0.4 * t["q"] else "M"

    habs = 0
    for code, p in (("SB", 0.35), ("SI", 0.2), ("SD", 0.45), ("AV", 0.35)):
        if rng.random() < p * (0.4 + t["habitat_rich"]):
            habs |= HAB_BITS[code]
    if t["riffles"] and flow in ("F", "N") and rng.random() < 0.85:
        habs |= HAB_BITS["RF"]
    if rng.random() < err * 0.6:  # occasional misread
        habs ^= HAB_BITS[str(rng.choice(list(HAB_BITS)))]
    bio = 0
    if t["debris"]:
        for code, p in (("FT", 0.25), ("FB", 0.6), ("FL", 0.55)):
            if rng.random() < p:
                bio |= BIO_BITS[code]

    ans = [
        noisy({"F": "F", "N": "N", "S": "S", "D": "D"}[flow], ["F", "N", "S", "D"], err * 0.6, uns * 0.5),
        colour if colour == "?" else noisy(colour, ["C", "M", "F", "O"], err * 0.6, uns * 0.5),
        noisy(t["form"], ["F", "U", "V"], err * 1.5, uns),
        noisy(t["bottom"], ["N", "A"], err * 0.5, uns),
        noisy(t["banks"], ["N", "L", "A"], err, uns),
        B32[habs],
        str(bio),
        yn(t["imperv"][0], err * 0.5, uns * 0.5), yn(t["imperv"][1], err * 0.5, uns * 0.5),
        yn(t["veg_cov"][0], err, uns * 0.5), yn(t["veg_cov"][1], err, uns * 0.5),
        noisy(t["veg_type"][0], ["H", "B", "T"], err, uns), noisy(t["veg_type"][1], ["H", "B", "T"], err, uns),
        yn(t["invasive"], err * 1.5, uns * 3),
        yn(rng.random() < 0.15, err, uns),
        yn(t["abstraction"], err * 0.5, uns),
        yn(t["dams"], err * 0.5, uns * 0.5),
        yn(t["pipes"], err, uns),
        yn(discharge, err * 0.3, uns * 0.5),
        yn(construction, err * 0.3, uns * 0.3),
    ]
    aux = {"rain48": rain48, "rain72": rain72, "tmax3": tmax3, "discharge": discharge, "flow": flow, "colour": colour}
    return ans, aux


def condition_score(ans):
    """Python mirror of src/score.js (kept in sync by tests/score.test.mjs)."""
    def comp(parts):
        e = sum(p[0] for p in parts if p is not None)
        m = sum(p[1] for p in parts if p is not None)
        return None if m == 0 else max(0, min(1, e / m)) * 25

    flow, colour, form, bottom, banks, habs, bio = ans[0], ans[1], ans[2], ans[3], ans[4], ans[5], ans[6]
    channel = comp([
        None if bottom == "?" else ({"N": 12, "A": 0}[bottom], 12),
        None if banks == "?" else ({"N": 13, "L": 7, "A": 0}[banks], 13),
    ])
    n_hab = bin(B32.index(habs)).count("1")
    ladder = [0, 6, 11, 15, 18, 20]
    hab_pts = ladder[min(n_hab, 5)]
    if flow == "D":
        hab_pts = min(hab_pts, 6)
    habitat = comp([(hab_pts, 20), (5 if int(bio) > 0 else 0, 5)])
    parts = []
    for i in (0, 1):
        cov, typ, imp = ans[9 + i], ans[11 + i], ans[7 + i]
        parts.append(None if cov == "?" else (6 if cov == "Y" else 0, 6))
        parts.append(None if typ == "?" else ({"T": 4.5, "B": 3, "H": 1.5}[typ], 4.5))
        parts.append(None if imp == "?" else (0 if imp == "Y" else 2, 2))
    parts.append(None if ans[13] == "?" else (0 if ans[13] == "Y" else 2, 2))
    parts.append(None if ans[14] == "?" else (0 if ans[14] == "Y" else 1, 1))
    margins = comp(parts)
    wparts = [
        None if colour == "?" else ({"C": 10, "M": 4, "F": 2, "O": 0}[colour], 10),
        None if flow == "?" else ({"F": 5, "N": 5, "S": 2, "D": 0}[flow], 5),
    ]
    for idx, wgt in ((15, 2), (16, 2), (17, 1.5), (18, 3), (19, 1.5)):
        wparts.append(None if ans[idx] == "?" else (0 if ans[idx] == "Y" else wgt, wgt))
    water = comp(wparts)
    comps = [c for c in (channel, habitat, margins, water) if c is not None]
    if not comps:
        return None
    return sum(comps) if len(comps) == 4 else sum(comps) / len(comps) * 4


def rating_from(score, bias):
    s = score + bias + rng.normal(0, 9)
    return "G" if s >= 67 else "M" if s >= 40 else "P"


# ------------------------------------------------------------------ people
N_PEOPLE = 260
CITY_IDS = list(CITY)
city_weights = np.array([1.2, 1.0, 1.0, 0.8, 1.0])
PEOPLE = []
for i in range(N_PEOPLE):
    home = CITY_IDS[rng.choice(len(CITY_IDS), p=city_weights / city_weights.sum())]
    PEOPLE.append({
        "city": home,
        "skill": float(rng.beta(2, 2)),
        "sens": float(rng.normal(1.0, 0.3)),  # sensitivity to setting
        "joy": clip(rng.normal(3.1, 0.6), 1.5, 4.6),
        "serenity": clip(rng.normal(2.9, 0.6), 1.5, 4.6),
        "anger": clip(rng.normal(1.8, 0.5), 1, 3.8),
        "fear": clip(rng.normal(2.0, 0.6), 1, 4.0),
        "activity": float(rng.lognormal(0, 0.8)),
        "rating_bias": float(rng.normal(0, 7)),
        "travel": int(rng.choice(4, p=[0.58, 0.16, 0.12, 0.14])),
    })

SITES_BY_CITY = {c: [s for s in SITES if s["city"] == c] for c in CITY}


def emotions_before(p):
    return [int(clip(round(p[k] + rng.normal(0, 0.7)), 1, 5)) for k in ("joy", "serenity", "anger", "fear")]


def visit_tags(t, ans, aux):
    tags = 0
    habs = B32.index(ans[5])
    if (habs & HAB_BITS["RF"]) or aux["flow"] == "F":
        tags |= TAG_BITS["waterSound"] if rng.random() < 0.7 else 0
    if rng.random() < 0.2 + 0.5 * t["q"]:
        tags |= TAG_BITS["birds"]
    if "T" in (ans[11], ans[12]) and rng.random() < 0.7:
        tags |= TAG_BITS["shade"]
    if rng.random() < 0.65 * (1 - t["urban"]):
        tags |= TAG_BITS["quiet"]
    if rng.random() < 0.15 + 0.4 * t["q"]:
        tags |= TAG_BITS["clean"]
    litter_p = 0.08 + 0.45 * t["urban"] * (1 - t["q"])
    if not (tags & TAG_BITS["clean"]) and rng.random() < litter_p:
        tags |= TAG_BITS["litter"]
    if aux["discharge"] or (aux["colour"] in ("M", "O") and ans[17] == "Y" and rng.random() < 0.3) or (aux["flow"] == "S" and aux["tmax3"] > 27 and rng.random() < 0.25):
        tags |= TAG_BITS["smell"]
    if rng.random() < 0.6 * t["urban"]:
        tags |= TAG_BITS["noise"]
    if rng.random() < 0.06 + 0.12 * t["urban"] * (1 - t["q"]):
        tags |= TAG_BITS["unsafe"]
    if ans[4] == "A" or ans[3] == "A":
        tags |= TAG_BITS["concrete"] if rng.random() < 0.75 else 0
    return tags


def restoration_effect(p, t, ans, tags, minutes, before, score):
    has = lambda k: bool(tags & TAG_BITS[k])
    setting = (
        0.55 * ((score if score is not None else 50) / 100 - 0.5)
        + 0.25 * has("waterSound") + 0.15 * has("birds") + 0.18 * has("shade") + 0.1 * has("quiet")
        - 0.45 * has("litter") - 0.5 * has("smell") - 0.22 * has("noise") - 0.65 * has("unsafe") - 0.15 * has("concrete")
    )
    balance = before[0] + before[1] - before[2] - before[3]
    r = 0.32 + p["sens"] * setting + 0.12 * math.log(max(minutes, 5) / 20) - 0.07 * (balance - 2.2) + rng.normal(0, 0.33)
    return r


def emotions_after(before, r):
    weights = (0.85, 1.2, -0.8, -0.75)  # joy, calm go up; irritation, worry go down
    after = []
    for b, wgt in zip(before, weights):
        val = b + wgt * r + rng.normal(0, 0.35)
        after.append(int(clip(round(val), 1, 5)))
    return after


# ------------------------------------------------------------------ visits
def simulate():
    rows = []
    site_pop = {s["code"]: TRUTH[s["code"]]["pop"] for s in SITES}
    n_target = 1650
    for _ in range(n_target):
        pi = int(rng.integers(N_PEOPLE))
        p = PEOPLE[pi]
        city = p["city"] if rng.random() < 0.93 else CITY_IDS[int(rng.integers(len(CITY_IDS)))]
        cands = SITES_BY_CITY[city]
        w = np.array([site_pop[s["code"]] for s in cands])
        s = cands[int(rng.choice(len(cands), p=w / w.sum()))]
        # more visits in late spring/summer, fewer in rainy spells
        while True:
            d = int(rng.integers(N_DAYS))
            month = (START + timedelta(days=d)).month
            if rng.random() < {4: 0.6, 5: 0.85, 6: 1.0, 7: 0.9, 8: 0.85, 9: 0.95, 10: 0.8}[month]:
                break
        rows.append(make_visit(pi, p, s, d))
    rows.sort(key=lambda r: (r[2], r[1]))
    return rows


def make_visit(pi, p, s, d, rating_bias=None):
    t = TRUTH[s["code"]]
    ans, aux = observe(t, s["city"], d, p["skill"])
    score = condition_score(ans + ["?"])
    rating = rating_from(score if score is not None else 50, p["rating_bias"] if rating_bias is None else rating_bias)
    ans.append(rating)
    minutes = int(clip(rng.lognormal(math.log(22), 0.45), 5, 120))
    tags = visit_tags(t, ans, aux)
    before = emotions_before(p)
    r = restoration_effect(p, t, ans, tags, minutes, before, score)
    after = emotions_after(before, r)
    travel = p["travel"]
    return [pi, s["code"], d, "".join(ans), "".join(map(str, before)), "".join(map(str, after)), tags, minutes, travel,
            round(aux["rain48"], 1), round(aux["tmax3"], 1)]


def demo_person():
    """The 'You (demo)' journal: a Coimbra volunteer on a blue prescription since 2026-08-17."""
    p = {"city": "CO", "skill": 0.75, "sens": 1.25, "joy": 2.4, "serenity": 2.1, "anger": 2.3, "fear": 2.9,
         "activity": 1.0, "rating_bias": 0.0, "travel": 0}
    PEOPLE.append(p)
    pi = len(PEOPLE) - 1
    plan = [("C3", 133), ("C10", 136), ("C3", 140), ("C15", 143), ("C3", 147), ("C5", 150), ("C10", 154),
            ("C3", 157), ("C15", 161), ("C3", 164), ("C10", 168), ("C5", 171), ("C3", 175), ("C15", 178)]
    site = {s["code"]: s for s in SITES}
    rows = []
    for k, (code, d) in enumerate(plan):
        # mood slowly improves over the programme (well-being trend), visits still restore
        p["joy"] = 2.4 + 0.025 * k
        p["serenity"] = 2.1 + 0.03 * k
        p["fear"] = 2.9 - 0.025 * k
        rows.append(make_visit(pi, p, site[code], d, rating_bias=0.0))
    return pi, rows


def main():
    rows = simulate()
    demo_pi, demo_rows = demo_person()
    rows += demo_rows
    out = {
        "meta": {
            "synthetic": True,
            "generator": "scripts/simulate.py",
            "seed": SEED,
            "start": START.isoformat(),
            "end": END.isoformat(),
            "people": len(PEOPLE),
            "visits": len(rows),
            "demoPerson": demo_pi,
            "note": "SYNTHETIC demo data. Sites and lab health-risk scores are real OneAquaHealth data; every visit, answer and feeling is simulated.",
            "answerOrder": ["waterFlow", "waterColor", "channelForm", "bottomChannelType", "banksChannelType", "habitats(b32 mask SB1 SI2 SD4 RF8 AV16)", "fallenBiomassTypes(mask FT1 FB2 FL4)", "imperviousLeft", "imperviousRight", "vegCoveredLeft", "vegCoveredRight", "vegTypeLeft", "vegTypeRight", "invasive", "recentCuts", "waterAbstraction", "hasDams", "pipes", "waterDischarge", "construction", "overallAssessment"],
            "rowFields": ["person", "site", "day", "answers", "before(joy,serenity,anger,fear)", "after", "tagsMask", "minutes", "travel(0 walk,1 cycle,2 transit,3 car)", "rain48mm", "tmax3C"],
        },
        "rows": rows,
    }
    path = ROOT / "data" / "demo-visits.json"
    path.write_text(json.dumps(out, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
    print(f"wrote {path} ({path.stat().st_size/1024:.0f} KB, {len(rows)} visits, {len(PEOPLE)} people)")


if __name__ == "__main__":
    main()
