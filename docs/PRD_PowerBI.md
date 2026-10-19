# PRD: IPL Auction Value Intelligence (Power BI)

Oct 19, 2026 · @Nabaskar

## 1. Summary and goals

A Power BI report that scores every IPL auction buy from the 2013 to 2026 seasons on on-field output per crore, then rolls that up to franchises, roles and seasons. It is the Power BI half of the BDM project *IPL Auction Valuation & Player Performance Intelligence*; the MERN app is built separately.

**Business questions the report must answer**

1. Which franchise gets the most on-field impact per crore spent?
2. Which players were the best bargains and the worst buys in each season?
3. Do franchises that spend efficiently actually win more matches?
4. Are batters, bowlers, all-rounders or keepers over- or under-priced? Do overseas players earn their premium?
5. How much have auction prices inflated since 2013, and does a high price predict high output?
6. How often do base-price and uncapped buys outperform expensive marquee signings?

**Success criteria**

- Each of the 6 questions is answered on a named page, reachable within 2 clicks from the home page.
- Every headline number passes the QA checks in section 9.
- The full story can be demoed in under 8 minutes.
- A teammate can refresh the report from the raw CSVs without editing any query by hand.

## 2. Scope and audience

**Audience:** the BDM course faculty and class during a live demo. The framing is a franchise analytics team advising an owner before the next auction, so every page ends in a decision, not just a chart.

| In scope (v1) | Out of scope |
| --- | --- |
| Auction buys from 2013 to 2026 seasons | Seasons 2008 to 2012 (no auction price data) |
| Batting, bowling and fielding output from ball-by-ball data | Player retention fees (data incomplete; see section 12) |
| Franchise spend efficiency and win rate | Women's Premier League |
| Role, nationality and price-bracket analysis | Machine learning price prediction |
| Player drill-through profile | Live data refresh from the web |
| Static PDF export of every page | Mobile layout (desktop canvas only) |

**Tools:** Power BI Desktop (free, Windows), Power Query for preparation, DAX for measures. No Python or SQL is required.

## 3. Data sources

Four files feed the report. Full descriptions and alternates are in the [IPL Data Kit](https://claude.ai/code/artifact/79d77414-7fb5-4411-83f8-4f3d9f4c1c20).

| Source | File(s) | Grain | Used for |
| --- | --- | --- | --- |
| [IPL Auction Dataset (2013-2026)](https://www.kaggle.com/datasets/sunnyyadav754/ipl-auction-dataset-20132026) | One CSV per auction year | One row per player per auction | Price paid, team, role, nationality |
| [IPL Ball By Ball Dataset (2008-2026)](https://baselight.app/u/kaggle/dataset/lyc0riz_ipl_ball_by_ball_dataset_2008_2026) | One flat CSV | One row per ball | Runs, wickets, catches, matches, results |
| [Cricsheet Register](https://cricsheet.org/register) | people.csv, names.csv | One row per person / name variant | Joining auction names to ball-by-ball names |
| Hand-made mapping files | team\_map.csv, name\_fixes.csv | One row per raw name | Team renames and names the register misses |

Fallback: if the ball-by-ball file has gaps, use the [IPL Complete Dataset (2008-2024)](https://www.kaggle.com/datasets/patrickb1912/ipl-complete-dataset-20082020) for 2013 to 2024 and treat 2025 to 2026 as a stretch.

Store all raw files in one folder (`/data/raw`) and point every query at a single `DataFolder` parameter, so the report refreshes on any laptop.

## 4. Data preparation (Power Query)

All cleaning happens in Power Query, so a refresh rebuilds everything. Staging queries (prefix `stg_`) have **Enable load** turned off; only the final model tables load.

1. **Parameter `DataFolder`**: text path to `/data/raw`. Every source step reads from it.
2. **stg\_Auction**: combine every yearly auction CSV.
   - Use *Folder* source, filter to `ipl_auction_*.csv`, and apply one custom function per file that renames that year's columns to a standard set: `Player`, `Team`, `Role`, `Nationality`, `BasePrice`, `SoldPrice`, `Status`.
   - Add `AuctionSeason` from the file name (`ipl_auction_2019.csv` → 2019). Verify this is the season, not the calendar year: the 2026 file should contain Cameron Green to KKR at 25.20 Cr.
   - Convert every price to crores (`PriceCr`): lakhs ÷ 100, rupees ÷ 10,000,000, strip "Rs", "₹", "Cr", "Lakh" and commas first.
   - Keep only sold rows. Unsold rows go to a separate `stg_Unsold` query for one insight card.
3. **stg\_Deliveries**: load the ball-by-ball CSV.
   - Keep only the columns needed: match id, season, date, venue, batting team, bowling team, batter, bowler, non-striker, batter runs, extras type, total runs, is wicket, dismissal kind, player dismissed, fielder, winner.
   - Set data types, then filter `Season >= 2013`.
4. **Team mapping**: merge both auction and delivery team names with `team_map.csv` (below) and replace them with `TeamKey`. Do this before any grouping.
5. **stg\_Batting**: group deliveries by Season, batter, TeamKey: runs, balls faced (exclude wides), fours, sixes, times out.
6. **stg\_Bowling**: group by Season, bowler, bowling TeamKey: legal balls (exclude wides and no-balls), runs conceded (exclude byes and leg-byes), dot balls, wickets credited to the bowler (exclude run out, retired hurt, retired out, obstructing the field).
7. **stg\_Fielding**: catches (dismissal kind caught, or caught and bowled credited to the bowler), stumpings, run-out involvements, grouped by Season, fielder, TeamKey.
8. **stg\_PlayerSeasonStats**: full outer join of steps 5 to 7 on Season + player + TeamKey; replace nulls with 0. Add `Matches` = distinct match ids in which the player batted, bowled or took a dismissal.
9. **Name matching** (auction name → Cricsheet name):
   - Pass 1, exact: build an initials key from the auction name ("Virat Kohli" → "V Kohli") and merge with the Cricsheet register name.
   - Pass 2, scoped fuzzy merge: for leftovers, compare only against players who appeared for the same TeamKey in the same season, using Power Query fuzzy matching at a similarity of about 0.8.
   - Pass 3, manual: anything still unmatched goes into `name_fixes.csv` by hand. Target: at least 95% of auction spend matched.
10. **stg\_Contracts**: turn each auction buy into the seasons it covers. `ContractEnd` = the earliest of (the player's next auction season − 1, the next mega-auction season − 1, 2026). Mega-auction seasons in the window: 2014, 2018, 2022, 2025. Expand each row into one row per season with `List.Numbers`.
11. **FactPlayerSeason**: merge stg\_PlayerSeasonStats with stg\_Contracts on PlayerID + Season + TeamKey to attach `PriceCr` and `PriceSource` ("Auction" or "Unpriced"). Unpriced rows (retained, traded, replacements) stay in the table but are excluded from value measures.
12. **FactTeamMatch**: one row per team per match (unpivot team 1 and team 2) with `Won` = 1 or 0 and `NoResult` flag.
13. **Dimensions**: DimPlayer, DimTeam, DimSeason, built as described in section 5.

`team_map.csv` (extend it with any spelling the files use):

```csv
RawName,TeamKey,TeamName
Chennai Super Kings,CSK,Chennai Super Kings
CSK,CSK,Chennai Super Kings
Delhi Daredevils,DC,Delhi Capitals
Delhi Capitals,DC,Delhi Capitals
Kings XI Punjab,PBKS,Punjab Kings
Punjab Kings,PBKS,Punjab Kings
Royal Challengers Bangalore,RCB,Royal Challengers Bengaluru
Royal Challengers Bengaluru,RCB,Royal Challengers Bengaluru
Kolkata Knight Riders,KKR,Kolkata Knight Riders
Mumbai Indians,MI,Mumbai Indians
Rajasthan Royals,RR,Rajasthan Royals
Sunrisers Hyderabad,SRH,Sunrisers Hyderabad
Gujarat Titans,GT,Gujarat Titans
Lucknow Super Giants,LSG,Lucknow Super Giants
Pune Warriors,PWI,Pune Warriors India
Rising Pune Supergiant,RPS,Rising Pune Supergiant
Rising Pune Supergiants,RPS,Rising Pune Supergiant
Gujarat Lions,GL,Gujarat Lions
```

## 5. Data model

A star schema with one central fact, FactPlayerSeason, where price meets performance. Every relationship is one-to-many, single direction, from a dimension to a fact. Facts never join each other directly.

&#91;embedded content: star schema · 3 dimensions, 3 facts\]

DimPlayer connects only to the two player facts; team and season filter all three facts, so one Season slicer drives every page.

| Table | Grain | Key columns | Built from |
| --- | --- | --- | --- |
| DimPlayer | One row per matched player | PlayerID (Cricsheet ID), PlayerName, Role, Nationality, LatestTeamKey | Register + latest auction row |
| DimTeam | One row per franchise | TeamKey, TeamName, ShortCode, TeamColour, IsActive | team\_map.csv |
| DimSeason | One row per season, 2013 to 2026 | Season, SeasonLabel, IsMegaAuction | Generated list |
| FactAuction | One row per auction buy | PlayerID, TeamKey, Season, BasePriceCr, PriceCr, PriceBracket | stg\_Auction |
| FactPlayerSeason | One row per player × season × team | PlayerID, TeamKey, Season, Matches, Runs, BallsFaced, Fours, Sixes, Wickets, LegalBalls, RunsConceded, DotBalls, Catches, Stumpings, RunOuts, ImpactPoints, PriceCr, BasePriceCr, PriceBracket, PriceSource, Value Quadrant | Stats + contracts (section 4, steps 8 to 11) |
| FactTeamMatch | One row per team per match | MatchID, TeamKey, Season, MatchDate, Venue, Won, NoResult | stg\_Deliveries |

Model hygiene: hide every key column and staging table from report view, sort SeasonLabel by Season, and set the summarisation of ID and Season columns to *Don't summarize*.

## 6. Value metric and DAX measures

Value is measured as **Impact Points per crore**. Impact Points is a simple fantasy-style score that puts batting, bowling and fielding on one scale, so a bowler and a batter can be compared on the same chart.

| Action | Points |
| --- | --- |
| Run scored | 1 |
| Four (bonus) | 1 |
| Six (bonus) | 2 |
| Wicket (credited to bowler) | 25 |
| Dot ball bowled | 1 |
| Catch | 8 |
| Stumping | 12 |
| Run-out involvement | 6 |

Add `ImpactPoints` as a column in Power Query (step 11), so the formula lives in one place. State the weights on the Methodology page; examiners will ask.

**Core measures**

```dax
Spend Cr = SUM ( FactPlayerSeason[PriceCr] )

Impact Points = SUM ( FactPlayerSeason[ImpactPoints] )

Priced Impact =
CALCULATE ( [Impact Points], FactPlayerSeason[PriceSource] = "Auction" )

Lakh per Point = DIVIDE ( [Spend Cr] * 100, [Priced Impact] )

League Spend =
CALCULATE ( [Spend Cr], REMOVEFILTERS ( DimPlayer ), REMOVEFILTERS ( DimTeam ) )

League Priced Impact =
CALCULATE ( [Priced Impact], REMOVEFILTERS ( DimPlayer ), REMOVEFILTERS ( DimTeam ) )

Value Index =
DIVIDE (
    DIVIDE ( [Priced Impact], [League Priced Impact] ),
    DIVIDE ( [Spend Cr], [League Spend] )
)
```

Value Index reads simply: 1.0 = fair value, above 1 = more output than the money suggests, below 1 = overpaid. Season stays filtered, so each player or team is judged against that season's market.

**Performance and team measures**

```dax
Runs = SUM ( FactPlayerSeason[Runs] )
Wickets = SUM ( FactPlayerSeason[Wickets] )
Strike Rate = DIVIDE ( [Runs], SUM ( FactPlayerSeason[BallsFaced] ) ) * 100
Economy = DIVIDE ( SUM ( FactPlayerSeason[RunsConceded] ), SUM ( FactPlayerSeason[LegalBalls] ) / 6 )

Team Wins = SUM ( FactTeamMatch[Won] )
Team Results = COUNTROWS ( FactTeamMatch ) - SUM ( FactTeamMatch[NoResult] )
Win % = DIVIDE ( [Team Wins], [Team Results] )

Avg Auction Price Cr = AVERAGE ( FactAuction[PriceCr] )
Top Buy Price Cr = MAX ( FactAuction[PriceCr] )
Auction Premium % = DIVIDE ( SUM ( FactAuction[PriceCr] ) - SUM ( FactAuction[BasePriceCr] ), SUM ( FactAuction[BasePriceCr] ) )
```

**Value quadrant** (calculated column on FactPlayerSeason, compares each player to the median of the same season):

```dax
Value Quadrant =
VAR medPrice =
    CALCULATE ( MEDIAN ( FactPlayerSeason[PriceCr] ),
        ALLEXCEPT ( FactPlayerSeason, FactPlayerSeason[Season] ),
        FactPlayerSeason[PriceSource] = "Auction" )
VAR medImpact =
    CALCULATE ( MEDIAN ( FactPlayerSeason[ImpactPoints] ),
        ALLEXCEPT ( FactPlayerSeason, FactPlayerSeason[Season] ),
        FactPlayerSeason[PriceSource] = "Auction" )
VAR p = FactPlayerSeason[PriceCr]
VAR i = FactPlayerSeason[ImpactPoints]
RETURN
    SWITCH ( TRUE (),
        FactPlayerSeason[PriceSource] <> "Auction", "Unpriced",
        FactPlayerSeason[Matches] < 5, "Too few matches",
        p >= medPrice && i >= medImpact, "Star",
        p <  medPrice && i >= medImpact, "Steal",
        p >= medPrice && i <  medImpact, "Overpaid",
        "Passenger" )
```

Keep all measures in one `_Measures` table, grouped into display folders: Money, Performance, Value, Team.

## 7. Report pages

Nine pages. Each answers one question from section 1 and ends with a one-line "So what" text box stating the decision it supports.

| # | Page | Answers | Key visuals |
| --- | --- | --- | --- |
| 0 | Home | Navigation | 4 KPI cards, page buttons |
| 1 | Auction Market | Q5 | Price inflation line, spend by season, top buys |
| 2 | Franchise Efficiency | Q1, Q3 | Value Index by team, spend vs win % scatter |
| 3 | Player Value Map | Q2 | Price vs impact quadrant scatter |
| 4 | Steals and Overpaid | Q2 | Top 10 tables, Bargain XI, Overpaid XI |
| 5 | Role and Nationality | Q4 | Price and value by role, overseas premium |
| 6 | Price Brackets | Q6 | Value Index by price bracket |
| 7 | Player Profile | Drill-through | Career price vs impact by season |
| 8 | Methodology | Credibility | Sources, weights, assumptions, limits |

### Page 0: Home

- Title, project name, team names.
- KPI cards: total auction spend 2013 to 2026 (Cr), players bought, average auction price, % of spend matched to performance data.
- Image buttons to pages 1 to 6 and 8.

### Page 1: Auction Market

- **Line chart:** Avg Auction Price Cr by season, with mega-auction seasons marked (constant lines or a separate marker series).
- **Column chart:** total spend by season, stacked by role.
- **Table:** most expensive buy each season (player, team, price).
- **Card:** Auction Premium % (how far above base price teams bid on average).
- So what: how much more a team must budget for the same player today than in 2013.

### Page 2: Franchise Efficiency

- **Bar chart:** Value Index by team, sorted, with a constant line at 1.0.
- **Scatter:** one dot per team-season, x = Spend Cr, y = Win %, size = Priced Impact. Shows whether money buys wins.
- **Matrix:** team rows × season columns, Lakh per Point with conditional formatting (green = cheap output).
- Slicers: season range, team.
- So what: which franchises run the smartest auction strategy, and whether spending more correlates with winning.

### Page 3: Player Value Map

- **Scatter (hero visual):** one dot per player-season, x = PriceCr, y = ImpactPoints, colour = Value Quadrant, with median reference lines from the Analytics pane.
- Tooltip: player, team, role, matches, runs, wickets, Value Index.
- Slicers: season (single select by default), team, role, nationality.
- Right-click any dot → drill through to Player Profile.
- So what: who to keep, who to release before the next auction.

### Page 4: Steals and Overpaid

- **Two tables:** top 10 by Value Index (Steals) and bottom 10 (Overpaid), minimum 5 matches, with price, impact and Lakh per Point.
- **Bargain XI / Overpaid XI:** two styled tables of 11 names chosen by the measure (top N per role: 4 batters, 1 keeper, 2 all-rounders, 4 bowlers).
- **Card:** notable unsold players from `stg_Unsold` for the latest auction.
- So what: the presentation's crowd-pleaser. Open the demo here.

### Page 5: Role and Nationality

- **Clustered bar:** Avg Auction Price by role, split Indian vs overseas.
- **Clustered bar:** Value Index by role, same split.
- **Matrix:** role × nationality, Lakh per Point.
- So what: whether all-rounders and overseas stars justify their premium.

### Page 6: Price Brackets

- Add a `PriceBracket` column: Base price buy, under 2 Cr, 2 to 5 Cr, 5 to 10 Cr, 10 Cr and above.
- **Column chart:** Value Index by bracket.
- **100% stacked bar:** Value Quadrant mix within each bracket.
- So what: whether cheap buys outperform marquee signings per crore.

### Page 7: Player Profile (drill-through)

- Drill-through field: DimPlayer\[PlayerName\]. Hidden from navigation, with a back button.
- Header cards: name, role, nationality, teams played for, career Value Index.
- **Combo chart:** columns = PriceCr by season, line = ImpactPoints by season.
- **Table:** season-by-season runs, strike rate, wickets, economy, catches, quadrant.

### Page 8: Methodology

- Data sources with links, the Impact Points weight table, the contract carry-forward rule, the analysis window, and the limitations from section 12.

## 8. Design and UX

- **Canvas:** 16:9, 1280 × 720. Same grid on every page: title bar at top, slicer strip on the left, visuals in a 2 × 2 or 1 + 2 layout.
- **Theme:** dark navy background with one gold accent for the "hero" number on each page. Save it as a JSON theme file so every visual inherits fonts and colours.
- **Colour meaning (fixed across pages):** green = Steal / good value, gold = Star, red = Overpaid, grey = Passenger or Unpriced. Team colours only on Page 2, stored as a `TeamColour` hex column in DimTeam.
- **Text:** page titles state the finding, not the topic ("Base-price buys return more per crore", not "Price Brackets"). Update them once the numbers are final.
- **Navigation:** page buttons on Home, a home icon on every page, a back button on the drill-through page.
- **Tooltips:** one custom tooltip page (small canvas) showing a player's photo-free card: role, team, price, impact, quadrant. Reused on pages 3, 4 and 7.
- **Slicers:** sync the Season slicer across pages 2 to 6 with the Sync slicers pane. Default to the latest complete season.
- **Number formats:** money in crores with one decimal ("₹25.2 Cr"), Lakh per Point with one decimal, Value Index with two decimals, percentages with no decimals.
- **Accessibility:** alt text on every visual, never rely on colour alone (quadrant name also in the tooltip and legend).

## 9. QA and validation

Run every check before the demo. Build a hidden **QA** page with a card or table for each, so the checks re-run on every refresh.

**Data checks**

- [ ] Match count per season is 74 from 2022 onward (10 teams), minus abandoned games; earlier seasons match the official schedule.
- [ ] Orange Cap runs and Purple Cap wickets for 3 sample seasons match the official IPL site.
- [ ] The 2026 auction shows 77 players sold for about ₹215 Cr in total ([Navbharat Live](https://navbharatlive.com/sports/cricket/ipl-2026-check-full-list-of-sold-players-at-mini-auction-1469269.html)).
- [ ] The highest single price in FactAuction is Rishabh Pant at ₹27 Cr (2025). Anything higher means a unit-conversion bug.
- [ ] No prices are null, zero or negative among sold rows.
- [ ] Only the expected TeamKeys appear (CSK, DC, PBKS, RCB, KKR, MI, RR, SRH, GT, LSG, PWI, RPS, GL).
- [ ] At least 95% of auction spend (in Cr) is matched to a Cricsheet player. Show the % on the QA page.
- [ ] Each auction buy produces contract rows only up to the season before the next mega auction.

**Measure checks**

- [ ] Value Index for the whole league in any single season equals 1.00 (true by construction; anything else means a filter leak).
- [ ] Spot-check 3 players by hand: Impact Points from raw deliveries equals the report value.
- [ ] Win % across all teams in a season averages about 50%.

**Report checks**

- [ ] Every page title states a finding, and every page has its "So what" line.
- [ ] Drill-through to Player Profile works from pages 3 and 4; the back button returns.
- [ ] Season slicer syncs across pages 2 to 6.
- [ ] Full refresh works on a teammate's laptop after only changing the `DataFolder` parameter.

## 10. Build plan

Seven phases in order. Each phase ends with something you can show. Name matching (phase 3) is the riskiest, so do it early.

1. **Setup:** download all files into `/data/raw`, install Power BI Desktop, create the `.pbix` with the `DataFolder` parameter. *Output: empty report that loads the raw files.*
2. **Clean and shape:** queries for auction, deliveries, team mapping, and the batting, bowling and fielding stats (section 4, steps 2 to 8). *Output: stg\_PlayerSeasonStats with sensible totals.*
3. **Name matching:** the three-pass match plus `name_fixes.csv`. *Output: QA card showing ≥ 95% of spend matched.*
4. **Contracts and facts:** stg\_Contracts, FactPlayerSeason, FactAuction, FactTeamMatch, dimensions and relationships. *Output: the model view matches section 5.*
5. **Measures:** all DAX from section 6 in `_Measures`, plus the QA page. *Output: every QA check in section 9 passes.*
6. **Pages:** build pages 3 and 4 first (the story), then 2, 1, 5, 6, 7, then Home and Methodology. Apply the theme. *Output: full report draft.*
7. **Polish and rehearse:** finding-style titles, "So what" lines, tooltips, PDF export, an 8-minute demo run-through. *Output: submission package (section 11).*

## 11. Deliverables

- [ ] `IPL_Auction_Value.pbix`, refreshing cleanly from `/data/raw`
- [ ] `/data/raw` folder (or download links if files are too large to submit) plus `team_map.csv` and `name_fixes.csv`
- [ ] PDF export of all pages (File → Export → PDF), as a backup if the demo laptop fails
- [ ] Theme JSON file
- [ ] Short project report: problem, data sources, preparation steps, model diagram, Impact Points method, key findings with screenshots, limitations
- [ ] Slides or a demo script for the 8-minute presentation, opening on Page 4
- [ ] Published link, only if the college Power BI account allows publishing; otherwise the `.pbix` and PDF are enough

## 12. Risks and open questions

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Auction names don't match ball-by-ball names | Players missing, value understated | Three-pass matching, scoped to same team and season; manual fixes file; show match % on QA page |
| Retained players have no auction price | Star players like long-time retainees missing from value analysis | Label them "Unpriced", exclude from value measures, state it on Methodology; optional v2: add retention prices by hand for the top 20 |
| Auction file columns differ by year | Combine step breaks | One rename function per file before combining |
| Prices in mixed units | Wildly wrong values | Convert to crores in one step; QA check on max price |
| Impact Points weights look arbitrary | Examiner pushback | Show the weight table, explain it is fantasy-style, and show results hold for runs-only and wickets-only views |
| Injured players count as "Overpaid" | Unfair labels | Minimum 5 matches rule; "Too few matches" category |
| Traded players attach price to the wrong team | Small mismatches | Price joins on team as well as player; unmatched rows become Unpriced |

**Open questions**

- Submission deadline and demo length? The build plan has no dates until this is known.
- Does the course want a published link, or is the `.pbix` file enough?
- Should the MERN app and the dashboard share the same name-matched player IDs? If yes, export `DimPlayer` as CSV for your teammate.
- Should 2026 count as a complete season in every page, or be shown separately?
