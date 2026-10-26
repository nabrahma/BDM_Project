# IPL Auction Valuation & Player Performance Intelligence

BDM project. It answers one question for an IPL franchise: **which auction buys earned their price?** Every auction buy from 2013 to 2026 is scored on runs, wickets and catches per crore. The scores are then rolled up to franchises, roles, nationalities, price brackets and seasons.

The project has two front ends on one shared dataset:

| Part | Status | Folder |
| --- | --- | --- |
| **Power BI dashboard**: 9 pages, star schema, 93 DAX measures, QA checks, PDF, report, demo script | ✅ Done | [`powerbi/`](powerbi/) |
| **MERN web app**: interactive version of the dashboard on MongoDB, Express, React and Node, plus a Squad Builder | ✅ Done (deploy on Vercel) | [`web/`](web/) |
| **Submission copy**: single-file Power BI report (`.pbix`, data included) | ✅ Ready | [`Handover/`](Handover/) |

**New to the repo? Start with [HANDOFF.md](HANDOFF.md).** It covers what is finished, what the data means, and how to build the web app on top of it.

## Repo layout

```
.
├── HANDOFF.md              ← start here (status, data contract, web-app plan)
├── DEPLOYMENT.md           how to put the web app online (MongoDB Atlas + Vercel)
├── Handover/               IPL_Auction_Value.pbix: the single file to submit / double-click
├── docs/                   project brief: PRD and the data-kit PDF
├── data/
│   ├── raw/                every source file (auction CSVs, Cricsheet ball-by-ball JSON, register, mappings)
│   ├── processed/          clean tables exported from the Power BI model (CSV + JSON): use these in the web app
│   └── README.md           data dictionary: every table, column and metric
├── powerbi/
│   ├── IPL_Auction_Value.pbip            open this in Power BI Desktop
│   ├── IPL_Auction_Value.SemanticModel/  model: Power Query (M), tables, relationships, DAX
│   ├── IPL_Auction_Value.Report/         report pages (PBIR) + light theme
│   ├── deliverables/                     PDF export, project report, demo script, screenshots, theme JSON
│   ├── scripts/                          Python/PowerShell tooling that generates and checks the PBIP
│   └── README.md                         how to open, refresh and rebuild the dashboard
└── web/                    MERN app: client/ (React + Vite), server/ (Express + Mongoose), api/ + vercel.json (Vercel)
```

## Quick start

**Look at the finished dashboard:** double-click [`Handover/IPL_Auction_Value.pbix`](Handover/IPL_Auction_Value.pbix) (Power BI Desktop), or open the PDF [`powerbi/deliverables/IPL_Auction_Value.pdf`](powerbi/deliverables/IPL_Auction_Value.pdf). To edit, open `powerbi/IPL_Auction_Value.pbip`. Full steps are in [powerbi/README.md](powerbi/README.md).

**Run the web app:** see [web/README.md](web/README.md) for local dev and [DEPLOYMENT.md](DEPLOYMENT.md) (Option 1) to deploy it on Vercel with MongoDB Atlas.

## Headline findings (2013–2026)

- Base-price buys return **4.1×** fair value per crore; ₹10 Cr+ signings return **0.49×**.
- Spending more does not win more: spend vs win % has r = −0.03. Spending efficiently does: Value Index vs win % has r = +0.35.
- In 2026, Kartik Tyagi cost ₹30 lakh and returned **34×** fair value. Rishabh Pant (₹27 Cr) was overpaid by **₹19.5 Cr**.
- Overseas buys cost more but return less per crore than Indian buys: Value Index 0.90 vs 1.10.

## Data sources

[Cricsheet](https://cricsheet.org/) IPL ball-by-ball JSON and the Cricsheet Register, both under the ODbL licence. Kaggle *IPL Auction Dataset 2013–2026* (sunnyyadav754) and *IPL Player Auction Dataset 2013–2022*. The official TATA IPL 2025 auction list. Wisden's IPL 2026 unsold list. Details are in [data/README.md](data/README.md).
