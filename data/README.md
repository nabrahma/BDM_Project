# Data

Two layers:

- **`raw/`**: the original source files, unchanged except for two hand-made mapping files. The Power BI model rebuilds everything from this folder through its `DataFolder` parameter.
- **`processed/`**: the finished tables exported from the Power BI model. They are clean and joined, and the value metrics are already calculated. Every table comes as both `.csv` and `.json` (an array of records, ready for `mongoimport --jsonArray`). **The web app should read these instead of re-deriving anything from `raw/`.**

Money is always in **₹ crore** (`…Cr` columns): 1 Cr = 100 lakh = ₹10,000,000. 2013 auction prices were in US$ and are converted at ₹54 per $.

## processed/

| File | Grain | Rows | Key |
| --- | --- | --- | --- |
| `players` | one player | 778 | `PlayerID` |
| `teams` | one franchise (incl. defunct PWI, RPS, GL) | 13 | `TeamKey` |
| `seasons` | one IPL season, 2013–2026 | 14 | `Season` |
| `team_seasons` | franchise × season | 123 | `TeamSeasonKey` (`"CSK\|2026"`) |
| `player_seasons` | player × season × team: **the main fact table** | 2,910 | `PlayerSeasonKey` (`"2026\|30f92334\|CSK"`) |
| `auction_buys` | one auction purchase | 1,380 | `AuctionKey` |
| `team_matches` | team × match (2 rows per match) | 1,842 | `TeamMatchKey` |
| `unsold_players` | player unsold at the 2026 auction | 79 | `Season` + `Player` |

Relationships: `PlayerID` → players, `TeamKey` → teams, `Season` → seasons, `TeamSeasonKey` → team_seasons.

### player_seasons

| Column | Meaning |
| --- | --- |
| `PlayerID`, `PlayerName`, `Season`, `TeamKey`, `TeamSeasonKey` | Who, when, for whom. `PlayerName` is the display name. |
| `Role`, `Nationality` | `Batter` / `Bowler` / `All-Rounder` / `Wicket-Keeper` / `Unknown`; `Indian` / `Overseas` / `Unknown` |
| `Matches` | Playing-XI appearances that season (0 = bought but did not play) |
| `Runs`, `BallsFaced`, `Fours`, `Sixes`, `Outs` | Batting. `BallsFaced` excludes wides |
| `Wickets`, `LegalBalls`, `RunsConceded`, `DotBalls` | Bowling. `RunsConceded` excludes byes and leg-byes; `Wickets` excludes run-outs |
| `Catches`, `Stumpings`, `RunOuts` | Fielding (`RunOuts` = run-out involvements) |
| `ImpactPoints` | One output score: `Runs + Fours + 2×Sixes + 25×Wickets + DotBalls + 8×Catches + 12×Stumpings + 6×RunOuts` |
| `PriceSource` | `Auction` = this season is covered by an auction price; `Unpriced` = retained or traded player with no auction price (excluded from value metrics) |
| `AuctionSeason`, `PriceCr`, `BasePriceCr` | Which auction set the price, and the price. A price covers later seasons until the next mega auction or the player's next auction, and only while he still plays for that team |
| `PriceBracket`, `PriceBracketOrder` | `Base price buy` (1), `Under 2 Cr` (2), `2 to 5 Cr` (3), `5 to 10 Cr` (4), `10 Cr and above` (5), `Unpriced` (9) |
| `SeasonMedianPriceCr`, `SeasonMedianImpact` | Medians of priced players that season, used for the quadrant |
| `ValueQuadrant` | `Star` (price ≥ median, impact ≥ median), `Steal` (cheap, high impact), `Overpaid` (dear, low impact), `Passenger` (cheap, low impact), `Too few matches` (< 5 matches), `Unpriced` |
| `FairValueCr` | What the output would have cost at that season's league price per Impact Point |
| `OverpayCr` | `PriceCr − FairValueCr`: positive = overpaid, negative = bargain |
| `ValueIndex` | (share of the league's priced Impact Points) ÷ (share of the league's auction spend) in that season. 1.00 = fair value, > 1 = more output than the money suggests. Empty when `Unpriced` |

### team_seasons

`Played`, `Results` (played − no results), `Wins`, `WinPct` (= Wins ÷ Results), `SpendCr` (priced players that season), `PricedPlayers`, `ImpactPoints` (all players), `PricedImpact` (priced players only), `FairValueCr`, `OverpayCr`, `ValueIndex`, `TeamColour`.

### seasons

`IsMegaAuction` (2014, 2018, 2022, 2025), `AuctionType`, `Matches`, `PlayersBought`, `AuctionSpendCr`, `AvgPriceCr`, `MedianPriceCr`, `TopBuyPlayer` / `TopBuyPriceCr`, `TopRunScorer` / `TopRunScorerRuns` (Orange Cap), `TopWicketTaker` / `TopWicketTakerWickets` (Purple Cap), `LeagueSpendCr`, `LeaguePricedImpact`, `LakhPerPoint` (the league price of one Impact Point, in lakh), `LeagueValueIndex` (always 1).

### players

`PlayerID` (Cricsheet ID; auction buys that never matched a Cricsheet player get a synthetic `A_<name>` ID and `HasCricsheetID = false`), `PlayerName`, `CricsheetName`, `Role`, `RoleSource`, `Nationality`, `LatestTeamKey`, `FirstSeason` / `LastSeason` (played), `EverAuctioned`. Career totals: `SeasonsPlayed`, `CareerMatches`, `CareerRuns`, `CareerWickets`, `CareerCatches`, `CareerImpactPoints`, `AuctionBuys`, `TotalAuctionSpendCr` (sum of auction prices), `CareerSpendCr` (price carried over all covered seasons), `CareerFairValueCr`, `CareerOverpayCr`, `CareerValueIndex`.

### auction_buys

`AuctionKey`, `PlayerID`, `PlayerName`, `AuctionName` (name as written in the auction file), `TeamKey`, `Season`, `AuctionRole`, `Capped`, `BasePriceCr` (2025–26 only), `PriceCr`, `PriceBracket`, `PriceBracketOrder`, `MatchPass` (how the name was matched to Cricsheet: `Exact`, `Manual`, `Initials`, `Exact (register)`, `Surname`, `Unmatched`), `IsMatched`.

### team_matches, teams, unsold_players

- **team_matches:** `MatchID` (Cricsheet match ID = file name in `raw/cricsheet_ipl_json/`), `MatchDate`, `Venue`, `TeamKey`, `Season`, `Won` (1/0), `NoResult` (1/0).
- **teams:** `TeamKey`, `TeamName` (current name), `ShortCode`, `TeamColour` (hex), `IsActive`.
- **unsold_players:** `Player`, `BasePriceCr`, `CareerMatches`, `CareerImpact`, `LastIplSeason`.

## Combining Value Index over several rows

**Never average `ValueIndex` values.** Sum the shares season by season, then divide. With `L` taken from `seasons` (`LeaguePricedImpact`, `LeagueSpendCr`):

```
ValueIndex(group) = Σ_season ( ImpactPoints_group,season / LeaguePricedImpact_season )
                  ÷ Σ_season ( PriceCr_group,season     / LeagueSpendCr_season )
```

Use only rows with `PriceSource = "Auction"`. Inside a single season this is just `ΣFairValueCr ÷ ΣPriceCr`. `FairValueCr` and `OverpayCr` can be summed freely. This formula is how the dashboard computes franchise, role, nationality and bracket values, and it reproduces every number in the report (for example, base-price buys 4.11 and ₹10 Cr+ buys 0.49 over 2013–2026).

Rankings in the dashboard (top steals, most overpaid, Bargain XI) only include player-seasons with **`Matches ≥ 5`**.

## raw/

| Path | Source | Notes |
| --- | --- | --- |
| `auction/ipl_auction_2013.csv` … `2026.csv` | Kaggle, *IPL Auction Dataset 2013–2026* (sunnyyadav754) | Headers and price formats differ by year |
| `cricsheet_ipl_json/*.json` | [Cricsheet](https://cricsheet.org/downloads/) IPL, Oct 2026 release (ODbL) | 1,243 matches (2008–2026; 921 used for 2013–2026). Format: <https://cricsheet.org/format/json/> |
| `register/people.csv`, `names.csv` | Cricsheet Register (ODbL) | Player IDs and name variants, used for name matching |
| `mappings/team_map.csv` | Hand-made | Franchise names over the years → `TeamKey`, plus colours |
| `mappings/name_fixes.csv` | Hand-made | 96 checked auction-name → Cricsheet-ID matches, with optional display names |
| `supplementary/auction_origin_2013_2022.csv` | Kaggle, *IPL Player Auction Dataset 2013–2022* (kalilurrahman) | Fills in role and Indian/Overseas |
| `supplementary/auction_list_2025.csv` | Official TATA IPL 2025 auction list | Roles and base prices for 2025 |
| `supplementary/unsold_2026.csv` | Wisden | 79 unsold players at the 2026 auction |
| `supplementary/team_purse_2013_2024.csv` | Kaggle | Remaining purse per team; not used in the model |

## Regenerating processed/

Open `powerbi/IPL_Auction_Value.pbip` in Power BI Desktop and **Refresh** if `raw/` changed. Then, from `powerbi/`:

```bash
powershell -File scripts/export_processed.ps1                              # model → data/processed/*.csv
../.venv/Scripts/python -I scripts/processed_to_json.py ../data/processed  # csv → json
```
