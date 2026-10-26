/**
 * Builds the BDM project report (Word .docx).
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
  return new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, children: [new TextRun({ text, font: FONT })] });
}
function H1plain(text, label = null) {   // unnumbered chapter-level heading (References, appendices)
  toc.push({ level: 1, text });
  if (label) { chapter = label; section = 0; figN = 0; tabN = 0; }
  return new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, children: [new TextRun({ text, font: FONT })] });
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
  const cell = (text, w, head, align) => new TableCell({
    width: { size: w, type: WidthType.DXA }, borders: BORDERS, verticalAlign: VerticalAlign.CENTER,
    shading: head ? { fill: 'E7E3D8', type: ShadingType.CLEAR, color: 'auto' } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: [new Paragraph({ alignment: align, spacing: { after: 0, line: 260 },
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
        ...rows.map(r => new TableRow({ cantSplit: true, children: r.map((c, i) => cell(String(c), widths[i], false, align(i))) })),
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
add(H2('Background'));
add(P('The Indian Premier League (IPL) is the richest T20 cricket league in the world and, for its franchises, a business with a fixed and highly visible cost line: the player auction. Every year ten franchises bid for players out of a capped purse (₹120 Cr per franchise for 2025–2027). Every three to four years a mega auction resets most squads (2014, 2018, 2022 and 2025 in our period); in between, smaller mini auctions fill gaps. Players enter at a base price and are sold to the highest bidder; a few core players are retained outside the auction at fixed retention prices.'));
add(P('Between 2013 and 2026 the franchises spent ₹3,269 Cr on 1,380 auction buys. Prices are set in a few minutes of competitive bidding, under time pressure and with strong reputational effects, while the return on that money is decided over a season of runs, wickets and catches. That gap between what is paid and what is delivered is a classic business-analytics problem: it can be measured, compared across buyers, and used to make better decisions at the next auction.'));
add(H2('Problem Statement'));
add(P([['Which IPL auction buys earned their price? ', { bold: true }], 'Franchises pay for reputation but win with on-field output. This project takes the point of view of a franchise analytics team and measures, for every auction buy from 2013 to 2026, how much on-field impact each crore bought, so that franchises can be compared and the next auction can be planned on evidence rather than on headlines.']));
add(H2('Objectives'));
add(P('The project answers six business questions:', { keepNext: true }));
add(N('Which franchise gets the most on-field impact per crore spent?'));
add(N('Which players were the best bargains and the worst buys in each season?'));
add(N('Do franchises that spend efficiently win more matches?'));
add(N('Are batters, bowlers, all-rounders or wicket-keepers over- or under-priced, and do overseas players earn their premium?'));
add(N('How much have auction prices inflated since 2013, and does a high price predict high output?'));
add(N('How often do base-price buys outperform expensive marquee signings?'));
add(H2('Scope and Deliverables'));
add(P('The analysis covers every auction purchase from the 2013 to the 2026 auction and every IPL match played in those seasons (921 matches). Retained players are part of the performance data but, because they have no auction price, they are excluded from the value metrics. The project produced two front ends on one shared, validated dataset:'));
add(B([['Power BI dashboard: ', { bold: true }], 'a star-schema model with 93 DAX measures and a nine-page report (plus a drill-through player profile, a tooltip page and a QA page), exported to PDF and delivered as a single .pbix file.']));
add(B([['MERN web application: ', { bold: true }], 'MongoDB, Express, React and Node.js, serving the same analysis in any browser, plus an interactive Squad Builder and Salary Cap Simulator, deployed on Vercel with MongoDB Atlas.']));
add(P(`All code, data and documentation are in the project repository: ${REPO_URL}.`, { align: AlignmentType.LEFT }));

// 2 Data
add(H1('Data Sources and Understanding'));
add(H2('Data Sources'));
add(P('The analysis combines auction records with ball-by-ball match data. Table 2.1 lists every source. The two hand-made mapping files are the only manual inputs, and each entry in them was checked by hand.'));
add(Tbl('Data sources used in the project', ['Source', 'What it provides', 'Grain / size'], [
  ['Kaggle: IPL Auction Dataset 2013–2026 (sunnyyadav754)', 'Price, team, role, nationality; base price for 2025–26', 'One CSV per auction; 1,380 buys'],
  ['Cricsheet IPL ball-by-ball JSON (Oct 2026 release)', 'Every delivery, fielders, playing XIs, results', '1,243 matches (921 in 2013–2026)'],
  ['Cricsheet Register (people.csv, names.csv)', 'Unique player IDs and name variants', 'One row per person / name variant'],
  ['Kaggle: IPL Player Auction Dataset 2013–2022 (kalilurrahman)', 'Role and Indian/Overseas flags missing in some years', 'One row per buy'],
  ['Official TATA IPL 2025 Auction List', 'Roles and base prices for 2025', 'One row per registered player'],
  ['Wisden: IPL 2026 unsold list', 'Players who went unsold at the latest auction', '79 players'],
  ['team_map.csv (hand-made)', 'Franchise renames → one team key, team colours', '13 franchises'],
  ['name_fixes.csv (hand-made)', 'Checked auction-name → Cricsheet-ID matches', '96 entries'],
], [3300, 3600, 2126]));
add(P('The project brief named a Kaggle ball-by-ball CSV as the performance source. That file has no fielder column, so catches, stumpings and run-outs could not be scored from it. We used Cricsheet\'s JSON instead, which is the upstream source of that CSV and additionally gives playing XIs and a stable identifier for every player.'));
add(H2('Data Quality Challenges'));
add(P('The raw data could not be joined directly. The main problems, and how they were handled, were:', { keepNext: true }));
add(B([['Different file layouts per year. ', { bold: true }], 'Auction files use different column names and price formats (rupee strings such as "14,20,00,000", lakh values, and US dollars in 2013). One standardising function maps each year to a common layout and converts every price to crores (2013 at ₹54 per US$).']));
add(B([['Player names do not match across sources. ', { bold: true }], 'The auction lists "Virat Kohli" while Cricsheet records "V Kohli"; spellings, initials and nicknames vary. A six-pass matching process (Section 3.2) links 99.0% of auction spend to a Cricsheet player ID.']));
add(B([['Franchise renames and defunct teams. ', { bold: true }], 'Delhi Daredevils became Delhi Capitals, Kings XI Punjab became Punjab Kings, and Pune Warriors, Rising Pune Supergiant and Gujarat Lions no longer exist. A mapping table assigns every historical name to one of 13 team keys.']));
add(B([['Missing attributes. ', { bold: true }], 'Role and nationality are missing for some years; they are filled from the 2013–2022 backup dataset and the official 2025 list, and otherwise derived from the player\'s bowling and batting record.']));
add(B([['Season labels and super overs. ', { bold: true }], 'Seasons such as "2020/21" are mapped to the calendar year in which the IPL was played; super-over deliveries are excluded from player statistics.']));
add(H2('Data Volume after Preparation'));
add(Tbl('Size of the prepared tables', ['Table', 'Grain', 'Rows'], [
  ['FactPlayerSeason', 'player × season × team (statistics + auction price)', '2,910'],
  ['FactAuction', 'one auction purchase', '1,380'],
  ['FactTeamMatch', 'team × match (won / no result)', '1,842'],
  ['DimPlayer', 'one player (Cricsheet ID)', '778'],
  ['DimTeam · DimSeason · DimTeamSeason', 'franchise · season · franchise-season', '13 · 14 · 123'],
], [3000, 4526, 1500], { right: [2] }));

// 3 Methodology
add(H1('Methodology'));
add(H2('Data Preparation Pipeline'));
add(P('All cleaning is done in Power Query (M) inside Power BI, so a single Refresh rebuilds the entire model from the raw files. Every query reads one parameter, DataFolder, so the project can be moved to another computer by changing one value. Intermediate staging queries are not loaded into the model. The pipeline has six stages:'));
add(N([['Auction files: ', { bold: true }], 'one function standardises each year\'s columns and converts prices to crores; role and nationality gaps are filled from the backup datasets.'], 'steps'));
add(N([['Match JSON: ', { bold: true }], 'a parsing function turns each of the 1,243 match files into three tables: playing XIs, deliveries and fielding credits.'], 'steps'));
add(N([['Player-season statistics: ', { bold: true }], 'batting (runs, balls faced excluding wides, fours, sixes), bowling (legal balls, runs conceded excluding byes and leg-byes, dot balls, wickets excluding run-outs) and fielding (catches, stumpings, run-out involvements) are aggregated by season, player and team.'], 'steps'));
add(N([['Name matching: ', { bold: true }], 'each auction name is linked to a Cricsheet player ID (Section 3.2).'], 'steps'));
add(N([['Contracts: ', { bold: true }], 'auction prices are carried forward to the seasons they cover (Section 3.3).'], 'steps'));
add(N([['Facts and dimensions: ', { bold: true }], 'statistics and contracts are joined into FactPlayerSeason; players without an auction price that season (retained or traded) are labelled Unpriced.'], 'steps'));
add(H2('Player Name Matching'));
add(P('Matching auction names to ball-by-ball identities is the step on which every value metric depends. It runs as a sequence of passes; each pass only handles names that the earlier passes left unmatched, and the later, looser passes only search within the buying franchise\'s roster for that season, which prevents false matches between players with similar names.'));
add(Tbl('Name-matching passes and their results', ['Pass', 'Rule', 'Auction buys matched'], [
  ['1. Manual', 'Hand-checked fixes from name_fixes.csv (96 entries)', '177'],
  ['2. Exact (IPL)', 'Exact, unique name among IPL players', '861'],
  ['3. Exact (register)', 'Exact, unique name in the full Cricsheet register', '70'],
  ['4. Initials', '"Virat Kohli" → "V Kohli" within the team\'s roster', '162'],
  ['5. Surname', 'Surname + first initial within the roster', '44'],
  ['6. Fuzzy', 'Power Query fuzzy merge (similarity ≥ 0.8) within the roster', '0 (safety net)'],
  ['Unmatched', 'Mostly players who never played an IPL match', '66'],
], [2000, 5226, 1800], { right: [2] }));
add(P('In total 1,314 of 1,380 buys are matched, covering ₹3,237.6 Cr of ₹3,269.2 Cr, i.e. 99.0% of auction spend against a target of 95%. The 66 unmatched buys keep a synthetic identifier so that their spend is still counted.'));
add(H2('Contract Carry-Forward Rule'));
add(P('An auction price pays for more than one season. A price therefore covers the auction season and later seasons until the earliest of: the player\'s next auction minus one, the next mega auction minus one (2014, 2018, 2022, 2025), or 2026. Later seasons only count while the player is still playing for the same franchise, so released players stop carrying spend. A QA check confirms that no contract row extends beyond the next mega auction.'));
add(H2('Data Model'));
add(P('The model is a star schema (Kimball and Ross, 2013): three fact tables surrounded by four dimensions, every relationship one-to-many and single-direction, so that every filter flows predictably from dimension to fact (Figure 3.1). All 93 measures live in one _Measures table, organised in display folders (Money, Performance, Value, Team, QA, Formatting).'));
add(Fig(A('diagram_star_schema.png'), 'Star schema of the Power BI model'));
add(H2('Value Metrics'));
add(H3('Impact Points'));
add(P('To compare batters, bowlers and fielders on one scale, every contribution is converted into Impact Points using fantasy-style weights (Table 3.2). One run is worth one point; a wicket is worth 25, roughly what a T20 wicket is worth in runs saved.'));
add(Tbl('Impact Points weights', ['Contribution', 'Points'], [
  ['Run scored', '1'], ['Boundary four (bonus)', '+1'], ['Six (bonus)', '+2'], ['Wicket (bowler)', '25'],
  ['Dot ball bowled', '1'], ['Catch', '8'], ['Stumping', '12'], ['Run-out involvement', '6'],
], [5000, 2000], { right: [1] }));
add(Formula('Impact Points = Runs + Fours + 2·Sixes + 25·Wickets + Dot balls + 8·Catches + 12·Stumpings + 6·Run-outs'));
add(H3('Value Index'));
add(P('The Value Index compares a player\'s share of the league\'s on-field output with his share of the league\'s auction spend in the same season. A value of 1.00 means fair value; 2.00 means twice as much output as the money suggests; 0.50 means half.'));
add(Formula('Value Index = (Impact Points ÷ League priced Impact Points) ÷ (Price ÷ League auction spend)'));
add(P('For groups that span several seasons (a franchise over 14 years, a price bracket, a role) the shares are summed season by season before dividing, so that a 2013 buy is judged against the 2013 market and a 2025 buy against the 2025 market:'));
add(Formula('Value Index(group) = Σₛ (Impactₛ ÷ League Impactₛ) ÷ Σₛ (Spendₛ ÷ League Spendₛ)'));
add(P('By construction the league as a whole has a Value Index of exactly 1.00 in every season, which is one of the model\'s QA checks.'));
add(H3('Fair Value and Overpay'));
add(P('Fair value is what a player\'s output would have cost at that season\'s league price per Impact Point; Overpay is the difference between the price paid and that fair value. Overpay is measured in crores, which makes it the better ranking for "worst buys": a ratio such as the Value Index becomes extreme for very cheap players, whereas crores lost is what hurts a franchise\'s purse.'));
add(Formula('Fair Value = Impact Points × (League spend ÷ League priced Impact Points);   Overpay = Price − Fair Value'));
add(H3('Value Quadrant and Price Brackets'));
add(P('Each priced player-season is compared with that season\'s median price and median Impact Points and placed in one of four quadrants: Star (price and impact above the medians), Steal (cheap but high impact), Overpaid (expensive but low impact) and Passenger (cheap and low impact). Players with fewer than five matches are labelled Too few matches and excluded from rankings. Buys are also grouped into price brackets: base-price buy, under ₹2 Cr, ₹2–5 Cr, ₹5–10 Cr and ₹10 Cr and above.'));

// 4 Power BI
add(H1('Power BI Dashboard'));
add(H2('Design Principles'));
add(P('The report is built for a franchise owner who has a few minutes before an auction meeting. Every page follows the same pattern:'));
add(B([['Finding as the headline. ', { bold: true }], 'Each page title states its conclusion with numbers (for example, "2026: RR got 1.63× fair value from ₹34 Cr of buys; PBKS spent the most (₹108 Cr) for 0.72×"), with the business question underneath.']));
add(B([['"So what" panel. ', { bold: true }], 'A dark panel at the bottom of every page states the decision the page supports.']));
add(B([['Fixed colour meaning. ', { bold: true }], 'Green is always Steal, yellow Star, red Overpaid and grey Passenger or Unpriced; team colours appear only on the franchise page.']));
add(B([['Consistent layout. ', { bold: true }], 'A light canvas with white rounded cards, pill navigation at the top (the current page shown as a dark pill), a strip of large KPI numbers, and alt text on every visual for screen readers.']));
add(H2('Report Pages'));
add(Tbl('Pages of the Power BI report', ['Page', 'Business question', 'Main visuals'], [
  ['Home', 'Overview and navigation', 'KPI strip, page cards, key findings'],
  ['1 Auction Market', 'How much have prices inflated?', 'Average price per season (mega auctions highlighted), spend, top buys'],
  ['2 Franchise Efficiency', 'Who gets most impact per crore, and does it win?', 'Value Index by team, spend vs win % scatter, team × season matrix'],
  ['3 Player Value Map', 'Which buys were Stars, Steals, Overpaid?', 'Price vs Impact scatter with median lines, quadrant colours'],
  ['4 Steals and Overpaid', 'Best bargains and worst buys', 'Top-10 tables, Bargain XI, Overpaid XI, unsold list'],
  ['5 Role and Nationality', 'Are roles / overseas players worth it?', 'Value Index by role × Indian/Overseas'],
  ['6 Price Brackets', 'Do base-price buys beat marquee signings?', 'Value Index and % above median impact by bracket'],
  ['7 Player Profile', 'One player\'s history (drill-through)', 'Price bars vs Impact line by season, career table'],
  ['8 Methodology', 'How is value measured?', 'Definitions, weights, data sources'],
], [2200, 3300, 3526]));
add(P('A hidden QA page shows every validation check live (Chapter 7), and a tooltip page shows a player card when hovering over any dot on the Value Map.'));
add(H2('Page Walkthrough'));
add(Fig(PBI('00_home.png'), 'Power BI Home page: KPI strip and navigation cards'));
add(Fig(PBI('01_auction_market.png'), 'Auction Market: average price per season, mega auctions highlighted'));
add(Fig(PBI('02_franchise_efficiency.png'), 'Franchise Efficiency: Value Index by franchise and spend vs win %'));
add(Fig(PBI('03_player_value_map.png'), 'Player Value Map: price vs Impact Points, coloured by quadrant'));
add(Fig(PBI('04_steals_and_overpaid.png'), 'Steals and Overpaid: top-10 tables, Bargain XI and Overpaid XI'));
add(Fig(PBI('05_role_and_nationality.png'), 'Role and Nationality: Value Index by role and Indian/Overseas'));
add(Fig(PBI('06_price_brackets.png'), 'Price Brackets: Value Index and hit rate by price bracket'));
add(Fig(PBI('08_methodology.png'), 'Methodology page: definitions and data sources'));
add(H2('DAX Measures'));
add(P('The 93 measures are grouped by purpose. The central measure, Value Index, is computed season by season so that any filter combination (one team, one role, all seasons) returns the correct multi-season value:'));
add(Code([
  "Value Index =",
  "VAR bySeason =",
  "    ADDCOLUMNS (",
  "        VALUES ( DimSeason[Season] ),",
  "        \"@impShare\",   DIVIDE ( [Priced Impact], [League Priced Impact] ),",
  "        \"@spendShare\", DIVIDE ( [Spend Cr], [League Spend] )",
  "    )",
  "RETURN",
  "    DIVIDE ( SUMX ( bySeason, [@impShare] ), SUMX ( bySeason, [@spendShare] ) )",
]));
add(Tbl('Measure groups', ['Display folder', 'Examples'], [
  ['Money', 'Spend Cr, Average and Median Auction Price, Top Buy, Auction Premium %, Spend Matched %'],
  ['Performance', 'Impact Points, Runs, Wickets, Strike Rate, Economy, Orange / Purple Cap leaders'],
  ['Value', 'Value Index, Fair Value Cr, Overpay Cr, Steal / Overpaid Rank, Bargain XI and Overpaid XI flags'],
  ['Team', 'Team Wins, Team Results, Win %'],
  ['QA', 'Matches per season, League Value Index, bad prices, unmapped teams, contract rows beyond mega'],
  ['Formatting', 'Colour measures for conditional formatting and dynamic labels'],
], [2200, 6826]));

// 5 Web app
add(H1('MERN Web Application'));
add(H2('Motivation'));
add(P('A Power BI file needs Power BI Desktop or a Power BI licence to open. To make the analysis available to anyone with a browser, and to add interactive features that a static report cannot offer, the same dataset was served through a MERN web application (MongoDB, Express, React, Node.js). Both front ends read the same validated tables, so every number in the web app matches the Power BI report.'));
add(H2('System Architecture'));
add(P('The Power BI model is the single source of truth. Its tables, with the value metrics already calculated, are exported to CSV and JSON (data/processed), loaded into MongoDB Atlas, and served by an Express API to a React front end (Figure 5.1).'));
add(Fig(A('diagram_architecture.png'), 'System architecture: one dataset, two front ends'));
add(Tbl('Technology stack of the web application', ['Layer', 'Technology', 'Role'], [
  ['Database', 'MongoDB Atlas (M0, AWS Mumbai) + Mongoose', '8 collections, 7,139 documents, indexes on season / player / team'],
  ['API', 'Node.js + Express', '8 REST route groups; Value Index aggregation pipeline'],
  ['Front end', 'React 19 + Vite + Recharts', '10 pages mirroring the dashboard, plus the Squad Builder'],
  ['Hosting', 'Vercel', 'Static site + Express API as a serverless function at /api'],
], [1600, 3400, 4026]));
add(H2('Database Design'));
add(Tbl('MongoDB collections', ['Collection', 'Documents', 'Key / use'], [
  ['players', '778', 'PlayerID; career totals and career Value Index'],
  ['teams', '13', 'TeamKey; name and colour'],
  ['seasons', '14', 'Season; league totals, Orange/Purple Cap, top buy'],
  ['team_seasons', '123', 'TeamSeasonKey; spend, wins, Value Index'],
  ['player_seasons', '2,910', 'PlayerSeasonKey; statistics, price, quadrant, Value Index, Overpay'],
  ['auction_buys', '1,380', 'AuctionKey; every purchase and its match pass'],
  ['team_matches', '1,842', 'TeamMatchKey; results per team and match'],
  ['unsold_players', '79', '2026 unsold players with career record'],
], [2200, 1300, 5526], { right: [1] }));
add(P('Because the Value Index is a ratio, it must never be averaged. The API computes it for any group (role, nationality, price bracket, franchise) with a MongoDB aggregation pipeline that groups by key and season, divides by the league totals from the seasons collection and sums the shares, exactly as the DAX measure does.'));
add(H2('REST API'));
add(Tbl('API endpoints', ['Endpoint', 'Returns'], [
  ['GET /api/summary', 'Home KPIs: total spend, buys, average price, inflation, spend matched %'],
  ['GET /api/seasons', 'Season-level market data, Orange and Purple Caps'],
  ['GET /api/team-seasons?season=  ·  /matrix', 'Franchise Value Index, spend and win %; team × season matrix'],
  ['GET /api/player-seasons?season=&priced=true', 'Points for the Value Map scatter'],
  ['GET /api/rankings/steals | overpaid | bargain-xi | overpaid-xi | unsold', 'Ranked lists (minimum 5 matches)'],
  ['GET /api/breakdown?by=Role | Nationality | PriceBracket', 'Value Index by group (aggregation pipeline)'],
  ['GET /api/players?q=  ·  /api/players/:id', 'Player search and full profile'],
  ['GET /api/squad-builder/pool?season=', 'Draftable player pool with prices and retention data'],
  ['GET /api/health', 'Database connection status and collection counts'],
], [4300, 4726]));
add(H2('Front-end Pages'));
add(P('The React client has ten pages: the eight analytical pages of the dashboard, a searchable player directory with full profiles, and the Squad Builder. A shared season filter, the same colour meanings and the same "So what" panels keep the web app consistent with the Power BI report.'));
add(Fig(A('web_crop/home.png'), 'Web app Home page: live KPIs from MongoDB'));
add(Fig(A('web_crop/valuemap.png'), 'Web app Player Value Map (2026)'));
add(Fig(A('web_crop/franchises.png'), 'Web app Franchise Efficiency (2026)'));
add(Fig(A('web_crop/steals.png'), 'Web app Steals and Overpaid page with Bargain XI and Overpaid XI'));
add(Fig(A('web_crop/players.png'), 'Web app player profile: Cameron Green'));
add(H2('Squad Builder and Salary Cap Simulator'));
add(P('The Squad Builder turns the analysis into a decision tool. A user picks a franchise preset (its actual pre-auction retentions) or starts from a blank slate, then drafts players from the 2026 pool under the real IPL rules:'));
add(B('Purse cap of ₹120 Cr shared between retentions and auction buys.'));
add(B('Retention ladder for capped players (₹18 Cr, ₹14 Cr, ₹11 Cr, ₹18 Cr, ₹14 Cr) and a flat ₹4 Cr for uncapped retentions; at most six retentions, at most five capped.'));
add(B('Squad of 18 to 25 players with at most 8 overseas players; Playing XI of exactly 11 with at most 4 overseas.'));
add(P('The simulator shows the remaining purse, a live checklist of the rules, the squad\'s total Impact Points and its Value Index, and can auto-draft a full squad or auto-select the best Playing XI from the drafted players.'));
add(Fig(A('web_crop/squad.png'), 'Squad Builder and Salary Cap Simulator'));
add(H2('Deployment'));
add(P(`The application is deployed as a single Vercel project. Vercel builds the React client and serves it as static files, and runs the Express API as a serverless function at /api; the database is a MongoDB Atlas M0 cluster in the AWS Mumbai region. The API keeps one cached database connection per serverless container, so repeated requests do not reconnect. The only configuration is one environment variable, MONGODB_URI. Every push to the repository's main branch redeploys the site automatically.${LIVE_URL ? ` The live application is available at ${LIVE_URL}.` : ''}`));

// 6 Results
add(H1('Results and Analysis'));
add(H2('The Auction Market'));
add(P('Prices have doubled. The average auction buy cost ₹1.73 Cr in 2013 and ₹3.51 Cr at the 2025 mega auction (2.0×); the 2026 mini auction averaged ₹2.80 Cr. Spending moves in steps with the mega auctions: the 2025 mega auction alone saw ₹639 Cr spent on 182 players, the most ever. In 2025–26, where base prices are published, teams paid on average 245% above the base price. The highest price in the data is ₹27 Cr for Rishabh Pant (LSG, 2025).'));
add(H2('Franchise Efficiency and Winning'));
add(P('Across all 123 franchise-seasons, auction spend has essentially no relationship with winning: the correlation between spend and win percentage is r = −0.03. Spending efficiently does matter: the correlation between Value Index and win percentage is r = +0.35. Money does not buy wins; value does.'));
add(P('Over 2013–2026, Chennai Super Kings (Value Index 1.19) and Rajasthan Royals (1.14) ran the most efficient auctions among current franchises, and Delhi Capitals (0.85) the least. Table 6.1 shows the 2026 season.'));
add(Tbl('Franchise efficiency in 2026', ['Franchise', 'Spend on priced players', 'Win %', 'Value Index'], [
  ['Rajasthan Royals (RR)', '₹34.3 Cr', '56.3%', '1.63'], ['Sunrisers Hyderabad (SRH)', '₹41.8 Cr', '60.0%', '1.33'],
  ['Gujarat Titans (GT)', '₹69.3 Cr', '58.8%', '1.22'], ['Royal Challengers Bengaluru (RCB)', '₹85.7 Cr', '68.8%', '1.13'],
  ['Mumbai Indians (MI)', '₹43.5 Cr', '28.6%', '1.08'], ['Lucknow Super Giants (LSG)', '₹69.4 Cr', '28.6%', '0.93'],
  ['Chennai Super Kings (CSK)', '₹63.5 Cr', '42.9%', '0.93'], ['Delhi Capitals (DC)', '₹73.2 Cr', '50.0%', '0.83'],
  ['Kolkata Knight Riders (KKR)', '₹72.8 Cr', '46.2%', '0.81'], ['Punjab Kings (PBKS)', '₹108.1 Cr', '53.8%', '0.72'],
], [3800, 2200, 1300, 1726], { right: [1, 2, 3] }));
add(H2('Steals and Overpaid Buys'));
add(P('The best value sits in ₹30-lakh buys. In 2026, of 171 priced players, 57 were Stars, 24 Steals, 8 Overpaid and 6 Passengers (76 played fewer than five matches). Kartik Tyagi, bought by KKR for ₹0.3 Cr, returned 33.95× fair value. At the other end, every one of the five most overpaid 2026 players cost ₹14 Cr or more.'));
add(Tbl('Top five steals of 2026 (minimum 5 matches)', ['Player', 'Team', 'Price', 'Impact Points', 'Value Index'], [
  ['Kartik Tyagi', 'KKR', '₹0.3 Cr', '615', '33.95'], ['Prince Yadav', 'LSG', '₹0.3 Cr', '552', '30.47'],
  ['Sakib Hussain', 'SRH', '₹0.3 Cr', '476', '26.27'], ['Brijesh Sharma', 'RR', '₹0.3 Cr', '446', '24.62'],
  ['Praful Hinge', 'SRH', '₹0.3 Cr', '439', '24.23'],
], [2800, 1200, 1500, 1800, 1726], { right: [2, 3, 4] }));
add(Tbl('Five most overpaid buys of 2026 (minimum 5 matches)', ['Player', 'Team', 'Price', 'Impact Points', 'Overpaid by'], [
  ['Rishabh Pant', 'LSG', '₹27.0 Cr', '450', '₹19.5 Cr'], ['Shreyas Iyer', 'PBKS', '₹26.75 Cr', '661', '₹15.8 Cr'],
  ['Cameron Green', 'KKR', '₹25.2 Cr', '664', '₹14.2 Cr'], ['Prashant Veer', 'CSK', '₹14.2 Cr', '111', '₹12.4 Cr'],
  ['Yuzvendra Chahal', 'PBKS', '₹18.0 Cr', '381', '₹11.7 Cr'],
], [2800, 1200, 1500, 1800, 1726], { right: [2, 3, 4] }));
add(P('The case of Cameron Green illustrates the difference between impact and value: at KKR in 2026 he was a Star by output (664 Impact Points, above the season median), but at ₹25.2 Cr his Value Index was only 0.44. Meanwhile experienced players such as Karn Sharma, Deepak Hooda and Jonny Bairstow went unsold despite strong IPL records.'));
add(H2('Role and Nationality'));
add(P('Overseas premiums are not earned on average. In 2026 overseas buys cost 2.4× as much as Indian buys (₹4.42 Cr vs ₹1.82 Cr on average) yet returned less per crore: a Value Index of 0.88 against 1.11. Over 2013–2026 the overseas price premium is 84% and the Value Index 0.90 against 1.10 for Indian buys. By role, Indian bowlers are the best-value group (1.22) and overseas bowlers the worst (0.84).'));
add(H2('Price Brackets'));
add(Tbl('Value Index by price bracket, 2013–2026', ['Price bracket', 'Player-seasons', 'Spend', 'Value Index'], [
  ['Base price buy', '569', '₹189.2 Cr', '4.11'], ['Under ₹2 Cr', '708', '₹592.6 Cr', '1.93'],
  ['₹2 to 5 Cr', '494', '₹1,531.5 Cr', '1.01'], ['₹5 to 10 Cr', '271', '₹1,868.3 Cr', '0.67'],
  ['₹10 Cr and above', '107', '₹1,466.6 Cr', '0.49'],
], [3000, 2000, 2200, 1826], { right: [1, 2, 3] }));
add(P('Value per crore falls steadily with price: base-price buys return 4.11× fair value, ₹10 Cr+ signings 0.49×. This does not mean that marquee players are poor cricketers: 88% of ₹10 Cr+ player-seasons beat the season\'s median Impact Points, against only 24% of base-price buys. Marquee players do win games, but each crore buys far more output in the cheap brackets.'));

// 7 Validation
add(H1('Validation and Quality Assurance'));
add(P('Every number in the report was checked against independent references. The checks below are built into the model as measures and shown live on a hidden QA page; in addition, a separate Python (pandas) implementation of the whole pipeline reproduces the model\'s numbers, and automated tests in the web application check the API against the same values.'));
add(Tbl('Validation checks and results', ['Check', 'Result'], [
  ['Matches per season', '2013: 76; 2014–2021: 59–60; 2022–2026: 74 (2024: 71, three washouts); 921 in total'],
  ['Orange and Purple Cap winners', '2016 Kohli 973 runs / Bhuvneshwar 23 wkts; 2023 Gill 890 / Shami 28; 2024 Kohli 741 / Harshal 24: all match iplt20.com'],
  ['2026 auction totals', '77 players, ₹215.45 Cr'],
  ['Highest price', 'Rishabh Pant, ₹27 Cr (2025)'],
  ['Null, zero or negative prices', '0'],
  ['Unmapped team names', '0 (13 team keys)'],
  ['Auction spend matched to Cricsheet', '99.0% (target ≥ 95%)'],
  ['Contract rows beyond the next mega auction', '0'],
  ['League Value Index per season', '1.00 in all 14 seasons'],
  ['Average win % per season', '49–50%'],
  ['Independent re-computation (pandas)', 'Identical results, e.g. V Kohli 2016: 1,187 Impact Points'],
  ['Web application tests', '16/16 API routes, 6/6 QA value checks and the squad-rules test pass against MongoDB Atlas'],
], [3400, 5626]));

// 8 Recommendations
add(H1('Business Recommendations'));
add(P('For a franchise preparing for its next auction, the analysis supports five concrete decisions:'));
add(N([['Keep the Steals and Stars, release the Overpaid and Passengers. ', { bold: true }], 'The Value Map gives a ready-made retention and release shortlist for every franchise.'], 'recs'));
add(N([['Build depth from the base-price pool. ', { bold: true }], 'Base-price and sub-₹2 Cr buys return 2–4× fair value; scouting uncapped domestic players is the cheapest source of impact.'], 'recs'));
add(N([['Spend overseas slots only on proven match-winners. ', { bold: true }], 'Overseas buys cost 2.4× as much but return less per crore; the premium pays for scarcity, not output.'], 'recs'));
add(N([['Cap marquee bids at fair value. ', { bold: true }], 'Marquee players beat the median, but beyond a point every extra crore is overpay; the fair-value measure gives a walk-away price for each target.'], 'recs'));
add(N([['Manage to Value Index, not to spend. ', { bold: true }], 'Value Index correlates with winning (r = +0.35) while spend does not (r = −0.03); RR in 2026 showed that a small, efficient auction can outperform the biggest spender.'], 'recs'));

// 9 Limitations
add(H1('Limitations and Future Scope'));
add(H2('Limitations'));
add(B('Retained players (for example Kohli and Bumrah for long periods) have no auction price and are excluded from value measures, so the analysis evaluates auction decisions rather than whole squads.'));
add(B('2013 prices were in US dollars and are converted at a single rate of ₹54 per dollar.'));
add(B('Base prices are published only for 2025–26; earlier, a buy at that era\'s minimum price is treated as a base-price buy.'));
add(B('Impact Points weights are a judgement call. The runs-only and wickets-only views put the same players at the top, so the conclusions are robust to the weights, but match situation (pressure overs, chases) is not weighted.'));
add(B('About 1% of auction spend (66 buys, mostly players who never played) could not be matched to ball-by-ball data.'));
add(H2('Future Scope'));
add(B('Context-aware impact: weighting runs and wickets by match situation (phase of innings, required run rate, win probability added).'));
add(B('Price prediction: a regression model of auction price from past performance, age and role, to estimate a fair bid before the auction.'));
add(B('Including retention prices to evaluate whole squads, and extending the Squad Builder into a full auction-day simulator with rival franchises.'));
add(B('Automatic yearly refresh: the pipeline is parameterised, so adding the next auction file and Cricsheet release rebuilds every page and the web database.'));

// 10 Conclusion
add(H1('Conclusion'));
add(P('This project set out to answer a simple business question: which IPL auction buys earned their price? By linking 14 years of auction records to ball-by-ball data for 921 matches, and expressing every player\'s contribution in one Impact Points scale, we built a Value Index that compares output with spend fairly across seasons, roles and franchises.'));
add(P('The answer is clear and consistent across every view. Auction prices have doubled since 2013, but the most expensive buys deliver the least per crore: base-price buys return 4.1× fair value and ₹10 Cr+ signings 0.49×. Spending more does not win more matches, while spending efficiently does. Overseas premiums are not earned on average, and in 2026 the five most overpaid players all cost ₹14 Cr or more, while ₹30-lakh players such as Kartik Tyagi returned more than 30× fair value.'));
add(P('The results are delivered in two complementary forms built on one validated dataset: a Power BI dashboard for analysts and decision-makers, and a MERN web application that brings the same analysis, and an interactive Squad Builder, to any browser. Validation against official records (auction totals, Orange and Purple Caps) and an independent re-implementation give confidence that the numbers are correct. Together they show how business data management turns scattered public data into a decision tool: in the IPL auction, as in any investment, the question is not how much is spent, but how much each rupee returns.'));

// References
add(H1plain('References'));
const refs = [
  'Cricsheet (2026). Indian Premier League match data, JSON format (October 2026 release). https://cricsheet.org/downloads/',
  'Cricsheet (2026). JSON data format documentation. https://cricsheet.org/format/json/',
  'Cricsheet (2026). The Cricsheet Register (people.csv, names.csv). https://cricsheet.org/register/',
  'sunnyyadav754 (2026). IPL Auction Dataset 2013–2026. Kaggle. https://www.kaggle.com/',
  'kalilurrahman (2022). IPL Player Auction Dataset 2013–2022. Kaggle. https://www.kaggle.com/',
  'Indian Premier League (2024). TATA IPL 2025 Auction List. https://www.iplt20.com/',
  'Indian Premier League (2024). TATA IPL Player Regulations 2025–27 (retention rules and purse). https://www.iplt20.com/',
  'Wisden (2025). IPL 2026 auction: full list of unsold players. https://www.wisden.com/',
  'Kimball, R. and Ross, M. (2013). The Data Warehouse Toolkit: The Definitive Guide to Dimensional Modeling (3rd ed.). Wiley.',
  'Microsoft (2026). Power BI Desktop projects (PBIP) and TMDL documentation. https://learn.microsoft.com/power-bi/developer/projects/projects-overview',
  'Microsoft (2026). DAX function reference. https://learn.microsoft.com/dax/',
  'Microsoft (2026). Power Query M formula language reference. https://learn.microsoft.com/powerquery-m/',
  'MongoDB, Inc. (2026). MongoDB Atlas and aggregation pipeline documentation. https://www.mongodb.com/docs/',
  'OpenJS Foundation (2026). Express.js documentation. https://expressjs.com/',
  'Meta Open Source (2026). React documentation. https://react.dev/',
  'Vite (2026). Vite documentation. https://vite.dev/ ; Recharts (2026). https://recharts.org/',
  'Vercel (2026). Vercel documentation: Express on Vercel and serverless functions. https://vercel.com/docs',
];
refs.forEach((r, i) => add(new Paragraph({ spacing: { after: 100, line: 300 }, indent: { left: 560, hanging: 560 },
  alignment: AlignmentType.LEFT, children: runs(`[${i + 1}]  ${r}`, { size: 22 }) })));

// Appendix
add(H1plain('Appendix A: Project Repository and How to Run', 'A'));
add(P(`Repository: ${REPO_URL}`, { align: AlignmentType.LEFT }));
add(Tbl('Repository structure', ['Folder', 'Contents'], [
  ['Handover/', 'IPL_Auction_Value.pbix (single-file Power BI report with data) and this report'],
  ['powerbi/', 'Power BI project (PBIP: TMDL model + PBIR report), build and QA scripts, PDF export, screenshots'],
  ['data/raw/', 'All source files: auction CSVs, Cricsheet JSON, register, mappings, supplementary files'],
  ['data/processed/', 'Model tables exported as CSV + JSON with value metrics; loaded into MongoDB'],
  ['web/', 'MERN application: client/ (React + Vite), server/ (Express + Mongoose), api/ + vercel.json'],
  ['docs/', 'Project brief (PRD), data kit and this report\'s source'],
], [2200, 6826]));
add(B([['Power BI: ', { bold: true }], 'open Handover/IPL_Auction_Value.pbix in Power BI Desktop (data included). To refresh from the raw files, open powerbi/IPL_Auction_Value.pbip, set the DataFolder parameter to the data\\raw\\ folder and click Refresh.']));
add(B([['Web application (local): ', { bold: true }], 'start MongoDB, run "node scripts/seed.js" in web/server, then "npm run dev" in web/server and web/client. Deployment steps for MongoDB Atlas and Vercel are in DEPLOYMENT.md.']));

// ---------------------------------------------------------------- front matter (needs toc/figures lists built above)
const page = key => (PAGEMAP[key] != null ? PAGEMAP[key] : null);
const front = [];
front.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: 'Abstract', font: FONT })] }));
front.push(P('Every year IPL franchises spend hundreds of crores at the player auction, paying largely for reputation, while matches are won with runs, wickets and catches. This project, written from the point of view of a franchise analytics team, asks which auction buys earned their price. We combined fourteen years of auction records (1,380 buys from 2013 to 2026, ₹3,269 Cr in total) with Cricsheet ball-by-ball data for 921 matches, matched 99.0% of auction spend to individual players through a six-pass name-matching process, and expressed batting, bowling and fielding on one Impact Points scale.'));
front.push(P('From these we built a Value Index, a player\'s share of league output divided by his share of league spend, computed season by season, together with fair value, overpay and a four-way value quadrant. The analysis is delivered as a Power BI dashboard (star schema, 93 DAX measures, nine report pages with QA checks) and as a MERN web application deployed on Vercel with MongoDB Atlas, which adds a Squad Builder and Salary Cap Simulator.'));
front.push(P('The results are consistent: auction prices have doubled since 2013; base-price buys return 4.1× fair value per crore while ₹10 Cr+ signings return 0.49×; spending is unrelated to winning (r = −0.03) while spending efficiently is not (r = +0.35); and overseas premiums are not earned on average. All key numbers were validated against official auction totals and Orange and Purple Cap winners, and reproduced by an independent implementation.'));
front.push(P([['Keywords: ', { bold: true }], 'IPL auction, player valuation, sports analytics, Power BI, DAX, star schema, MongoDB, MERN stack, business data management']));

front.push(new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, children: [new TextRun({ text: 'Table of Contents', font: FONT })] }));
toc.forEach(t => front.push(tocLine(t.text, t.level, page('toc:' + t.text))));
front.push(new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, children: [new TextRun({ text: 'List of Figures', font: FONT })] }));
figures.forEach(f => front.push(tocLine(f, 2, page('fig:' + f.split(':')[0]))));
front.push(new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, children: [new TextRun({ text: 'List of Tables', font: FONT })] }));
tables.forEach(t => front.push(tocLine(t, 2, page('tab:' + t.split(':')[0]))));

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
