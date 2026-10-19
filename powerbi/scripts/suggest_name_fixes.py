"""Suggest Cricsheet IDs for unmatched auction names (helper for name_fixes.csv)."""
import sys, glob, json, re, unicodedata
import pandas as pd
from rapidfuzz import fuzz, process
RAW, UNM = sys.argv[1], sys.argv[2]
def norm(s):
    s = unicodedata.normalize("NFKD", str(s)).encode("ascii", "ignore").decode()
    out = []
    for t in re.sub(r"[^a-z]", " ", s.lower()).split():
        if len(t) == 1 and out and out[-1][1]:
            out[-1] = (out[-1][0] + t, True)
        else:
            out.append((t, len(t) == 1))
    return " ".join(t for t, _ in out)
tm = pd.read_csv(f"{RAW}/mappings/team_map.csv"); tmap = dict(zip(tm.RawName, tm.TeamKey))
rows = []
for f in glob.glob(f"{RAW}/cricsheet_ipl_json/*.json"):
    i = json.load(open(f, encoding="utf-8"))["info"]; s = int(i["dates"][0][:4])
    if s < 2013: continue
    for t, pl in i["players"].items():
        for p in pl: rows.append((i["registry"]["people"][p], p, tmap[t], s))
R = pd.DataFrame(rows, columns=["id", "name", "team", "season"]).drop_duplicates()
people = pd.read_csv(f"{RAW}/register/people.csv", usecols=["identifier", "name"])
names = pd.read_csv(f"{RAW}/register/names.csv")
allv = pd.concat([people, names]).drop_duplicates()
allv["k"] = allv.name.map(norm)
iplv = allv[allv.identifier.isin(set(R.id))]
U = pd.read_csv(UNM)
for _, u in U.iterrows():
    k = norm(u.Player)
    ro = R[(R.team == u.TeamKey) & R.season.between(u.Season, u.Season + 3)].drop_duplicates("id")
    c1 = process.extract(k, {r.id: norm(r.name) for r in ro.itertuples()}, scorer=fuzz.token_set_ratio, limit=2)
    c2 = process.extract(k, dict(zip(iplv.identifier + "|" + iplv.name, iplv.k)), scorer=fuzz.WRatio, limit=2)
    c3 = process.extract(k, dict(zip(allv.identifier + "|" + allv.name, allv.k)), scorer=fuzz.ratio, limit=1)
    nm = dict(zip(R.id, R.name))
    print(f"{u.Season}|{u.Player}|{u.TeamKey}|{u.PriceCr:.2f} || roster: " + "; ".join(f"{nm[c[2]]}({c[2]}) {c[1]:.0f}" for c in c1)
          + " || ipl: " + "; ".join(f"{c[2]} {c[1]:.0f}" for c in c2) + " || all: " + "; ".join(f"{c[2]} {c[1]:.0f}" for c in c3))
