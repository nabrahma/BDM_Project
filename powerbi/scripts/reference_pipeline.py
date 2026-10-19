"""Reference implementation of the Power Query pipeline, in pandas.

Used only to validate the Power BI model: it mirrors the M logic step by step
and prints the QA numbers from PRD section 9, plus the auction names that the
automatic matching passes could not resolve (candidates for name_fixes.csv).

Usage (from powerbi/):  ../.venv/Scripts/python -I scripts/reference_pipeline.py ../data/raw [out_dir]
"""
import glob
import json
import os
import re
import sys
import unicodedata

import pandas as pd

RAW = sys.argv[1]
OUT = sys.argv[2] if len(sys.argv) > 2 else None
USD_INR_2013 = 54.0
MEGA = [2014, 2018, 2022, 2025]
LAST_SEASON = 2026
NON_BOWLER = {"run out", "retired hurt", "retired out", "obstructing the field", "retired not out"}

team_map = pd.read_csv(f"{RAW}/mappings/team_map.csv")
tmap = dict(zip(team_map.RawName, team_map.TeamKey))


def norm(s):
    s = unicodedata.normalize("NFKD", str(s)).encode("ascii", "ignore").decode()
    out = []
    for t in re.sub(r"[^a-z]", " ", s.lower()).split():
        if len(t) == 1 and out and out[-1][1]:
            out[-1] = (out[-1][0] + t, True)
        else:
            out.append((t, len(t) == 1))
    return " ".join(t for t, _ in out)


# ---------- 1. Parse Cricsheet JSON ----------
matches, apps, deliv, field = [], [], [], []
for f in glob.glob(f"{RAW}/cricsheet_ipl_json/*.json"):
    j = json.load(open(f, encoding="utf-8"))
    info = j["info"]
    season = int(info["dates"][0][:4])
    if season < 2013:
        continue
    mid = int(os.path.basename(f)[:-5])
    reg = info["registry"]["people"]
    out = info.get("outcome", {})
    winner = out.get("winner") or out.get("eliminator")
    teams = info["teams"]
    matches.append(dict(MatchID=mid, Season=season, Date=info["dates"][0], Venue=info.get("venue"),
                        Team1=teams[0], Team2=teams[1], Winner=winner, NoResult=int(winner is None)))
    for t, plist in info["players"].items():
        for p in plist:
            apps.append(dict(MatchID=mid, Season=season, TeamName=t, PlayerName=p, PlayerID=reg[p]))
    for inn in j["innings"]:
        if inn.get("super_over"):
            continue
        bat = inn["team"]
        bowl = teams[1] if teams[0] == bat else teams[0]
        for ov in inn["overs"]:
            for d in ov["deliveries"]:
                ex = d.get("extras", {})
                r = d["runs"]
                wd, nb = ex.get("wides", 0), ex.get("noballs", 0)
                bowler_wkts = 0
                for w in d.get("wickets", []):
                    k = w["kind"]
                    if k not in NON_BOWLER:
                        bowler_wkts += 1
                    fl = [reg.get(x["name"], "SUB:" + x["name"]) for x in w.get("fielders", []) if x.get("name")]
                    if k == "caught" and fl:
                        field.append((season, mid, bowl, fl[0], "Catch"))
                    elif k == "caught and bowled":
                        field.append((season, mid, bowl, reg[d["bowler"]], "Catch"))
                    elif k == "stumped" and fl:
                        field.append((season, mid, bowl, fl[0], "Stumping"))
                    elif k == "run out":
                        for x in fl:
                            field.append((season, mid, bowl, x, "RunOut"))
                four = int(r["batter"] == 4 and not r.get("non_boundary"))
                six = int(r["batter"] == 6 and not r.get("non_boundary"))
                deliv.append(dict(MatchID=mid, Season=season, BatTeam=bat, BowlTeam=bowl,
                                  BatterID=reg[d["batter"]], BowlerID=reg[d["bowler"]],
                                  BatterRuns=r["batter"], Wides=wd, NoBalls=nb,
                                  Byes=ex.get("byes", 0), LegByes=ex.get("legbyes", 0),
                                  Four=four, Six=six, BowlerWickets=bowler_wkts,
                                  BatterOut=int(any(w["player_out"] == d["batter"] for w in d.get("wickets", [])))))

M = pd.DataFrame(matches)
A = pd.DataFrame(apps)
D = pd.DataFrame(deliv)
F = pd.DataFrame(field, columns=["Season", "MatchID", "TeamName", "PlayerID", "Kind"])
for df, c in [(A, "TeamName"), (F, "TeamName")]:
    df["TeamKey"] = df[c].map(tmap)
D["BatKey"] = D.BatTeam.map(tmap)
D["BowlKey"] = D.BowlTeam.map(tmap)
assert A.TeamKey.notna().all() and D.BatKey.notna().all(), "unmapped team"

# ---------- 2. Player-season stats ----------
D["Legal"] = ((D.Wides == 0) & (D.NoBalls == 0)).astype(int)
D["Faced"] = (D.Wides == 0).astype(int)
D["Conceded"] = D.BatterRuns + D.Wides + D.NoBalls
D["Dot"] = ((D.Legal == 1) & (D.Conceded == 0)).astype(int)
bat = D.groupby(["Season", "BatterID", "BatKey"]).agg(Runs=("BatterRuns", "sum"), BallsFaced=("Faced", "sum"),
                                                    Fours=("Four", "sum"), Sixes=("Six", "sum"),
                                                    Outs=("BatterOut", "sum")).reset_index()
bat.columns = ["Season", "PlayerID", "TeamKey"] + list(bat.columns[3:])
bowl = D.groupby(["Season", "BowlerID", "BowlKey"]).agg(LegalBalls=("Legal", "sum"), RunsConceded=("Conceded", "sum"),
                                                      DotBalls=("Dot", "sum"), Wickets=("BowlerWickets", "sum")).reset_index()
bowl.columns = ["Season", "PlayerID", "TeamKey"] + list(bowl.columns[3:])
fl = F.pivot_table(index=["Season", "PlayerID", "TeamKey"], columns="Kind", values="MatchID", aggfunc="count", fill_value=0).reset_index()
fl = fl.rename(columns={"Catch": "Catches", "Stumping": "Stumpings", "RunOut": "RunOuts"})
mt = A.groupby(["Season", "PlayerID", "TeamKey"]).MatchID.nunique().rename("Matches").reset_index()
S = mt.merge(bat, how="outer").merge(bowl, how="outer").merge(fl, how="outer").fillna(0)
S["ImpactPoints"] = (S.Runs + S.Fours + 2 * S.Sixes + 25 * S.Wickets + S.DotBalls
                     + 8 * S.Catches + 12 * S.Stumpings + 6 * S.RunOuts)

# ---------- 3. Auction ----------
rows = []
for f in sorted(glob.glob(f"{RAW}/auction/ipl_auction_*.csv")):
    y = int(re.search(r"ipl_auction_(\d{4})", f).group(1))
    d = pd.read_csv(f, dtype=str).rename(columns=lambda c: c.strip())
    num = lambda s: pd.to_numeric(s.str.replace(r"[^0-9.]", "", regex=True), errors="coerce")
    if "Price in $" in d:
        price = num(d["Price in $"]) * USD_INR_2013 / 1e7
        base = pd.Series([None] * len(d))
    elif "Winning Bid in Rs" in d:
        price = num(d["Winning Bid in Rs"]) / 1e7
        base = num(d["BasePrices in Rs"]) / 1e7
    else:
        price = num(d["Price in rs"]) / 1e7
        base = pd.Series([None] * len(d))
    rows.append(pd.DataFrame(dict(Season=y, Player=d.Name.str.strip(), Team=d.TeamName.str.strip(),
                                  Role=d.get("Role", pd.Series([None] * len(d))),
                                  Nationality=d.get("Nationality", pd.Series([None] * len(d))),
                                  PriceCr=price, BasePriceCr=base)))
AU = pd.concat(rows, ignore_index=True)
AU["TeamKey"] = AU.Team.map(tmap)
AU["NameKey"] = AU.Player.map(norm)
assert AU.TeamKey.notna().all(), AU[AU.TeamKey.isna()].Team.unique()

# ---------- 4. Name matching ----------
people = pd.read_csv(f"{RAW}/register/people.csv", usecols=["identifier", "name"])
names = pd.read_csv(f"{RAW}/register/names.csv")
ipl_ids = set(A.PlayerID)
variants = pd.concat([people.rename(columns={"identifier": "PlayerID", "name": "Variant"}),
                      names.rename(columns={"identifier": "PlayerID", "name": "Variant"})])
variants = variants[variants.PlayerID.isin(ipl_ids)].copy()
variants["VKey"] = variants.Variant.map(norm)
variants = variants.drop_duplicates(["PlayerID", "VKey"])
cs_name = A.drop_duplicates("PlayerID").set_index("PlayerID").PlayerName

# roster: who played for TeamKey in seasons S..S+3
roster = A[["PlayerID", "TeamKey", "Season"]].drop_duplicates()


def initials_key(n):
    t = n.split()
    return n if len(t) < 2 else "".join(x[0] for x in t[:-1]) + " " + t[-1]


fixes_path = f"{RAW}/mappings/name_fixes.csv"
fixes = pd.read_csv(fixes_path) if os.path.exists(fixes_path) else pd.DataFrame(columns=["AuctionName", "PlayerID"])
fixmap = dict(zip(fixes.AuctionName.map(norm), fixes.PlayerID))

# Pass 1: exact full-name variant, unique among IPL players
vc = variants.groupby("VKey").PlayerID.nunique()
uniq = variants[variants.VKey.isin(vc[vc == 1].index)].drop_duplicates("VKey").set_index("VKey").PlayerID
allv = pd.concat([people.rename(columns={"identifier": "PlayerID", "name": "Variant"}),
                  names.rename(columns={"identifier": "PlayerID", "name": "Variant"})])
allv["VKey"] = allv.Variant.map(norm)
avc = allv.drop_duplicates(["PlayerID", "VKey"]).groupby("VKey").PlayerID.nunique()
runiq = allv[allv.VKey.isin(avc[avc == 1].index)].drop_duplicates("VKey").set_index("VKey").PlayerID
res, how = [], []
for _, r in AU.iterrows():
    pid, h = None, None
    if r.NameKey in fixmap:
        pid, h = fixmap[r.NameKey], "Manual"
    if pid is None and r.NameKey in uniq.index:
        pid, h = uniq[r.NameKey], "Exact"
    if pid is None and r.NameKey in runiq.index:
        pid, h = runiq[r.NameKey], "ExactRegister"
    if pid is None:
        ro = roster[(roster.TeamKey == r.TeamKey) & roster.Season.between(r.Season, r.Season + 3)].PlayerID.unique()
        cand = variants[variants.PlayerID.isin(ro)]
        ik = norm(initials_key(r.NameKey))
        hit = cand[cand.VKey == ik].PlayerID.unique()
        if len(hit) == 1:
            pid, h = hit[0], "Initials"
        else:
            t = r.NameKey.split()
            last, first = t[-1], t[0][0]
            hit = cand[cand.VKey.str.split().str[-1].eq(last) & cand.VKey.str[0].eq(first)].PlayerID.unique()
            if len(hit) == 1:
                pid, h = hit[0], "Surname"
    res.append(pid)
    how.append(h)
AU["PlayerID"] = res
AU["MatchPass"] = how
print("Match pass counts:\n", AU.MatchPass.value_counts(dropna=False).to_string())
print("Spend matched %:", round(100 * AU[AU.PlayerID.notna()].PriceCr.sum() / AU.PriceCr.sum(), 2))
left = AU[AU.PlayerID.isna()].sort_values("PriceCr", ascending=False)
print("Unmatched rows:", len(left), "spend", round(left.PriceCr.sum(), 2))

# ---------- 5. Contracts ----------
AU = AU.sort_values(["NameKey", "Season"])
AU["PKey"] = AU.PlayerID.fillna("A_" + AU.NameKey)
AU["NextAuction"] = AU.groupby("PKey").Season.shift(-1)
last_played = A.groupby(["PlayerID", "TeamKey"]).Season.max()
crow = []
for _, r in AU.iterrows():
    nm = min([m for m in MEGA if m > r.Season], default=LAST_SEASON + 1)
    end = min(nm - 1, LAST_SEASON, (r.NextAuction - 1) if pd.notna(r.NextAuction) else LAST_SEASON)
    lp = last_played.get((r.PlayerID, r.TeamKey), r.Season) if r.PlayerID else r.Season
    for s in range(int(r.Season), int(end) + 1):
        if s == r.Season or s <= lp:
            crow.append(dict(PlayerID=r.PKey, TeamKey=r.TeamKey, Season=s, PriceCr=r.PriceCr, AuctionSeason=r.Season))
C = pd.DataFrame(crow).drop_duplicates(["PlayerID", "TeamKey", "Season"], keep="last")
FPS = S.merge(C, how="outer", on=["PlayerID", "TeamKey", "Season"])
FPS["PriceSource"] = FPS.PriceCr.notna().map({True: "Auction", False: "Unpriced"})
FPS = FPS.fillna({c: 0 for c in S.columns if c not in ("PlayerID", "TeamKey", "Season")})

# ---------- 6. QA ----------
print("\nMatches per season:\n", M.groupby("Season").MatchID.count().to_string())
print("\n2026 sold:", (AU.Season == 2026).sum(), "spend", round(AU[AU.Season == 2026].PriceCr.sum(), 2))
print("Max price:", AU.loc[AU.PriceCr.idxmax(), ["Player", "Season", "PriceCr"]].to_list())
print("Null/zero prices:", int((AU.PriceCr.isna() | (AU.PriceCr <= 0)).sum()))
print("TeamKeys:", sorted(set(AU.TeamKey) | set(FPS.TeamKey)))
for y in (2016, 2023, 2024):
    t = S[S.Season == y].groupby("PlayerID").Runs.sum().sort_values().tail(1)
    w = S[S.Season == y].groupby("PlayerID").Wickets.sum().sort_values().tail(1)
    print(y, "Orange", cs_name[t.index[0]], int(t.iloc[0]), "| Purple", cs_name[w.index[0]], int(w.iloc[0]))
pr = FPS[FPS.PriceSource == "Auction"]
print("\nPriced player-season rows:", len(pr), " spend in fact:", round(pr.PriceCr.sum(), 1))
tm = pd.concat([M.assign(T=M.Team1), M.assign(T=M.Team2)])
tm["Won"] = (tm.Winner == tm["T"]).astype(int)
print("Win% (all seasons):", round(tm.Won.sum() / (len(tm) - tm.NoResult.sum()), 3))
for pid in ("ba607b88",):  # V Kohli
    print("Kohli 2016 impact:", S[(S.PlayerID == pid) & (S.Season == 2016)].ImpactPoints.sum())

if OUT:
    os.makedirs(OUT, exist_ok=True)
    left[["Season", "Player", "Team", "TeamKey", "PriceCr"]].to_csv(f"{OUT}/unmatched.csv", index=False)
    AU.to_csv(f"{OUT}/auction_matched.csv", index=False)
    FPS.to_csv(f"{OUT}/fact_player_season.csv", index=False)
    print("wrote", OUT)
