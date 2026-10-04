#!/usr/bin/env python3
"""
Research analysis for StreamWell paired data (runs on the synthetic pilot by
default; point it at a real export with --data).

1. Within-person model: restoration ~ stream features + experience tags,
   with volunteer fixed effects (each person compared with themselves), so
   stable differences between people (mood, optimism, fitness) cannot
   masquerade as stream effects. Cluster-robust (CR1) standard errors.
2. Site level: Spearman correlation between citizen stream condition and mean
   restoration, with a site bootstrap CI.
3. Power: how many paired visits a city pilot needs to detect a given effect
   of one stream feature, by simulation.

Only numpy is required.  Usage:  python3 scripts/analysis.py [--data FILE]
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
B32 = "0123456789abcdefghijklmnopqrstuv"


def load(path):
    d = json.loads(Path(path).read_text(encoding="utf-8"))
    return d["meta"], d["rows"]


def restoration(before, after):
    b = [int(c) for c in before]
    a = [int(c) for c in after]
    return ((a[0] + a[1] - a[2] - a[3]) - (b[0] + b[1] - b[2] - b[3])) / 4


FEATURES = {
    "natural banks": lambda ans, tags: ans[4] == "N",
    "trees on a bank": lambda ans, tags: "T" in (ans[11], ans[12]),
    "both banks vegetated": lambda ans, tags: ans[9] == "Y" and ans[10] == "Y",
    "clear water": lambda ans, tags: ans[1] == "C",
    "paving at the edge": lambda ans, tags: "Y" in (ans[7], ans[8]),
    "polluted discharge": lambda ans, tags: ans[18] == "Y",
    "sound of water": lambda ans, tags: bool(tags & 1),
    "birds or wildlife": lambda ans, tags: bool(tags & 2),
    "litter": lambda ans, tags: bool(tags & 32),
    "bad smell": lambda ans, tags: bool(tags & 64),
    "traffic noise": lambda ans, tags: bool(tags & 128),
    "felt unsafe": lambda ans, tags: bool(tags & 256),
}


def design(rows):
    X, y, person, site = [], [], [], []
    for r in rows:
        pi, s, _day, ans, before, after, tags, minutes, _travel, _rain, _t = r
        b = [int(c) for c in before]
        X.append([float(f(ans, tags)) for f in FEATURES.values()] + [(b[0] + b[1] - b[2] - b[3]) / 4, np.log(max(minutes, 5) / 20)])
        y.append(restoration(before, after))
        person.append(pi)
        site.append(s)
    return np.array(X), np.array(y), np.array(person), np.array(site)


def within_person_ols(X, y, groups):
    """Fixed effects by demeaning within person; CR1 cluster-robust SEs."""
    Xd = X.copy()
    yd = y.copy()
    for g in np.unique(groups):
        m = groups == g
        Xd[m] -= Xd[m].mean(axis=0)
        yd[m] -= yd[m].mean()
    keep = Xd.std(axis=0) > 0
    Xd = Xd[:, keep]
    beta, *_ = np.linalg.lstsq(Xd, yd, rcond=None)
    resid = yd - Xd @ beta
    bread = np.linalg.pinv(Xd.T @ Xd)
    meat = np.zeros((Xd.shape[1], Xd.shape[1]))
    ug = np.unique(groups)
    for g in ug:
        m = groups == g
        s = Xd[m].T @ resid[m]
        meat += np.outer(s, s)
    n, k, G = len(y), Xd.shape[1], len(ug)
    V = bread @ meat @ bread * (G / (G - 1)) * ((n - 1) / (n - k - len(ug)))
    return beta, np.sqrt(np.diag(V)), keep


def spearman(a, b):
    ra = np.argsort(np.argsort(a))
    rb = np.argsort(np.argsort(b))
    return np.corrcoef(ra, rb)[0, 1]


def site_level(rows, min_visits=5, reps=2000, seed=3):
    from collections import defaultdict
    sys_path = ROOT / "scripts"
    import sys
    sys.path.insert(0, str(sys_path))
    from simulate import condition_score  # same rules as src/score.js
    by = defaultdict(list)
    for r in rows:
        by[r[1]].append(r)
    xs, ys = [], []
    for s, rs in by.items():
        if len(rs) < min_visits:
            continue
        scores = [condition_score(list(r[3])) for r in rs]
        scores = [x for x in scores if x is not None]
        xs.append(np.mean(scores))
        ys.append(np.mean([restoration(r[4], r[5]) for r in rs]))
    xs, ys = np.array(xs), np.array(ys)
    rho = spearman(xs, ys)
    rng = np.random.default_rng(seed)
    boots = []
    for _ in range(reps):
        idx = rng.integers(0, len(xs), len(xs))
        boots.append(spearman(xs[idx], ys[idx]))
    return len(xs), rho, np.percentile(boots, [2.5, 97.5])


def power(effect=0.25, prevalence=0.2, sd_resid=0.45, person_sd=0.3, visits_per_person=6, sims=400, seed=5):
    """Share of simulated pilots in which a feature effect is detected (|t| > 1.96)."""
    rng = np.random.default_rng(seed)
    out = {}
    for n_people in (20, 40, 60, 100, 150):
        hits = 0
        for _ in range(sims):
            g = np.repeat(np.arange(n_people), visits_per_person)
            x = (rng.random(len(g)) < prevalence).astype(float)
            u = rng.normal(0, person_sd, n_people)[g]
            y = effect * x + u + rng.normal(0, sd_resid, len(g))
            beta, se, _ = within_person_ols(x[:, None], y, g)
            if abs(beta[0] / se[0]) > 1.96:
                hits += 1
        out[n_people * visits_per_person] = hits / sims
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default=str(ROOT / "data" / "demo-visits.json"))
    args = ap.parse_args()
    meta, rows = load(args.data)
    print(f"Data: {args.data}  ({len(rows)} visits, synthetic={meta.get('synthetic')})\n")

    X, y, person, _site = design(rows)
    names = list(FEATURES) + ["mood on arrival", "log visit length"]
    beta, se, keep = within_person_ols(X, y, person)
    print("1. Within-person model of restoration (volunteer fixed effects, cluster-robust 95% CI)")
    for name, b, s in zip([n for n, k in zip(names, keep) if k], beta, se):
        print(f"   {name:22s} {b:+.3f}  [{b - 1.96 * s:+.3f}, {b + 1.96 * s:+.3f}]")

    n, rho, ci = site_level(rows)
    print(f"\n2. Site level: Spearman rho = {rho:.2f} (95% CI {ci[0]:.2f} to {ci[1]:.2f}) across {n} sites with 5+ visits")

    print("\n3. Power to detect a 0.25-point effect of a feature present on 20% of visits (6 visits per volunteer)")
    for visits, p in power().items():
        print(f"   {visits:4d} visits: {p:.0%}")


if __name__ == "__main__":
    main()
