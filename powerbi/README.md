# IPL Auction Value Intelligence (Power BI)

Power BI half of the BDM project *IPL Auction Valuation & Player Performance Intelligence*. It scores every IPL auction buy from 2013 to 2026 on on-field output per crore, then rolls that up to franchises, roles, nationalities, price brackets and seasons. The full spec is in [docs/PRD_PowerBI.md](../docs/PRD_PowerBI.md). Paths below are relative to this `powerbi/` folder; the dataset lives one level up in the shared [`data/`](../data/) folder.

## Open and refresh

1. Install Power BI Desktop (free; Microsoft Store version is fine).
2. Open `powerbi/IPL_Auction_Value.pbip` (it opens with the data already loaded from the committed cache, `.pbi/cache.abf`). To get a single shareable file: **File → Save as → Browse this device → Save as type: Power BI file (*.pbix)**.
3. **Home → Transform data → Edit parameters → `DataFolder`**: set it to the full path of the repo's `data\raw\` folder on your laptop, ending with a backslash (it is saved as `D:\For coding\BDM Project\data\raw\`). Nothing else needs editing.
4. **Home → Refresh**. A full rebuild from the raw files takes about 10 minutes on a laptop, because Power Query parses 1,243 match JSON files.

## What is in the folder

| Path | What it is |
| --- | --- |
| `IPL_Auction_Value.pbip` | Power BI project: open this in Desktop |
| `IPL_Auction_Value.SemanticModel/` | Model as TMDL: Power Query (M) staging queries, tables, relationships, DAX measures |
| `IPL_Auction_Value.Report/` | Report as PBIR: Home + 8 pages, a hidden drill-through Player Profile, a player tooltip page and a hidden QA page; light theme and background image |
| `../data/raw/auction/` | One auction CSV per season, `ipl_auction_2013.csv` … `ipl_auction_2026.csv` (Kaggle, sunnyyadav754) |
| `../data/raw/cricsheet_ipl_json/` | Cricsheet IPL ball-by-ball JSON, one file per match (fielders and playing XIs included) |
| `../data/raw/register/` | Cricsheet Register `people.csv`, `names.csv`, used for name matching |
| `../data/raw/mappings/team_map.csv` | Franchise renames → TeamKey, plus team colours |
| `../data/raw/mappings/name_fixes.csv` | 96 hand-checked auction-name → Cricsheet-ID matches, with optional display names |
| `../data/raw/supplementary/` | Role/nationality fill-ins (2013–22 backup dataset, official 2025 auction list), 2026 unsold list (Wisden), team purses |
| `deliverables/` | `IPL_Auction_Value.pdf` (all pages), `project_report.md`, `demo_script.md`, theme JSON, page screenshots |
| `scripts/` | Build, validation and QA tooling (Python venv + PowerShell); not needed to use the report |
| `../data/processed/` | The model's tables exported as CSV + JSON (with Value Index, fair value and overpay per row) for the web app; see [`../data/README.md`](../data/README.md) |

## Design

Warm off-white canvas with a soft yellow glow, white rounded cards, a pill navigation bar (dark pill = current page), a strip of large KPI numbers, slicers in a light side panel and the page's "So what" in a dark panel. Bars are yellow with dark pill data labels. Colour meaning is fixed on every page: green = Steal, yellow = Star, red = Overpaid, grey = Passenger / Unpriced; team colours only on the franchise page. Every page headline states the finding (numbers verified against the model), every visual has alt text.

The PRD asked for a dark navy theme; the light design follows the reference look requested during the build.

## Data choices that differ from the PRD

- **Ball-by-ball source.** The PRD's primary file (Kaggle lyc0riz CSV) has no fielder column, so catches, stumpings and run-outs cannot be scored from it. The model reads Cricsheet's IPL JSON instead, which is the upstream source of that CSV. It adds fielders, playing XIs and a Cricsheet ID for every player. `Matches` counts playing-XI appearances.
- **Value Index across several seasons** is computed season by season (sum of impact shares ÷ sum of spend shares), so a 2013 buy is judged against the 2013 market. For a single season it equals the PRD formula exactly.
- **Value Quadrant medians** are pre-computed per season in Power Query (columns `MedianPriceCr`, `MedianImpact`). The DAX calculated column then compares each row with them. Doing it with `CALCULATE` inside the column caused a circular dependency with its sort column.
- **Contracts.** Seasons after the auction season count only while the player still appears for that team, so released players stop carrying spend.

## QA results (PRD section 9)

All checked against the refreshed model with `scripts/qa_queries.dax`; the hidden **QA Checks** page shows the same numbers live.

| Check | Result |
| --- | --- |
| Matches per season | 2013: 76, 2014–21: 59–60, 2022–26: 74, 2024: 71 (3 washouts); 921 in total |
| Orange / Purple Cap samples | 2016 Kohli 973 / Bhuvneshwar 23 · 2023 Gill 890 / Shami 28 · 2024 Kohli 741 / Harshal 24 ✔ |
| 2026 auction | 77 players, ₹215.45 Cr ✔ |
| Highest price | Rishabh Pant ₹27 Cr (2025) ✔ |
| Null / zero / negative prices | 0 ✔ |
| Team keys | CSK, DC, GL, GT, KKR, LSG, MI, PBKS, PWI, RCB, RPS, RR, SRH ✔ |
| Auction spend matched to Cricsheet | 99.0% (target ≥ 95%) ✔ |
| Contract rows beyond next mega auction | 0 ✔ |
| League Value Index per season | 1.00 in every season ✔ |
| Spot check | V Kohli 2016 Impact Points 1,187, identical in Power BI and the independent pandas reference (`scripts/reference_pipeline.py`) ✔ |
| Average win % per season | 49–50% ✔ |

## Rebuilding the project files (optional, for developers)

The `.pbip` text files are generated by Python scripts so they can be diffed and rebuilt. Edit the scripts, not the generated files. Everything runs inside the repo-root `.venv` and is run from this `powerbi/` folder (Git Bash on Windows):

```bash
python -m venv ../.venv && ../.venv/Scripts/python -m pip install -r requirements.txt
bash scripts/rebuild_and_open.sh            # regenerate model + report, reopen Desktop, full refresh
powershell -File scripts/pbi_engine.ps1 -QueryFile scripts/qa_queries.dax   # re-run QA against the open model
bash scripts/export_pdf.sh                  # File > Export > PDF via UI Automation, then:
../.venv/Scripts/python -I scripts/clean_pdf.py deliverables/IPL_Auction_Value.pdf deliverables/IPL_Auction_Value.pdf  # strip Desktop's export toast
powershell -File scripts/export_processed.ps1 && ../.venv/Scripts/python -I scripts/processed_to_json.py ../data/processed  # refresh data/processed for the web app
```

`build/` (schemas, scratch files) is local only and git-ignored. `rebuild_and_open.sh` validates the report against the PBIR schemas in `build/schemas_full` and skips that step if they are missing; get them from [microsoft/json-schemas](https://github.com/microsoft/json-schemas) to enable it.
