/**
 * Builds the short BDM project report (Word .docx, about 13 pages).
 *
 *   node docs/report/make_report.js <out.docx> [pagemap.json]
 *
 * The table of contents and list of figures/tables are written as plain text with page numbers taken
 * from pagemap.json (produced by tools/pagemap.py from a rendered PDF), so they show correctly in any
 * viewer without a "update fields" prompt. Run once without a pagemap, render, measure, run again.
 */
const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell, WidthType, BorderStyle,
  AlignmentType, HeadingLevel, ShadingType, PageBreak, Header, Footer, PageNumber, NumberFormat,
  LevelFormat, TabStopType, LeaderType,
  VerticalAlign, TableLayoutType,
} = require('docx');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT = process.argv[2] || path.join(ROOT, 'Handover', 'BDM_Project_Report.docx');
const PAGEMAP = process.argv[3] && fs.existsSync(process.argv[3]) ? JSON.parse(fs.readFileSync(process.argv[3], 'utf8')) : {};
const LIVE_URL = process.env.LIVE_URL || '';
const REPO_URL = 'https://github.com/nabrahma/BDM_Project';

const FONT = 'Times New Roman';
const CONTENT_W = 9026; // A4 width 11906 − 2 × 1440 margins (DXA)
const IMG_W = 600;      // px at 96 dpi ≈ 6.25 in

// ---------------------------------------------------------------- helpers
const toc = [];      // {level, text}
const figures = [];  // caption text
const tables = [];   // caption text
let chapter = 0, section = 0, figN = 0, tabN = 0;

function runs(content, base = {}) {
  if (typeof content === 'string') return [new TextRun({ text: content, font: FONT, ...base })];
  return content.map(c => (typeof c === 'string'
    ? new TextRun({ text: c, font: FONT, ...base })
    : new TextRun({ text: c[0], font: FONT, ...base, ...c[1] })));
}
const P = (content, o = {}) => new Paragraph({
  alignment: o.align ?? AlignmentType.JUSTIFIED,
  spacing: { after: o.after ?? 140, line: o.line ?? 340 },
  indent: o.indent, keepNext: o.keepNext,
  children: runs(content, { size: o.size ?? 24, ...(o.run || {}) }),
});
const B = (content, level = 0) => new Paragraph({
  numbering: { reference: 'bullets', level }, alignment: AlignmentType.JUSTIFIED,
  spacing: { after: 80, line: 320 }, children: runs(content, { size: 24 }),
});
const N = (content, ref = 'numbers') => new Paragraph({
  numbering: { reference: ref, level: 0 }, alignment: AlignmentType.JUSTIFIED,
  spacing: { after: 80, line: 320 }, children: runs(content, { size: 24 }),
});
function H1(title) {
  chapter += 1; section = 0; figN = 0; tabN = 0;
  const text = `${chapter}. ${title}`;
  toc.push({ level: 1, text });
  return new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text, font: FONT })] });
}
function H1plain(text, label = null) {   // unnumbered chapter-level heading (References, appendices)
  toc.push({ level: 1, text });
  if (label) { chapter = label; section = 0; figN = 0; tabN = 0; }
  return new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text, font: FONT })] });
}
function H2(title) {
  section += 1;
  const text = `${chapter}.${section} ${title}`;
  toc.push({ level: 2, text });
  return new Paragraph({ heading: HeadingLevel.HEADING_2, keepNext: true, children: [new TextRun({ text, font: FONT })] });
}
const H3 = title => new Paragraph({ heading: HeadingLevel.HEADING_3, keepNext: true, children: [new TextRun({ text: title, font: FONT })] });

function Fig(file, caption, width = IMG_W) {
  figN += 1;
  const label = `Figure ${chapter}.${figN}: ${caption}`;
  figures.push(label);
  const buf = fs.readFileSync(file);
  const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20); // PNG IHDR
  const height = Math.round(width * h / w);
  return [
    new Paragraph({ alignment: AlignmentType.CENTER, keepNext: true, spacing: { before: 120, after: 60 },
      children: [new ImageRun({ type: 'png', data: buf, transformation: { width, height },
        altText: { title: caption, description: caption, name: path.basename(file) } })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 220 },
      children: [new TextRun({ text: label, font: FONT, size: 20, italics: true })] }),
  ];
}

const BORDER = { style: BorderStyle.SINGLE, size: 4, color: '9E9E9E' };
const BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };
function Tbl(caption, headers, rows, widths, o = {}) {
  tabN += 1;
  const label = `Table ${chapter}.${tabN}: ${caption}`;
  tables.push(label);
  const total = widths.reduce((a, b) => a + b, 0);
  const cell = (text, w, head, align, keep = true) => new TableCell({
    width: { size: w, type: WidthType.DXA }, borders: BORDERS, verticalAlign: VerticalAlign.CENTER,
    shading: head ? { fill: 'E7E3D8', type: ShadingType.CLEAR, color: 'auto' } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: [new Paragraph({ alignment: align, keepNext: keep, spacing: { after: 0, line: 260 },
      children: runs(text, { size: o.size ?? 20, bold: head }) })],
  });
  const align = i => (o.right || []).includes(i) ? AlignmentType.RIGHT : AlignmentType.LEFT;
  return [
    new Paragraph({ alignment: AlignmentType.CENTER, keepNext: true, spacing: { before: 120, after: 80 },
      children: [new TextRun({ text: label, font: FONT, size: 20, bold: true })] }),
    new Table({
      width: { size: total, type: WidthType.DXA }, columnWidths: widths, layout: TableLayoutType.FIXED,
      alignment: AlignmentType.CENTER,
      rows: [
        new TableRow({ tableHeader: true, children: headers.map((h, i) => cell(h, widths[i], true, align(i))) }),
        ...rows.map((r, ri) => new TableRow({ cantSplit: true, children: r.map((c, i) => cell(String(c), widths[i], false, align(i), ri < rows.length - 1)) })),
      ],
    }),
    new Paragraph({ spacing: { after: 160 }, children: [] }),
  ];
}
const Code = lines => lines.map((l, i) => new Paragraph({
  shading: { fill: 'F4F2EC', type: ShadingType.CLEAR, color: 'auto' },
  spacing: { after: 0, line: 250, before: i === 0 ? 80 : 0 }, keepNext: i < lines.length - 1,
  indent: { left: 200, right: 200 },
  children: [new TextRun({ text: l.length ? l : ' ', font: 'Consolas', size: 18 })],
})).concat([new Paragraph({ spacing: { after: 120 }, children: [] })]);
const Formula = text => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 100, after: 160 },
  children: [new TextRun({ text, font: 'Cambria Math', size: 24, italics: true })] });

function tocLine(text, level, page) {
  return new Paragraph({
    spacing: { after: level === 1 ? 60 : 30, before: level === 1 ? 80 : 0 },
    indent: { left: level === 1 ? 0 : 440 },
    tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_W, leader: LeaderType.DOT }],
    children: [
      new TextRun({ text, font: FONT, size: level === 1 ? 24 : 22, bold: level === 1 }),
      new TextRun({ text: '	' + (page != null ? String(page) : ''), font: FONT, size: level === 1 ? 24 : 22, bold: level === 1 }),
    ],
  });
}

// ---------------------------------------------------------------- cover
const A = p => path.join(ROOT, 'docs', 'report', 'assets', p);
const PBI = p => path.join(ROOT, 'powerbi', 'deliverables', 'screenshots', p);
const center = (text, size, o = {}) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: o.after ?? 80, before: o.before ?? 0 },
  children: [new TextRun({ text, font: FONT, size, bold: o.bold, italics: o.italics, allCaps: o.caps })] });

const members = [
  ['Abhishek Kokadwar', '2023IMG-002'],
  ['Pratik Baviskar', '2023IMG-014'],
  ['Rajveer Lomate', '2023IMG-031'],
  ['Nabaskar Brahma', '2023IMG-035'],
];
const NOB = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const memberTable = new Table({
  width: { size: 6000, type: WidthType.DXA }, columnWidths: [3600, 2400], alignment: AlignmentType.CENTER,
  borders: { top: NOB, bottom: NOB, left: NOB, right: NOB, insideHorizontal: NOB, insideVertical: NOB },
  rows: members.map(([n, r]) => new TableRow({ children: [
    new TableCell({ width: { size: 3600, type: WidthType.DXA }, borders: { top: NOB, bottom: NOB, left: NOB, right: NOB },
      children: [new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: n, font: FONT, size: 26, bold: true })] })] }),
    new TableCell({ width: { size: 2400, type: WidthType.DXA }, borders: { top: NOB, bottom: NOB, left: NOB, right: NOB },
      children: [new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 60 }, children: [new TextRun({ text: `(${r})`, font: FONT, size: 26 })] })] }),
  ] })),
});
const logo = fs.readFileSync(A('iiitm_logo.png'));
const cover = [
  center('IPL AUCTION VALUATION AND', 34, { bold: true, before: 600, after: 0 }),
  center('PLAYER PERFORMANCE INTELLIGENCE', 34, { bold: true, after: 240 }),
  center('Valuing every IPL auction buy by on-field output per crore, 2013–2026', 24, { italics: true, after: 480 }),
  center('A Project Report', 26, { after: 40 }),
  center('submitted for the course', 24, { after: 40 }),
  center('BDM (Semester VII)', 28, { bold: true, after: 480 }),
  center('Submitted by', 24, { italics: true, after: 160 }),
  memberTable,
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 520, after: 360 },
    children: [new ImageRun({ type: 'png', data: logo, transformation: { width: 130, height: Math.round(130 * 347 / 276) },
      altText: { title: 'ABV-IIITM Gwalior logo', description: 'Institute logo', name: 'logo' } })] }),
  center('ABV-INDIAN INSTITUTE OF INFORMATION TECHNOLOGY', 28, { bold: true, after: 0 }),
  center('AND MANAGEMENT GWALIOR', 28, { bold: true, after: 120 }),
  center('GWALIOR, INDIA', 24, { bold: true, after: 120 }),
  center('AUGUST, 2026', 24, { bold: true, after: 0 }),
];

// ---------------------------------------------------------------- body
const body = [];
const add = (...xs) => xs.forEach(x => (Array.isArray(x) ? body.push(...x) : body.push(x)));

// 1 Introduction
add(H1('Introduction'));
add(P('Every year IPL franchises spend hundreds of crores at the player auction. Prices are set in a few minutes of bidding, often driven by reputation, while the return on that money is decided over a season of runs, wickets and catches. Between 2013 and 2026 the franchises spent ₹3,269 Cr on 1,380 auction buys.'));
add(P([['Problem statement. ', { bold: true }], 'Which IPL auction buys earned their price? Taking the view of a franchise analytics team, we measure how much on-field impact each crore bought, so that franchises can be compared and the next auction planned on evidence.']));
add(P('The project answers six business questions:', { keepNext: true }));
add(N('Which franchise gets the most on-field impact per crore spent?'));
add(N('Which players were the best bargains and the worst buys?'));
add(N('Do franchises that spend efficiently win more matches?'));
add(N('Are some roles over- or under-priced, and do overseas players earn their premium?'));
add(N('How much have auction prices inflated since 2013?'));
add(N('Do base-price buys outperform expensive marquee signings?'));
add(P('The results are delivered in two front ends built on one dataset: a Power BI dashboard (Handover/IPL_Auction_Value.pbix) and a MERN web application with the same pages, which stores the data in MongoDB.'));

// 2 Data and Methodology
add(H1('Data and Methodology'));
add(H2('Data Sources'));
add(Tbl('Data sources', ['Source', 'What it provides', 'Size'], [
  ['Kaggle: IPL Auction Dataset 2013–2026', 'Price, team, role, nationality; base price for 2025–26', '1,380 buys'],
  ['Cricsheet IPL ball-by-ball JSON', 'Every delivery, fielders, playing XIs, results', '921 matches (2013–2026)'],
  ['Cricsheet Register', 'Unique player IDs and name variants', 'All players'],
  ['Kaggle 2013–22 list; official 2025 list', 'Missing roles and Indian/Overseas flags', 'Supplementary'],
  ['Wisden: IPL 2026 unsold list', 'Players unsold at the latest auction', '79 players'],
], [3500, 3700, 1826]));
add(H2('Data Preparation'));
add(P('All cleaning is done in Power Query inside Power BI, so one Refresh rebuilds the model from the raw files. The main steps were:', { keepNext: true }));
add(B([['Standardising auction files: ', { bold: true }], 'each year has different columns and price formats; all prices were converted to crores (2013 from US dollars at ₹54 per $).']));
add(B([['Matching player names: ', { bold: true }], '"Virat Kohli" in the auction is "V Kohli" in Cricsheet. Six matching passes (manual fixes, exact, initials, surname, fuzzy) link 99.0% of auction spend to a player.']));
add(B([['Team renames: ', { bold: true }], 'e.g. Delhi Daredevils → Delhi Capitals, Kings XI Punjab → Punjab Kings; 13 team keys in total.']));
add(B([['Contracts: ', { bold: true }], 'a price covers the auction season and later seasons with the same team, until the next auction or mega auction.']));
add(H2('Data Model'));
add(P('The model is a star schema with three fact tables (player-season, auction buy, team-match) and four dimensions (player, team, season, team-season), all relationships one-to-many. The 93 measures are written in DAX.'));
add(Fig(A('diagram_star_schema.png'), 'Star schema of the Power BI model', 520));
add(H2('Value Metrics'));
add(P([['Impact Points ', { bold: true }], 'put batting, bowling and fielding on one scale (a run is 1 point, a wicket 25, a catch 8):']));
add(Formula('Impact = Runs + Fours + 2·Sixes + 25·Wickets + Dot balls + 8·Catches + 12·Stumpings + 6·Run-outs'));
add(P([['Value Index ', { bold: true }], 'compares a player\'s share of the league\'s impact with their share of the league\'s auction spend in that season. 1.00 is fair value; above 1 is a bargain, below 1 is overpaid. For groups across seasons the shares are summed season by season, so each buy is judged against its own year\'s market.']));
add(Formula('Value Index = (Impact ÷ League Impact) ÷ (Price ÷ League Spend)'));
add(P([['Fair value and overpay: ', { bold: true }], 'fair value is what the output would have cost at the league\'s price per Impact Point; Overpay = Price − Fair value, in crores. ', ['Value quadrants: ', { bold: true }], 'each buy is compared with the season\'s median price and median impact and labelled Star (high price, high impact), Steal (low price, high impact), Overpaid (high price, low impact) or Passenger (low price, low impact).']));

// 3 Power BI Dashboard
add(H1('Power BI Dashboard'));
add(P('Each page title states its finding with numbers, a "So what" panel states the decision it supports, and colours keep a fixed meaning (green Steal, yellow Star, red Overpaid, grey Passenger). Table 3.1 lists the pages.'));
add(Tbl('Pages of the Power BI report', ['Page', 'Question answered', 'Main visuals'], [
  ['Home', 'Overview', 'KPI strip and page cards'],
  ['1 Auction Market', 'How much have prices inflated?', 'Average price per season, spend by role'],
  ['2 Franchise Efficiency', 'Who gets most impact per crore; does it win?', 'Value Index by team, spend vs win % scatter'],
  ['3 Player Value Map', 'Stars, Steals, Overpaid', 'Price vs Impact scatter with median lines'],
  ['4 Steals and Overpaid', 'Best and worst buys', 'Top-10 tables, Bargain XI, Overpaid XI'],
  ['5 Role and Nationality', 'Are roles / overseas players worth it?', 'Value Index by role, Indian vs overseas'],
  ['6 Price Brackets', 'Do cheap buys beat marquee buys?', 'Value Index and quadrant mix by bracket'],
  ['7 Player Profile', 'One player\'s history (drill-through)', 'Price and impact by season'],
  ['8 Methodology', 'How is value measured?', 'Definitions and sources'],
], [2300, 3300, 3426]));
add(Fig(PBI('00_home.png'), 'Home page', 560));
add(Fig(PBI('02_franchise_efficiency.png'), 'Franchise Efficiency', 560));
add(Fig(PBI('03_player_value_map.png'), 'Player Value Map', 560));
add(Fig(PBI('04_steals_and_overpaid.png'), 'Steals and Overpaid', 560));

// 4 Results
add(H1('Results and Analysis'));
add(H2('Auction Market'));
add(P('Prices have doubled: the average buy cost ₹1.73 Cr in 2013 and ₹3.51 Cr at the 2025 mega auction (2.0×). In 2025–26, bids ended on average 245% above the base price. The highest price is ₹27 Cr for Rishabh Pant (LSG, 2025).'));
add(H2('Franchise Efficiency and Winning'));
add(P('Across 123 franchise-seasons, spend has no link with winning (r = −0.03 between spend and win %), but spending efficiently does (r = +0.35 between Value Index and win %). Over 2013–2026, CSK (1.19) and RR (1.14) ran the most efficient auctions.'));
add(Tbl('Franchise efficiency in 2026 (top and bottom three)', ['Franchise', 'Spend', 'Win %', 'Value Index'], [
  ['Rajasthan Royals', '₹34.3 Cr', '56.3%', '1.63'], ['Sunrisers Hyderabad', '₹41.8 Cr', '60.0%', '1.33'],
  ['Gujarat Titans', '₹69.3 Cr', '58.8%', '1.22'], ['Delhi Capitals', '₹73.2 Cr', '50.0%', '0.83'],
  ['Kolkata Knight Riders', '₹72.8 Cr', '46.2%', '0.81'], ['Punjab Kings', '₹108.1 Cr', '53.8%', '0.72'],
], [3800, 1900, 1500, 1826], { right: [1, 2, 3] }));
add(H2('Steals and Overpaid'));
add(P('In 2026, of 171 priced players, 57 were Stars, 24 Steals, 8 Overpaid and 6 Passengers. The best value sat in ₹30-lakh buys, and all five most overpaid players cost ₹14 Cr or more.'));
add(Tbl('Top steals and most overpaid buys, 2026 (minimum 5 matches)', ['Top steals', 'Price', 'Value Index', 'Most overpaid', 'Price', 'Overpaid by'], [
  ['Kartik Tyagi (KKR)', '₹0.3 Cr', '33.95', 'Rishabh Pant (LSG)', '₹27.0 Cr', '₹19.5 Cr'],
  ['Prince Yadav (LSG)', '₹0.3 Cr', '30.47', 'Shreyas Iyer (PBKS)', '₹26.75 Cr', '₹15.8 Cr'],
  ['Sakib Hussain (SRH)', '₹0.3 Cr', '26.27', 'Cameron Green (KKR)', '₹25.2 Cr', '₹14.2 Cr'],
  ['Brijesh Sharma (RR)', '₹0.3 Cr', '24.62', 'Prashant Veer (CSK)', '₹14.2 Cr', '₹12.4 Cr'],
  ['Praful Hinge (SRH)', '₹0.3 Cr', '24.23', 'Yuzvendra Chahal (PBKS)', '₹18.0 Cr', '₹11.7 Cr'],
], [2050, 1000, 1150, 2400, 1150, 1276], { right: [1, 2, 4, 5], size: 18 }));
add(H2('Role and Nationality'));
add(P('In 2026 overseas buys cost 2.4× as much as Indian buys but returned less per crore (Value Index 0.88 against 1.11). Over all seasons, Indian bowlers are the best-value role (1.22) and overseas bowlers the worst (0.84).'));
add(H2('Price Brackets'));
add(Tbl('Value Index by price bracket, 2013–2026', ['Price bracket', 'Player-seasons', 'Spend', 'Value Index'], [
  ['Base price buy', '569', '₹189.2 Cr', '4.11'], ['Under ₹2 Cr', '708', '₹592.6 Cr', '1.93'],
  ['₹2 to 5 Cr', '494', '₹1,531.5 Cr', '1.01'], ['₹5 to 10 Cr', '271', '₹1,868.3 Cr', '0.67'],
  ['₹10 Cr and above', '107', '₹1,466.6 Cr', '0.49'],
], [3000, 2000, 2200, 1826], { right: [1, 2, 3] }));
add(P('Value per crore falls steadily with price. Marquee players still perform (88% of ₹10 Cr+ player-seasons beat the median impact), but each crore buys far more output in the cheap brackets.'));
add(H2('Validation'));
add(P('Matches per season, Orange and Purple Cap winners and the 2026 auction total (77 players, ₹215.45 Cr) match official records; the league Value Index is exactly 1.00 in every season; and an independent Python re-computation gives identical numbers.'));

// 5 Web application
add(H1('Web Application (MERN)'));
add(P('The web app shows the same pages and numbers as the dashboard, so anyone can open it in a browser without Power BI. The only difference is the data layer: the cleaned Power BI tables were exported to JSON and loaded into MongoDB Atlas (8 collections, 7,139 documents). An Express API reads them, React draws the charts, and the site is deployed on Vercel. The web app also adds player search and a Squad Builder that drafts a squad under the ₹120 Cr purse and IPL squad rules.'));
add(Fig(A('diagram_architecture.png'), 'Architecture: one dataset, two front ends', 520));
add(Fig(A('web_crop/home.png'), 'Web app Home page', 470));

// 6 Conclusion
add(H1('Recommendations and Conclusion'));
add(H2('Recommendations'));
add(N([['Keep Steals and Stars; release Overpaid and Passengers. ', { bold: true }], 'The Value Map gives a ready release shortlist.'], 'recs'));
add(N([['Build depth from base-price and under-₹2 Cr buys, ', { bold: true }], 'which return 2–4× fair value.'], 'recs'));
add(N([['Use overseas slots only on proven match-winners; ', { bold: true }], 'the premium is not earned on average.'], 'recs'));
add(N([['Cap marquee bids at fair value ', { bold: true }], 'and manage to Value Index, not to spend.'], 'recs'));
add(H2('Limitations'));
add(B('Retained players have no auction price and are excluded from value measures.'));
add(B('Base prices exist only for 2025–26; Impact Points do not weight match situation.'));
add(H2('Conclusion'));
add(P('By linking 14 years of auction prices to ball-by-ball data and scoring every player on one Impact Points scale, we built a Value Index that compares output with spend fairly across seasons. The answer to our question is consistent: prices have doubled, the most expensive buys deliver the least per crore, and spending more does not win matches while spending well does. The Power BI dashboard and the MongoDB-backed web app turn this into a practical tool for the next auction.'));

// References
add(H1plain('References'));
const refs = [
  'Cricsheet (2026). Indian Premier League ball-by-ball data (JSON) and Register. https://cricsheet.org/',
  'sunnyyadav754 (2026). IPL Auction Dataset 2013–2026. Kaggle. https://www.kaggle.com/',
  'kalilurrahman (2022). IPL Player Auction Dataset 2013–2022. Kaggle. https://www.kaggle.com/',
  'Indian Premier League (2024). TATA IPL 2025 Auction List and Player Regulations 2025–27. https://www.iplt20.com/',
  'Wisden (2025). IPL 2026 auction: full list of unsold players. https://www.wisden.com/',
  'Kimball, R. and Ross, M. (2013). The Data Warehouse Toolkit (3rd ed.). Wiley.',
  'Microsoft (2026). Power BI, DAX and Power Query documentation. https://learn.microsoft.com/power-bi/',
  'MongoDB, Inc. (2026). MongoDB Atlas documentation. https://www.mongodb.com/docs/',
  'Express, React and Vercel documentation (2026). https://expressjs.com/ · https://react.dev/ · https://vercel.com/docs',
];
refs.forEach((r, i) => add(new Paragraph({ spacing: { after: 80, line: 280 }, indent: { left: 560, hanging: 560 },
  alignment: AlignmentType.LEFT, children: runs(`[${i + 1}]  ${r}`, { size: 22 }) })));
add(P(`Project repository: ${REPO_URL}`, { align: AlignmentType.LEFT, size: 22 }));

// ---------------------------------------------------------------- front matter (needs the toc list built above)
const page = key => (PAGEMAP[key] != null ? PAGEMAP[key] : null);
const front = [];
front.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: 'Abstract', font: FONT })] }));
front.push(P('IPL franchises pay at the auction largely for reputation, while matches are won with runs, wickets and catches. This project asks which auction buys earned their price. We combined auction records for 2013–2026 (1,380 buys, ₹3,269 Cr) with ball-by-ball data for 921 matches, scored every player on one Impact Points scale, and built a Value Index: a player\'s share of league output divided by their share of league spend.'));
front.push(P('The analysis is delivered as a Power BI dashboard and as a MERN web application backed by MongoDB Atlas. The findings are consistent: prices have doubled since 2013; base-price buys return 4.1× fair value per crore while ₹10 Cr+ signings return 0.49×; and spending is unrelated to winning (r = −0.03) while spending efficiently is not (r = +0.35).'));
front.push(P([['Keywords: ', { bold: true }], 'IPL auction, player valuation, Power BI, DAX, MongoDB, data analytics']));
front.push(new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 480, after: 280 }, children: [new TextRun({ text: 'Table of Contents', font: FONT })] }));
toc.forEach(t => front.push(tocLine(t.text, t.level, page('toc:' + t.text))));


// ---------------------------------------------------------------- document
const PAGE = { size: { width: 11906, height: 16838 }, margin: { top: 1440, bottom: 1440, left: 1440, right: 1440, header: 708, footer: 708 } };
const footer = new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER,
  children: [new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 22 })] })] });
const header = new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT,
  border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'BFBFBF', space: 4 } },
  children: [new TextRun({ text: 'IPL Auction Valuation & Player Performance Intelligence · BDM Project Report', font: FONT, size: 18, italics: true, color: '595959' })] })] });

const doc = new Document({
  creator: 'Abhishek Kokadwar, Pratik Baviskar, Rajveer Lomate, Nabaskar Brahma',
  title: 'IPL Auction Valuation and Player Performance Intelligence: BDM Project Report',
  description: 'BDM project report, ABV-IIITM Gwalior',
  styles: {
    default: { document: { run: { font: FONT, size: 24 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 32, bold: true, font: FONT, color: '1A1A1A' }, paragraph: { spacing: { before: 120, after: 280 }, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 27, bold: true, font: FONT, color: '1A1A1A' }, paragraph: { spacing: { before: 280, after: 140 }, outlineLevel: 1 } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 24, bold: true, italics: true, font: FONT, color: '1A1A1A' }, paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 2 } },
    ],
  },
  numbering: { config: [
    { reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT,
      style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    ...['numbers', 'steps', 'recs'].map(reference => ({ reference, levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.',
      alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] })),
  ] },
  sections: [
    { properties: { page: PAGE }, children: cover },
    { properties: { page: { ...PAGE, pageNumbers: { start: 1, formatType: NumberFormat.LOWER_ROMAN } } },
      footers: { default: footer }, children: front },
    { properties: { page: { ...PAGE, pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL } } },
      headers: { default: header }, footers: { default: footer }, children: body },
  ],
});

Packer.toBuffer(doc).then(buf => {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, buf);
  fs.writeFileSync(OUT + '.entries.json', JSON.stringify({ toc, figures, tables }, null, 1));
  console.log('wrote', OUT, `(${toc.length} toc entries, ${figures.length} figures, ${tables.length} tables)`);
});
