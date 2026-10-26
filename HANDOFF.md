# Handoff: Power BI → MERN web app

The Power BI dashboard is finished and checked. The next step is a **MERN web app** in [`web/`](web/) that shows the same analysis interactively. All the hard data work is already done: the clean tables are in [`data/processed/`](data/processed/) with every metric precomputed, so the web app only has to load, query and display them.

## 1. What is finished

| Item | Where |
| --- | --- |
| Power BI report: Home + 8 pages + drill-through Player Profile + hover tooltip + hidden QA page | `powerbi/IPL_Auction_Value.pbip` |
| PDF of all pages, plus PNG screenshots | `powerbi/deliverables/IPL_Auction_Value.pdf`, `powerbi/deliverables/screenshots/` |
| Project report (method, model, findings, validation) | [`powerbi/deliverables/project_report.md`](powerbi/deliverables/project_report.md) |
| 8-minute demo script + likely examiner questions | [`powerbi/deliverables/demo_script.md`](powerbi/deliverables/demo_script.md) |
| Clean data for the web app (CSV + JSON) | [`data/processed/`](data/processed/); every column is explained in [`data/README.md`](data/README.md) |
| Raw sources (rebuildable) | [`data/raw/`](data/raw/) |
| Original brief | [`docs/PRD_PowerBI.md`](docs/PRD_PowerBI.md), [`docs/IPL_Data_Kit.pdf`](docs/IPL_Data_Kit.pdf) |

All QA checks pass: Orange and Purple Caps match the official winners, the 2026 auction has 77 buys for ₹215.45 Cr, league Value Index is 1.00 in every season, and 99% of auction spend is matched to ball-by-ball data. The full table is in [`powerbi/README.md`](powerbi/README.md#qa-results-prd-section-9).

**Single-file copy for submission:** [`Handover/IPL_Auction_Value.pbix`](Handover/IPL_Auction_Value.pbix) (data included, opens with a double-click). Still optional: add teammate names on the Home page and in the project report, which currently say "Prepared by Nabaskar".

## 2. Read these first (15 minutes)

1. Skim [`powerbi/deliverables/IPL_Auction_Value.pdf`](powerbi/deliverables/IPL_Auction_Value.pdf). This is what the web app should be able to show.
2. Read the **Value metric** section of the [project report](powerbi/deliverables/project_report.md#5-the-value-metric): Impact Points, Value Index, Overpay and the quadrants.
3. Read [`data/README.md`](data/README.md). It explains every collection and column, plus the one formula you must not get wrong.

You do **not** need Power BI or Python to build the web app. Node and MongoDB are enough.

## 3. Suggested web app layout

```
web/
├── server/                 Express + Mongoose API
│   ├── src/models/         one model per collection below
│   ├── src/routes/         endpoints in section 5
│   ├── src/lib/valueIndex.js   the Value Index aggregation (section 6)
│   ├── scripts/seed.js     loads ../../data/processed/*.json into MongoDB
│   └── .env.example        MONGODB_URI=mongodb://localhost:27017/ipl_auction
└── client/                 React (Vite) + a chart library (Recharts or Chart.js)
    └── src/pages/          one page per dashboard page
```

Run the seed script from the repo so it always reads the committed `data/processed/` files, and don't copy the data into `web/`. Keep `node_modules/` and `.env` out of git (already in `.gitignore`).

## 4. Load the data into MongoDB

One collection per file in `data/processed/`:

```bash
for f in players teams seasons team_seasons player_seasons auction_buys team_matches unsold_players; do
  mongoimport --uri "$MONGODB_URI" --collection "$f" --drop --jsonArray --file "data/processed/$f.json"
done
```

Or do the same in `seed.js` with `insertMany(JSON.parse(fs.readFileSync(...)))`. Suggested indexes:

- `player_seasons`: `{Season: 1}`, `{PlayerID: 1}`, `{TeamKey: 1, Season: 1}`
- `players`: `{PlayerID: 1}` (unique), text index on `PlayerName`
- `team_seasons`: `{Season: 1}`
- `auction_buys`: `{Season: 1}`, `{PlayerID: 1}`

## 5. Pages → API endpoints → data

Each page should do what its Power BI counterpart does. A season filter defaulting to **2026** is shared across pages.

| Dashboard page | What it shows | Suggested endpoint | Source collection |
| --- | --- | --- | --- |
| Home | KPI strip (players, seasons, spend, % matched) + cards linking to pages | `GET /api/summary` | seasons, players, auction_buys |
| 1 Auction Market | Avg price per season (mega auctions highlighted), spend, top buy, premium over base | `GET /api/seasons` | seasons, auction_buys |
| 2 Franchise Efficiency | Value Index by team, spend vs win % scatter, team × season matrix | `GET /api/team-seasons?season=` | team_seasons, teams |
| 3 Player Value Map | Scatter: price (x) vs Impact Points (y), dot colour = quadrant, dashed median lines | `GET /api/player-seasons?season=&priced=true` | player_seasons |
| 4 Steals and Overpaid | Top 10 by Value Index, top 10 by Overpay, Bargain XI / Overpaid XI, unsold list | `GET /api/rankings/steals?season=`, `/api/rankings/overpaid?season=`, `GET /api/unsold` | player_seasons, unsold_players |
| 5 Role and Nationality | Value Index and avg price by role × Indian/Overseas | `GET /api/breakdown?by=Role\|Nationality&season=` | player_seasons + seasons |
| 6 Price Brackets | Value Index and "% above median impact" by price bracket | `GET /api/breakdown?by=PriceBracket&season=` | player_seasons + seasons |
| 7 Player Profile | Search a player; price bars vs Impact Points line by season; career totals | `GET /api/players?q=`, `GET /api/players/:id` | players, player_seasons, auction_buys |
| 8 Methodology | Static text: copy from the project report | none | none |

## 6. Rules that keep the numbers identical to Power BI

1. **Value metrics use priced rows only:** `PriceSource === "Auction"`. `Unpriced` rows (retained players such as Kohli) still show stats, but they have no Value Index.
2. **Never average `ValueIndex`.** For any group (team, role, bracket, several seasons), sum the shares per season and then divide. A sketch of the formula as a Mongo aggregation (not yet run against a database; check it against the test values below):

   ```js
   // match is e.g. { Season: 2026 } or {} for all seasons; key is "Role", "Nationality", "PriceBracket", "TeamKey" …
   const valueIndexBy = (key, match = {}) => [
     { $match: { PriceSource: "Auction", ...match } },
     { $group: { _id: { k: `$${key}`, s: "$Season" }, imp: { $sum: "$ImpactPoints" }, spend: { $sum: "$PriceCr" } } },
     { $lookup: { from: "seasons", localField: "_id.s", foreignField: "Season", as: "L" } },
     { $unwind: "$L" },
     { $group: {
         _id: "$_id.k",
         impShare:   { $sum: { $divide: ["$imp",   "$L.LeaguePricedImpact"] } },
         spendShare: { $sum: { $divide: ["$spend", "$L.LeagueSpendCr"] } },
         spendCr:    { $sum: "$spend" } } },
     { $project: { spendCr: 1, valueIndex: { $divide: ["$impShare", "$spendShare"] } } },
     { $sort: { valueIndex: -1 } },
   ];
   ```
   `FairValueCr` and `OverpayCr` are additive, so you can sum them directly. For one team-season, use `team_seasons.ValueIndex` as it is.
3. **Rankings only include `Matches >= 5`:** top steals, most overpaid, Bargain/Overpaid XI. Without this filter, players who barely played float to the top.
4. **Rank "overpaid" by `OverpayCr` (crores lost), not by lowest Value Index.** Value Index is a ratio, so ₹30-lakh players produce extreme values.
5. **Formatting:** money as `₹19.5 Cr`; under ₹1 Cr you can show lakh (`₹30 L`). Value Index to 2 decimals (`1.63×`). Win % as a percentage.

### Test values: your API should return these

| Query | Expected |
| --- | --- |
| `seasons` 2026 | `PlayersBought` 77, `AuctionSpendCr` 215.45 |
| Top steal 2026 (`Matches ≥ 5`, by `ValueIndex`) | Kartik Tyagi (KKR, ₹0.3 Cr), 33.95 |
| Most overpaid 2026 (`Matches ≥ 5`, by `OverpayCr`) | Rishabh Pant 19.55 · Shreyas Iyer 15.80 · Cameron Green 14.20 |
| 2026 quadrant counts (priced) | Star 57 · Steal 24 · Overpaid 8 · Passenger 6 · Too few matches 76 |
| `team_seasons` 2026 | RR 1.63 on ₹34.3 Cr (best) · PBKS 0.72 on ₹108.1 Cr (worst) |
| Value Index by team, all seasons | CSK 1.19 · RR 1.14 · DC 0.85 |
| Value Index by bracket, all seasons | Base price buy 4.11 · Under 2 Cr 1.93 · 2 to 5 Cr 1.01 · 5 to 10 Cr 0.67 · 10 Cr and above 0.49 |
| Value Index by nationality | All seasons: Indian 1.10, Overseas 0.90 · 2026: Indian 1.11, Overseas 0.88 |
| Correlation over 123 team-seasons | `SpendCr` vs `WinPct` −0.03 · `ValueIndex` vs `WinPct` +0.35 |
| V Kohli 2016 | 973 runs, 1,187 Impact Points, `Unpriced` |

## 7. Match the look

The web app should look like the dashboard (see the screenshots): a warm off-white canvas with a soft yellow glow, white rounded cards (radius ≈ 22px), a pill navigation bar with the active page as a dark pill, big KPI numbers, and the page's "So what" in a dark panel. Bars are yellow with dark pill labels.

```css
:root {
  --canvas: #F6F4EF; --card: #FFFFFF; --card-alt: #FAF8F3; --line: #ECE8DF;
  --ink: #1A1A1A; --muted: #6E6A62; --faint: #A8A396; --dark: #262626;
  --yellow: #F2C94C; --yellow-soft: #F7E3A1;
  /* fixed meaning on every page */
  --steal: #3BA55C; --star: #F2C94C; --overpaid: #E5484D; --passenger: #A3A3A3;
  --too-few: #D6D3CC; --unpriced: #C9C5BC;
}
```

Team colours are in `teams.TeamColour`; use them only on franchise views. Font: Segoe UI (or Inter as a web fallback). The Power BI theme file is `powerbi/deliverables/IPL_Auction_Light_theme.json`, and the background image is `powerbi/scripts/assets/bg_canvas.png`.

## 8. Working in the same repo

- Work on a branch (for example `web/setup`) and open PRs into `main`.
- Stay inside `web/` for app code. `data/processed/` is generated: if a number looks wrong, flag it rather than editing the CSV or JSON by hand, so it can be fixed in the model and re-exported (see [`data/README.md`](data/README.md#regenerating-processed)).
- Don't hand-edit files in `powerbi/IPL_Auction_Value.*`. They are generated by `powerbi/scripts/` and by Power BI Desktop.

## 9. Known limitations (worth knowing for the demo)

- Retained players have no auction price, so they are `Unpriced` and left out of value metrics.
- 2013 prices are converted at a single ₹54/$ rate.
- Base prices exist only for 2025–26. Earlier "base price buys" are buys at that era's minimum price.
- 66 auction buys (1% of spend, mostly players who never played) could not be matched to Cricsheet. They have synthetic `A_…` player IDs.
- Impact Points weights are a judgement call (fantasy-style). The same players top the runs-only and wickets-only views, so the conclusions hold.
