"""Generate the PBIR report (all pages) for IPL_Auction_Value.pbip.

Design: warm off-white canvas with a yellow glow, white rounded cards, a pill navigation bar,
a KPI strip of large numbers, a light slicer panel and a dark "So what" panel on the left.

Usage (from powerbi/):  ../.venv/Scripts/python -I scripts/build_report.py <project_dir>
Page headlines state findings; FINDINGS (scripts/findings.json) holds the numbers, re-checked
against the model with scripts/qa_queries.dax after each data refresh.
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from pbir import (PAGE_SCHEMA, col, color, filter_in, filter_measure_cmp, meas, measure_color, num, obj, textbox,
                  visual, write_json)
from report_scaffold import (CARD, DARK, FAINT, FONT, FONT_SB, INK, LINE, MUTED, QUADRANT_COLOURS, YELLOW,
                             background_image_objects, write_scaffold)

PROJECT = sys.argv[1]
HERE = os.path.dirname(__file__)
F = json.load(open(os.path.join(HERE, "findings.json"), encoding="utf-8"))
W, H = 1280, 720
LATEST = 2026

PAGES = [  # (id, display name, short nav label, hidden)
    ("home", "Home", "Home", False),
    ("market", "1 Auction Market", "Market", False),
    ("franchise", "2 Franchise Efficiency", "Franchises", False),
    ("valuemap", "3 Player Value Map", "Value Map", False),
    ("steals", "4 Steals and Overpaid", "Steals", False),
    ("roles", "5 Role and Nationality", "Roles", False),
    ("brackets", "6 Price Brackets", "Brackets", False),
    ("profile", "7 Player Profile", "Profile", True),
    ("methodology", "8 Methodology", "Method", False),
    ("tooltip", "Player Tooltip", "", True),
    ("qa", "QA Checks", "", True),
]
NAV = [(pid, short) for pid, _, short, hidden in PAGES if not hidden]

# Layout grid
LX, LW = 16, 196            # left column
CX = 224                    # content x
CW = W - CX - 16            # content width (1040)
TOP = 192                   # content top
BOTTOM = 704


# ---------------------------------------------------------------- helpers
class Page:
    def __init__(self, pid, display, hidden=False, width=W, height=H, ptype=None):
        self.pid, self.display, self.hidden = pid, display, hidden
        self.width, self.height, self.ptype = width, height, ptype
        self.visuals, self.filters, self.binding, self.interactions = [], [], None, []
        self.z = 1000

    def add(self, v):
        v["position"]["z"] = self.z
        v["position"]["tabOrder"] = self.z
        self.z += 1000
        self.visuals.append(v)
        return v

    def write(self, rp):
        d = os.path.join(rp, "definition", "pages", self.pid)
        page = {"$schema": PAGE_SCHEMA, "name": self.pid, "displayName": self.display,
                "displayOption": "FitToPage", "height": self.height, "width": self.width,
                "objects": background_image_objects()}
        if self.filters:
            page["filterConfig"] = {"filters": self.filters}
        if self.binding:
            page["pageBinding"] = self.binding
        if self.interactions:
            page["visualInteractions"] = self.interactions
        if self.hidden:
            page["visibility"] = "HiddenInViewMode"
        if self.ptype:
            page["type"] = self.ptype
        write_json(os.path.join(d, "page.json"), page)
        for v in self.visuals:
            write_json(os.path.join(d, "visuals", v["name"], "visual.json"), v)


def vname(page, key):
    return f"{page.pid}_{key}"[:50]


def T(text, size=10, colour=INK, bold=False):
    return (text, {"fontFamily": FONT_SB if bold else FONT, "fontSize": f"{size}pt", "color": colour})


def panel(p, key, x, y, w, h, fill=CARD, transparency=8, radius=22, border=True, runs=None, alt="Decorative panel"):
    """Rounded background panel (a textbox container), optionally holding text."""
    v = textbox(vname(p, key), x, y, w, h, runs or [[("", None)]], alt=alt)
    v["visual"]["visualContainerObjects"] = {
        "background": [obj(show=True, color=color(fill), transparency=num(transparency))],
        "border": [obj(show=border, color=color(LINE), radius=num(radius), width=num(1))],
        "padding": [obj(top=num(14), bottom=num(12), left=num(16), right=num(14))],
        "general": [obj(altText=alt)],
    }
    return p.add(v)


def button(p, key, x, y, w, h, label, target=None, fill=None, font_colour=INK, font=10, bold=False, back=False,
           radius=20, alt=None, transparent=False):
    vco = {
        "background": [obj(show=fill is not None, **({"color": color(fill), "transparency": num(0)} if fill else {}))],
        "border": [obj(show=fill is not None, **({"color": color(fill)} if fill else {}), radius=num(radius))],
        "visualLink": [obj(show=True, type="Back") if back else obj(show=True, type="PageNavigation", navigationSection=target)],
        "title": [obj(show=False, text=label or "button")],
        "general": [obj(altText=alt or f"Button: {label}")],
    }
    objects = {
        "icon": [obj(show=False)],
        "text": [obj(show=not transparent), obj(selector={"id": "default"}, text=label or " ", fontColor=color(font_colour),
                                                   fontSize=num(font), fontFamily=FONT_SB if bold else FONT,
                                                   horizontalAlignment="center", verticalAlignment="middle")],
        "fill": [obj(show=False)],
        "outline": [obj(show=False)],
    }
    return p.add(visual(vname(p, key), "actionButton", x, y, w, h, objects=objects, vco=vco))


def header(p, headline, question):
    """App title, pill navigation (current page dark), info button, finding headline + question."""
    p.add(textbox(vname(p, "brand"), 16, 8, 270, 66, [[T("IPL Auction Value", 15, INK, True)], [T("Intelligence", 15, INK, True)]],
                  alt="Report title: IPL Auction Value Intelligence"))
    nav_w, nav_x = 92, 300
    total = nav_w * len(NAV) + 12
    panel(p, "navbg", nav_x, 14, total, 44, radius=22, transparency=0, alt="Navigation bar")
    for i, (pid, short) in enumerate(NAV):
        active = pid == p.pid
        button(p, f"nav_{pid}", nav_x + 6 + i * nav_w, 20, nav_w - 4, 32, short, pid,
               fill=DARK if active else None, font_colour="#FFFFFF" if active else INK, font=9, bold=active,
               alt=f"Navigate to {short} page" + (" (current page)" if active else ""))
    button(p, "info", nav_x + total + 14, 14, 44, 44, "i", "methodology", fill=CARD, font=12, bold=True, radius=22,
           alt="Open the Methodology page")
    if headline:
        p.add(textbox(vname(p, "headline"), 16, 74, 1248, 50, [[T(headline, 14, INK, True)], [T(question, 9, MUTED)]],
                      alt="Finding: " + headline))


def kpi(p, key, x, y, w, measure, label, size=22, value_colour=INK, h=62):
    objects = {"labels": [obj(color=color(value_colour), fontSize=num(size), fontFamily=FONT_SB)],
               "categoryLabels": [obj(show=True, color=color(MUTED), fontSize=num(9), fontFamily=FONT)],
               "wordWrap": [obj(show=True)]}
    return p.add(visual(vname(p, key), "card", x, y, w, h,
                        roles={"Values": [{"field": meas(measure), "queryRef": f"_Measures.{measure}", "nativeQueryRef": measure, "displayName": label}]},
                        objects=objects, vco={"title": [obj(show=False)], "background": [obj(show=False)], "border": [obj(show=False)]},
                        alt=label))


def kpi_strip(p, items, y=126):
    w = (W - 32) / len(items)
    for i, it in enumerate(items):
        kpi(p, f"kpi{i}", 16 + i * w, y, w - 8, it[0], it[1], size=it[2] if len(it) > 2 else 22)


def so_what(p, text, y=470, h=None):
    h = h or (BOTTOM - y)
    panel(p, "sowhat", LX, y, LW, h, fill=DARK, transparency=0, border=False, radius=22, runs=[
        [T("●  ", 11, YELLOW, True), T("So what", 11, "#FFFFFF", True)],
        [T(" ", 6)],
        [T(text, 10, "#E9E6DF")]], alt="So what: " + text)


def side_panel(p, y=TOP, h=270):
    return panel(p, "sidebg", LX, y, LW, h, transparency=35, alt="Filter panel")


def season_slicer(p, x=LX + 8, y=TOP + 10, w=LW - 16, h=64, multi=True):
    f = col("DimSeason", "Season")
    flt = filter_in(f, [LATEST], vname(p, "seasonflt"))["filter"]
    objects = {
        "data": [obj(mode="Dropdown")],
        "general": [{"properties": {"filter": {"filter": flt}}}],
        "selection": [obj(strictSingleSelect=not multi, selectAllCheckboxEnabled=False)],
        "header": [obj(show=True, fontColor=color(MUTED), text="Season", fontSize=num(9))],
        "items": [obj(fontColor=color(INK), background=color("#F1EFEA"), fontSize=num(10))],
    }
    v = visual(vname(p, "season"), "slicer", x, y, w, h, roles={"Values": [f]}, objects=objects,
               vco={"title": [obj(show=False)], "background": [obj(show=False)], "border": [obj(show=False)],
                    "general": [obj(altText="Season slicer, synced across pages 2 to 6. Defaults to the latest season.")]})
    v["visual"]["syncGroup"] = {"groupName": "Season", "fieldChanges": True, "filterChanges": True}
    v["filterConfig"] = {"filters": [{"name": vname(p, "seasonsf"), "field": f, "type": "Categorical"}]}
    return p.add(v)


def list_slicer(p, key, y, field, header_text, x=LX + 8, w=LW - 16, h=64):
    objects = {
        "data": [obj(mode="Dropdown")],
        "header": [obj(show=True, fontColor=color(MUTED), text=header_text, fontSize=num(9))],
        "items": [obj(fontColor=color(INK), background=color("#F1EFEA"), fontSize=num(10))],
        "selection": [obj(selectAllCheckboxEnabled=True)],
    }
    return p.add(visual(vname(p, key), "slicer", x, y, w, h, roles={"Values": [field]}, objects=objects,
                        vco={"title": [obj(show=False)], "background": [obj(show=False)], "border": [obj(show=False)],
                             "general": [obj(altText=f"{header_text} slicer")]}))


def tooltip_link():
    return [obj(show=True, type="ReportPage", section="tooltip")]


def dark_labels(size=9):
    return [obj(show=True, color=color("#FFFFFF"), fontSize=num(size), enableBackground=True,
                backgroundColor=color(DARK), backgroundTransparency=num(0))]


def axes(x_title=None, y_title=None, cat_type=None):
    cat = dict(show=True, showAxisTitle=x_title is not None, labelColor=color(MUTED), fontSize=num(9))
    if x_title:
        cat["titleText"] = x_title
    if cat_type:
        cat["axisType"] = cat_type
    val = dict(show=True, showAxisTitle=y_title is not None, labelColor=color(FAINT), fontSize=num(9), gridlineColor=color(LINE))
    if y_title:
        val["titleText"] = y_title
    return {"categoryAxis": [obj(**cat)], "valueAxis": [obj(**val)]}


def fill(c):
    return [{"properties": {"fill": color(c)}}]


def wildcard_fill(measure):
    return [{"properties": {"fill": measure_color(measure)}, "selector": {"data": [{"dataViewWildcard": {"matchingOption": 1}}]}}]


def category_colours(entity, prop, mapping):
    return [{"properties": {"fill": color(c)},
             "selector": {"data": [{"scopeId": {"Comparison": {"ComparisonKind": 0, "Left": col(entity, prop),
                                                              "Right": {"Literal": {"Value": f"'{k}'"}}}}}]}}
            for k, c in mapping.items()]


def ref_line(value, label, colour=DARK, axis="y1AxisReferenceLine"):
    v = num(value) if isinstance(value, (int, float)) else {"expr": value}
    return {axis: [obj(selector={"id": "1"}, show=True, value=v, lineColor=color(colour), style="dashed", transparency=num(20), width=num(1),
                       displayName=label, dataLabelShow=True, dataLabelText="Name", dataLabelColor=color(colour),
                       dataLabelHorizontalPosition="right", dataLabelVerticalPosition="above")]}


def table(p, key, x, y, w, h, fields, title, alt, filters=None, sort=None, tooltip=False, font=10, cell_colors=None):
    projs = []
    for f, disp in fields:
        e = f["Column"]["Expression"]["SourceRef"]["Entity"] if "Column" in f else "_Measures"
        pname = f["Column"]["Property"] if "Column" in f else f["Measure"]["Property"]
        pr = {"field": f, "queryRef": f"{e}.{pname}", "nativeQueryRef": pname}
        if disp:
            pr["displayName"] = disp
        projs.append(pr)
    objects = {
        "columnHeaders": [obj(fontColor=color(MUTED), backColor=color(CARD), fontSize=num(font - 1), fontFamily=FONT_SB, wordWrap=True)],
        "values": [obj(fontColorPrimary=color(INK), backColorPrimary=color(CARD), fontColorSecondary=color(INK),
                       backColorSecondary=color("#FAF8F3"), fontSize=num(font))],
        "grid": [obj(gridHorizontal=True, gridHorizontalColor=color(LINE), gridVertical=False, rowPadding=num(0 if font <= 9 else 4), outlineColor=color(LINE))],
        "total": [obj(totals=False)],
    }
    for measure_name, colour_measure in (cell_colors or []):
        objects["values"].append({"properties": {"backColor": measure_color(colour_measure)},
                                  "selector": {"data": [{"dataViewWildcard": {"matchingOption": 1}}], "metadata": f"_Measures.{measure_name}"}})
    vco = {"visualTooltip": tooltip_link()} if tooltip else {}
    return p.add(visual(vname(p, key), "tableEx", x, y, w, h, roles={"Values": projs}, sort=sort, objects=objects,
                        vco=vco, title=title, alt=alt, filters=filters))


def matrix(p, key, x, y, w, h, rows, columns, values, title, alt, colour_measure=None, colour_target=None, filters=None, font=10):
    objects = {"columnHeaders": [obj(fontColor=color(MUTED), backColor=color(CARD), fontSize=num(9), fontFamily=FONT_SB)],
               "rowHeaders": [obj(fontColor=color(INK), backColor=color(CARD), fontSize=num(font), fontFamily=FONT_SB)],
               "values": [obj(fontColorPrimary=color(INK), backColorPrimary=color(CARD), fontColorSecondary=color(INK),
                              backColorSecondary=color(CARD), fontSize=num(font))],
               "grid": [obj(gridHorizontalColor=color(LINE), gridVertical=True, gridVerticalColor=color(CARD), rowPadding=num(0 if font <= 9 else 4))],
               "subTotals": [obj(rowSubtotals=False, columnSubtotals=False)]}
    if colour_measure:
        objects["values"].append({"properties": {"backColor": measure_color(colour_measure)},
                                  "selector": {"data": [{"dataViewWildcard": {"matchingOption": 1}}], "metadata": f"_Measures.{colour_target}"}})
    roles = {"Rows": rows, "Values": values}
    if columns:
        roles["Columns"] = columns
    return p.add(visual(vname(p, key), "pivotTable", x, y, w, h, roles=roles, objects=objects, title=title, alt=alt, filters=filters))


# ---------------------------------------------------------------- pages
def page_home():
    p = Page("home", "Home")
    header(p, None, None)
    p.add(textbox(vname(p, "hero"), 16, 84, 960, 120, [
        [T("Which IPL auction buys earned their price?", 26, INK, True)],
        [T("Every auction buy from 2013 to 2026, scored on runs, wickets and fielding per crore, then rolled up to franchises, roles and price brackets.", 11, MUTED)],
        [T("BDM project · franchise analytics brief for the next auction · prepared by Nabaskar", 9, FAINT)],
    ], alt="Report introduction"))
    kpi_strip(p, [("Total Auction Spend Cr", "Auction spend 2013–2026", 26), ("Players Bought", "Auction buys", 26),
                  ("Avg Auction Price Cr", "Average price per buy", 26), ("Mega 2025 vs 2013", "Price inflation, 2025 vs 2013", 26),
                  ("Spend Matched %", "Spend matched to ball-by-ball data", 26)], y=214)
    cards = [
        ("market", "01", "Auction Market", "How far have prices inflated since 2013?"),
        ("franchise", "02", "Franchise Efficiency", "Who gets the most impact per crore, and does it win?"),
        ("valuemap", "03", "Player Value Map", "Price vs impact for every buy: Stars, Steals, Overpaid"),
        ("steals", "04", "Steals and Overpaid", "Best bargains, worst buys, Bargain XI and Overpaid XI"),
        ("roles", "05", "Role and Nationality", "Are all-rounders and overseas stars worth the premium?"),
        ("brackets", "06", "Price Brackets", "Do base-price buys beat marquee signings per crore?"),
    ]
    cw, ch = 340, 118
    for i, (target, num_, name, desc) in enumerate(cards):
        r, c = divmod(i, 3)
        x, y = CX + c * (cw + 10), 312 + r * (ch + 12)
        panel(p, f"card{i}", x, y, cw, ch, transparency=5, runs=[[T(num_, 10, "#B8901C", True)], [T(name, 15, INK, True)], [T(desc, 10, MUTED)]],
              alt=f"Page card: {name}. {desc}")
        button(p, f"go{i}", x, y, cw, ch, "", target, transparent=True, alt=f"Open page {name}")
    p.add(textbox(vname(p, "hint"), CX, 576, 1040, 40, [[
        T("Tip  ", 9, "#B8901C", True),
        T("Ctrl+click a card or pill in Desktop. On pages 3 and 4, right-click any player → Drill through → Player Profile.", 9, MUTED)]],
        alt="Navigation tip"))
    panel(p, "questions", LX, 312, LW, 392, fill=DARK, transparency=0, border=False, runs=[
        [T("Questions answered", 11, "#FFFFFF", True)], [T(" ", 6)],
        [T("✔  ", 10, YELLOW, True), T("Most impact per crore", 10, "#E9E6DF")],
        [T("✔  ", 10, YELLOW, True), T("Best bargains & worst buys", 10, "#E9E6DF")],
        [T("✔  ", 10, YELLOW, True), T("Does efficiency win matches?", 10, "#E9E6DF")],
        [T("✔  ", 10, YELLOW, True), T("Roles & overseas premium", 10, "#E9E6DF")],
        [T("✔  ", 10, YELLOW, True), T("Price inflation since 2013", 10, "#E9E6DF")],
        [T("✔  ", 10, YELLOW, True), T("Base-price vs marquee buys", 10, "#E9E6DF")],
    ], alt="List of the six business questions this report answers")
    return p


def page_market():
    p = Page("market", "1 Auction Market")
    header(p, F["market_title"], "Q5 · How much have auction prices inflated since 2013, and does a high price predict high output?")
    kpi_strip(p, [("Total Auction Spend Cr", "Auction spend 2013–2026"), ("Avg Auction Price Cr", "Average price per buy"),
                  ("Mega 2025 vs 2013", "2025 mega auction vs 2013"), ("Avg Price vs 2013", f"{LATEST} auction vs 2013"),
                  ("Top Buy Price Cr", "Highest price ever paid"), ("Auction Premium %", "Paid above base (2025–26)")])
    panel(p, "note", LX, TOP, LW, 268, transparency=35, runs=[
        [T("Reading the page", 10, INK, True)], [T(" ", 5)],
        [T("Charcoal bars mark mega-auction seasons (2014, 2018, 2022, 2025), when every squad is rebuilt and prices jump.", 9, MUTED)],
        [T(" ", 5)],
        [T("2013 prices were in US$ and are converted at ₹54/$. Base prices exist only for the 2025 and 2026 auctions.", 9, MUTED)]],
        alt="How to read this page")
    so_what(p, F["market_sowhat"])
    p.add(visual(vname(p, "infl"), "clusteredColumnChart", CX, TOP, 640, 252,
                 roles={"Category": [col("DimSeason", "Season")], "Y": [meas("Avg Auction Price Cr")], "Tooltips": [meas("Players Bought")]},
                 sort=[(col("DimSeason", "Season"), "Ascending")],
                 objects={**axes(cat_type="Categorical"), "dataPoint": wildcard_fill("Season Bar Colour"), "labels": dark_labels(8)},
                 title="Average auction price per buy (₹ Cr) · charcoal = mega auction",
                 alt="Column chart of average auction price by season, 2013 to 2026; mega-auction seasons are charcoal, other seasons yellow"))
    p.add(visual(vname(p, "spend"), "columnChart", CX, TOP + 262, 640, BOTTOM - TOP - 262,
                 roles={"Category": [col("DimSeason", "Season")], "Y": [meas("Total Auction Spend Cr")], "Series": [col("DimPlayer", "Role")]},
                 sort=[(col("DimSeason", "Season"), "Ascending")],
                 objects={**axes(cat_type="Categorical"), "legend": [obj(show=True, position="Top", labelColor=color(MUTED))],
                          "dataPoint": category_colours("DimPlayer", "Role", {"Batter": DARK, "Bowler": YELLOW, "All-Rounder": "#B5B0A5",
                                                                               "Wicket-Keeper": "#6E6A62", "Unknown": "#E4E0D6"})},
                 title="Total auction spend by season and role (₹ Cr)",
                 alt="Stacked column chart of total auction spend by season split by player role"))
    table(p, "top", CX + 652, TOP, CW - 652, BOTTOM - TOP,
          [(col("DimSeason", "Season"), "Season"), (meas("Top Buy Player"), "Most expensive buy"), (meas("Top Buy Price Cr"), "Price")],
          "Most expensive buy each season", "Table of the most expensive auction buy in each season with team and price",
          sort=[(col("DimSeason", "Season"), "Descending")], font=10)
    return p


def page_franchise():
    p = Page("franchise", "2 Franchise Efficiency")
    header(p, F["franchise_title"], "Q1 · Which franchise gets the most impact per crore?   Q3 · Do franchises that spend efficiently win more?")
    kpi_strip(p, [("Spend Cr", "Auction spend in squads"), ("Priced Impact", "Impact Points from priced buys"),
                  ("Lakh per Point", "₹ lakh per Impact Point"), ("Best Team Label", "Best Value Index", 18), ("Worst Team Label", "Worst Value Index", 18)])
    side_panel(p, h=170)
    season_slicer(p)
    list_slicer(p, "team", TOP + 84, col("DimTeam", "TeamName"), "Franchise")
    so_what(p, F["franchise_sowhat"], y=372)
    p.add(visual(vname(p, "vi"), "clusteredColumnChart", CX, TOP, 520, 226,
                 roles={"Category": [col("DimTeam", "ShortCode")], "Y": [meas("Value Index")], "Tooltips": [meas("Spend Cr"), meas("Priced Impact"), meas("Lakh per Point")]},
                 sort=[(meas("Value Index"), "Descending")],
                 objects={**axes(), "dataPoint": wildcard_fill("Team Colour"), "labels": dark_labels(8), **ref_line(1, "Fair value 1.00")},
                 title="Value Index by franchise · 1.00 = fair value",
                 alt="Column chart of Value Index by franchise for the selected seasons in team colours, with a dashed line at fair value 1.00"))
    p.add(visual(vname(p, "scatter"), "scatterChart", CX + 530, TOP, CW - 530, 226,
                 roles={"Category": [col("DimTeamSeason", "TeamSeasonLabel")], "X": [meas("Spend Cr")], "Y": [meas("Win %")],
                        "Size": [meas("Priced Impact")], "Tooltips": [meas("Value Index")]},
                 objects={**axes("Auction spend on squad (₹ Cr)", "Win %"), "dataPoint": wildcard_fill("Team Season Colour"),
                          "categoryLabels": [obj(show=False)], "bubbles": [obj(bubbleSize=num(-10))],
                          "trend": [obj(selector={"id": "1"}, show=True, lineColor=color(DARK), style="dashed", transparency=num(30))]},
                 title="Does money buy wins? One dot per team-season, all seasons",
                 alt="Scatter chart with one dot per franchise season: auction spend across, win percentage up, dot size is priced Impact Points, with a dashed trend line"))
    matrix(p, "matrix", CX, TOP + 236, CW, BOTTOM - TOP - 236, [col("DimTeam", "ShortCode")], [col("DimSeason", "Season")], [meas("Lakh per Point")],
           "₹ lakh paid per Impact Point · green = cheaper than that season's league rate, red = dearer",
           "Matrix of franchises by season showing lakh rupees paid per Impact Point, green when cheaper than the league rate that season and red when dearer",
           colour_measure="Lakh per Point Colour", colour_target="Lakh per Point", font=9)
    p.interactions = [{"source": vname(p, "season"), "target": vname(p, "scatter"), "type": "NoFilter"},
                      {"source": vname(p, "season"), "target": vname(p, "matrix"), "type": "NoFilter"}]
    return p


def page_valuemap():
    p = Page("valuemap", "3 Player Value Map")
    header(p, F["valuemap_title"], "Q2 · Price vs Impact Points for every auction buy in the season. Hover for the player card; right-click → Drill through → Player Profile.")
    kpi_strip(p, [("Priced Player Seasons", "Auction-priced players"), ("Steal Count", "Steals"), ("Overpaid Count", "Overpaid"),
                  ("Median Priced Price Cr", "Median price"), ("Median Priced Impact", "Median Impact Points"), ("Top Steal Label", "Best Value Index", 16)])
    side_panel(p, h=330)
    season_slicer(p, multi=False)
    list_slicer(p, "team", TOP + 84, col("DimTeam", "TeamName"), "Franchise")
    list_slicer(p, "role", TOP + 158, col("DimPlayer", "Role"), "Role")
    list_slicer(p, "nat", TOP + 232, col("DimPlayer", "Nationality"), "Nationality")
    so_what(p, F["valuemap_sowhat"], y=532)
    priced = filter_in(col("FactPlayerSeason", "PriceSource"), ["Auction"], vname(p, "pricedf"))
    p.add(visual(vname(p, "scatter"), "scatterChart", CX, TOP, 700, BOTTOM - TOP,
                 roles={"Category": [col("DimPlayer", "PlayerName")], "Series": [col("FactPlayerSeason", "Value Quadrant")],
                        "X": [meas("Spend Cr")], "Y": [meas("Priced Impact")], "Tooltips": [meas("Value Index"), meas("Player Matches")]},
                 objects={**axes("Auction price (₹ Cr)", "Impact Points"),
                          "dataPoint": category_colours("FactPlayerSeason", "Value Quadrant", QUADRANT_COLOURS),
                          "legend": [obj(show=True, position="Top", labelColor=color(MUTED))],
                          "categoryLabels": [obj(show=False)], "bubbles": [obj(bubbleSize=num(-4))],
                          **ref_line(meas("Median Priced Price Cr"), "Median price", MUTED, "xAxisReferenceLine"),
                          **ref_line(meas("Median Priced Impact"), "Median impact", MUTED)},
                 vco={"visualTooltip": tooltip_link()},
                 title="Price vs Impact Points · dashed lines = season medians",
                 alt="Scatter chart with one dot per auction-bought player in the selected season: price across, Impact Points up, coloured by value quadrant, with dashed median lines",
                 filters=[priced]))
    table(p, "mix", CX + 710, TOP, CW - 710, 214,
          [(col("FactPlayerSeason", "Value Quadrant"), "Quadrant"), (meas("Player Seasons"), "Players"), (meas("Spend Cr"), "Spend")],
          "Quadrant mix", "Table of the number of players and spend in each value quadrant",
          filters=[filter_in(col("FactPlayerSeason", "PriceSource"), ["Auction"], vname(p, "pricedf2"))],
          sort=[(col("FactPlayerSeason", "Value Quadrant"), "Ascending")],
          cell_colors=[("Player Seasons", "Quadrant Colour")])
    table(p, "best", CX + 710, TOP + 224, CW - 710, BOTTOM - TOP - 224,
          [(col("DimPlayer", "PlayerName"), "Player"), (meas("Spend Cr"), "Price"), (meas("Value Index (min 5 matches)"), "VI")],
          "Best Value Index this season", "Table of the players with the highest Value Index in the selected season",
          filters=[filter_measure_cmp(meas("Steal Rank"), "LessThanOrEqual", 10, vname(p, "rankf"))],
          sort=[(meas("Value Index (min 5 matches)"), "Descending")], tooltip=True)
    return p


def page_steals():
    p = Page("steals", "4 Steals and Overpaid")
    header(p, F["steals_title"], "Q2 · Best bargains and worst buys of the season (min 5 matches). Right-click a name → Drill through → Player Profile.")
    top = 130
    side_panel(p, y=top, h=84)
    season_slicer(p, y=top + 10, multi=False)
    table(p, "unsold", LX, top + 94, LW, 232,
          [(col("UnsoldPlayers", "Player"), "Unsold in 2026"), (meas("Unsold Career Impact"), "IPL pts")],
          None, "Table of the most productive IPL players who went unsold at the 2026 auction, by career Impact Points",
          filters=[filter_measure_cmp(meas("Unsold Rank"), "LessThanOrEqual", 7, vname(p, "unsf"))],
          sort=[(meas("Unsold Career Impact"), "Descending")], font=9)
    so_what(p, F["steals_sowhat"], y=top + 336)
    half = (CW - 10) // 2
    h1 = 280
    compact = dict(tooltip=True, font=9)
    table(p, "steals", CX, top, half, h1,
          [(col("DimPlayer", "PlayerName"), "Player"), (meas("Teams Played For"), "Team"), (meas("Spend Cr"), "Price"),
           (meas("Priced Impact"), "Impact"), (meas("Lakh per Point"), "₹L/pt"), (meas("Value Index (min 5 matches)"), "Value Index")],
          "Top 10 steals · highest Value Index", "Table of the ten players with the highest Value Index in the selected season, minimum five matches",
          filters=[filter_measure_cmp(meas("Steal Rank"), "LessThanOrEqual", 10, vname(p, "sf"))],
          sort=[(meas("Value Index (min 5 matches)"), "Descending")], cell_colors=[("Value Index (min 5 matches)", "Steal Colour")], **compact)
    table(p, "overpaid", CX + half + 10, top, half, h1,
          [(col("DimPlayer", "PlayerName"), "Player"), (meas("Teams Played For"), "Team"), (meas("Spend Cr"), "Price"),
           (meas("Priced Impact"), "Impact"), (meas("Lakh per Point"), "₹L/pt"), (meas("Overpay Cr"), "Overpaid by")],
          "Top 10 overpaid · price above output value", "Table of the ten players whose price most exceeded the value of their output, minimum five matches",
          filters=[filter_measure_cmp(meas("Overpaid Rank"), "LessThanOrEqual", 10, vname(p, "of"))],
          sort=[(meas("Overpay Cr"), "Descending")], cell_colors=[("Overpay Cr", "Overpaid Colour")], **compact)
    y2 = top + h1 + 10
    table(p, "bxi", CX, y2, half, BOTTOM - y2,
          [(col("DimPlayer", "Role"), "Role"), (col("DimPlayer", "PlayerName"), "Player"), (meas("Spend Cr"), "Price"), (meas("Value Index"), "VI")],
          "Bargain XI · 4 batters, 1 keeper, 2 all-rounders, 4 bowlers", "Table listing the Bargain XI: best Value Index per role in the selected season",
          filters=[filter_measure_cmp(meas("Bargain XI Flag"), "Equal", 1, vname(p, "bf"))],
          sort=[(col("DimPlayer", "Role"), "Ascending")], **compact)
    table(p, "oxi", CX + half + 10, y2, half, BOTTOM - y2,
          [(col("DimPlayer", "Role"), "Role"), (col("DimPlayer", "PlayerName"), "Player"), (meas("Spend Cr"), "Price"), (meas("Overpay Cr"), "Overpaid by")],
          "Overpaid XI · biggest gap between price and output", "Table listing the Overpaid XI: players per role whose price most exceeded their output",
          filters=[filter_measure_cmp(meas("Overpaid XI Flag"), "Equal", 1, vname(p, "xf"))],
          sort=[(col("DimPlayer", "Role"), "Ascending")], **compact)
    return p


def page_roles():
    p = Page("roles", "5 Role and Nationality")
    header(p, F["roles_title"], "Q4 · Are batters, bowlers, all-rounders or keepers over- or under-priced? Do overseas players earn their premium?")
    kpi_strip(p, [("Overseas Price Premium %", "Overseas price premium"), ("Overseas Value Index", "Overseas Value Index"),
                  ("Indian Value Index", "Indian Value Index"), ("Best Role Label", "Best-value role", 18), ("Players Bought", "Auction buys")])
    side_panel(p, h=84)
    season_slicer(p)
    so_what(p, F["roles_sowhat"], y=TOP + 94)
    flt = [filter_in(col("DimPlayer", "Nationality"), ["Indian", "Overseas"], vname(p, "natf")),
           filter_in(col("DimPlayer", "Role"), ["Batter", "Bowler", "All-Rounder", "Wicket-Keeper"], vname(p, "rolef"))]
    nat = category_colours("DimPlayer", "Nationality", {"Indian": DARK, "Overseas": YELLOW})
    half = (CW - 10) // 2
    p.add(visual(vname(p, "price"), "clusteredBarChart", CX, TOP, half, 252,
                 roles={"Category": [col("DimPlayer", "Role")], "Series": [col("DimPlayer", "Nationality")], "Y": [meas("Avg Auction Price Cr")]},
                 sort=[(meas("Avg Auction Price Cr"), "Descending")],
                 objects={**axes(), "dataPoint": nat, "labels": dark_labels(8), "legend": [obj(show=True, position="Top", labelColor=color(MUTED))]},
                 title="Average auction price by role (₹ Cr)", alt="Clustered bar chart of average auction price by role, Indian versus overseas", filters=flt))
    p.add(visual(vname(p, "vi"), "clusteredBarChart", CX + half + 10, TOP, half, 252,
                 roles={"Category": [col("DimPlayer", "Role")], "Series": [col("DimPlayer", "Nationality")], "Y": [meas("Value Index")]},
                 sort=[(meas("Value Index"), "Descending")],
                 objects={**axes(), "dataPoint": nat, "labels": dark_labels(8), "legend": [obj(show=True, position="Top", labelColor=color(MUTED))],
                          **ref_line(1, "Fair value")},
                 title="Value Index by role · 1.00 = fair value",
                 alt="Clustered bar chart of Value Index by role, Indian versus overseas, with a dashed fair-value line at 1.00", filters=flt))
    matrix(p, "matrix", CX, TOP + 262, CW, BOTTOM - TOP - 262, [col("DimPlayer", "Role")], [col("DimPlayer", "Nationality")],
           [meas("Lakh per Point"), meas("Spend Cr"), meas("Player Seasons")],
           "₹ lakh per Impact Point by role and nationality · green = cheaper than league rate",
           "Matrix of role by nationality showing lakh rupees per Impact Point, spend and player-seasons",
           colour_measure="Lakh per Point Colour", colour_target="Lakh per Point", filters=flt)
    return p


def page_brackets():
    p = Page("brackets", "6 Price Brackets")
    header(p, F["brackets_title"], "Q6 · How often do base-price and cheap buys outperform expensive marquee signings, per crore?")
    kpi_strip(p, [("Base Price Value Index", "Base-price buys · Value Index"), ("Marquee Value Index", "₹10 Cr+ buys · Value Index"),
                  ("Base Price Above Median %", "Base-price buys beating median impact"), ("Marquee Above Median %", "₹10 Cr+ buys beating median impact"),
                  ("Base Price Buys", "Base-price buys")])
    side_panel(p, h=84)
    season_slicer(p)
    so_what(p, F["brackets_sowhat"], y=TOP + 94)
    priced = [filter_in(col("FactPlayerSeason", "PriceSource"), ["Auction"], vname(p, "pf"))]
    half = (CW - 10) // 2
    p.add(visual(vname(p, "vi"), "clusteredColumnChart", CX, TOP, half, 262,
                 roles={"Category": [col("FactPlayerSeason", "PriceBracket")], "Y": [meas("Value Index")], "Tooltips": [meas("Spend Cr"), meas("Priced Impact")]},
                 sort=[(col("FactPlayerSeason", "PriceBracket"), "Ascending")],
                 objects={**axes(), "dataPoint": fill(YELLOW), "labels": dark_labels(9), **ref_line(1, "Fair value")},
                 title="Value Index by price bracket · 1.00 = fair value",
                 alt="Column chart of Value Index by price bracket from base-price buys to 10 crore and above", filters=priced))
    p.add(visual(vname(p, "mix"), "hundredPercentStackedBarChart", CX + half + 10, TOP, half, 262,
                 roles={"Category": [col("FactPlayerSeason", "PriceBracket")], "Series": [col("FactPlayerSeason", "Value Quadrant")], "Y": [meas("Player Seasons")]},
                 sort=[(col("FactPlayerSeason", "PriceBracket"), "Ascending")],
                 objects={**axes(), "dataPoint": category_colours("FactPlayerSeason", "Value Quadrant", QUADRANT_COLOURS),
                          "legend": [obj(show=True, position="Top", labelColor=color(MUTED))],
                          "labels": [obj(show=True, color=color(INK), fontSize=num(8), enableBackground=False)]},
                 title="Value quadrant mix within each bracket (% of player-seasons)",
                 alt="100 percent stacked bar chart of value quadrant mix within each price bracket", filters=priced))
    table(p, "tbl", CX, TOP + 272, CW, BOTTOM - TOP - 272,
          [(col("FactPlayerSeason", "PriceBracket"), "Price bracket"), (meas("Player Seasons"), "Player-seasons"), (meas("Spend Cr"), "Spend"),
           (meas("Priced Impact"), "Impact Points"), (meas("Impact per Match"), "Impact / match"), (meas("Lakh per Point"), "₹ lakh per point"),
           (meas("Above Median Impact %"), "Beat median impact"), (meas("Value Index"), "Value Index")],
          "Bracket scorecard", "Table comparing price brackets on player-seasons, spend, impact, lakh per point, share above median impact and Value Index",
          filters=priced, sort=[(col("FactPlayerSeason", "PriceBracket"), "Ascending")], font=11)
    return p


def page_profile():
    p = Page("profile", "7 Player Profile", hidden=True)
    f = col("DimPlayer", "PlayerName")
    p.filters = [{"name": "profile_drill", "field": f, "type": "Categorical", "howCreated": "Drillthrough",
                  "filter": filter_in(f, [F["profile_default_player"]], "profile_drill")["filter"]}]
    p.binding = {"name": "profile_binding", "type": "Drillthrough", "referenceScope": "Default",
                 "parameters": [{"name": "profile_param", "boundFilter": "profile_drill", "fieldExpr": f}]}
    header(p, "Player Profile: every season's price against what the player delivered",
           "Drill-through page · right-click a player on pages 3 or 4 → Drill through. Use ← Back to return.")
    button(p, "back", LX, TOP, LW, 40, "← Back", None, fill=DARK, font_colour="#FFFFFF", font=10, bold=True, back=True,
           alt="Back button: return to the previous page")
    kpi_strip(p, [("Selected Player", "Player", 18), ("Selected Role", "Role", 18), ("Selected Nationality", "Nationality", 18),
                  ("Teams Played For", "Teams played for", 18), ("Career Value Index", "Career Value Index"), ("Career Spend Cr", "Career auction spend")])
    panel(p, "legend", LX, TOP + 50, LW, 280, transparency=35, runs=[
        [T("How to read", 10, INK, True)], [T(" ", 5)],
        [T("Bars = auction price that season (carried forward until the next auction or mega auction).", 9, MUTED)], [T(" ", 4)],
        [T("Line = Impact Points scored that season.", 9, MUTED)], [T(" ", 4)],
        [T("Unpriced = retained or traded that season, so excluded from value measures.", 9, MUTED)]], alt="How to read the profile")
    p.add(visual(vname(p, "combo"), "lineClusteredColumnComboChart", CX, TOP, 560, BOTTOM - TOP,
                 roles={"Category": [col("DimSeason", "Season")], "Y": [meas("Spend Cr")], "Y2": [meas("Impact Points")]},
                 sort=[(col("DimSeason", "Season"), "Ascending")],
                 objects={**axes(None, "Price (₹ Cr)", "Categorical"),
                          "dataPoint": [{"properties": {"fill": measure_color("Spend Bar Colour")},
                                         "selector": {"data": [{"dataViewWildcard": {"matchingOption": 1}}], "metadata": "_Measures.Spend Cr"}},
                                        {"properties": {"fill": color(DARK)}, "selector": {"metadata": "_Measures.Impact Points"}}],
                          "labels": dark_labels(8), "legend": [obj(show=True, position="Top", labelColor=color(MUTED))]},
                 vco={"visualTooltip": tooltip_link()},
                 title="Price paid (bars) vs Impact Points (line) by season",
                 alt="Combo chart of the player's auction price by season as columns and Impact Points by season as a line"))
    table(p, "seasons", CX + 570, TOP, CW - 570, BOTTOM - TOP,
          [(col("DimSeason", "Season"), "Season"), (meas("Teams Played For"), "Team"), (meas("Player Matches"), "M"), (meas("Runs"), "Runs"),
           (meas("Strike Rate"), "SR"), (meas("Wickets"), "Wkts"), (meas("Economy"), "Econ"), (meas("Catches"), "Ct"),
           (meas("Value Quadrant Label"), "Quadrant"), (meas("Value Index"), "VI")],
          "Season by season", "Table of the player's season-by-season matches, runs, strike rate, wickets, economy, catches, quadrant and Value Index",
          sort=[(col("DimSeason", "Season"), "Descending")], font=9)
    return p


def page_methodology():
    p = Page("methodology", "8 Methodology")
    header(p, "Methodology: one score for bat, ball and field, judged against each season's market",
           "Sources, the Impact Points weights, the contract rule, the analysis window and the limits of this analysis")
    kpi_strip(p, [("Seasons Covered", "Seasons analysed"), ("QA Matches", "Matches parsed"), ("Players Bought", "Auction buys"),
                  ("Players In Data", "Players in the model"), ("Spend Matched %", "Spend matched to Cricsheet")])

    def S(t):
        return T(t, 9, INK)

    def Hd(t):
        return T(t, 11, INK, True)

    def Mu(t):
        return T(t, 8, MUTED)

    gap = [T(" ", 4)]
    panel(p, "sources", LX, TOP, 400, BOTTOM - TOP, transparency=5, runs=[
        [Hd("Data sources")], gap,
        [S("Auction prices 2013–2026 · Kaggle IPL Auction Dataset (sunnyyadav754), one CSV per auction.")],
        [Mu("kaggle.com/datasets/sunnyyadav754/ipl-auction-dataset-20132026")], gap,
        [S("Ball-by-ball, playing XIs, results · Cricsheet IPL JSON, 1,243 matches (updated Oct 2026). Used instead of the Kaggle ball-by-ball CSV because that file has no fielder column.")],
        [Mu("cricsheet.org/downloads")], gap,
        [S("Name matching · Cricsheet Register (people.csv, names.csv).")], [Mu("cricsheet.org/register")], gap,
        [S("Role and Indian/Overseas fill-in · Kaggle IPL Player Auction Dataset 2013–2022 (kalilurrahman) and the official TATA IPL 2025 auction list.")], gap,
        [S("2026 unsold players · Wisden IPL 2026 unsold list.")], gap,
        [S("Hand-made · team_map.csv (franchise renames) and name_fixes.csv (manual name matches).")], gap,
        [Hd("Analysis window")], gap,
        [S("Seasons 2013–2026 (14 seasons, 921 matches). 2008–2012 are out: no auction price data. Super overs excluded.")],
    ], alt="Data sources and analysis window")
    panel(p, "weights", LX + 410, TOP, 410, BOTTOM - TOP, transparency=5, runs=[
        [Hd("Impact Points (fantasy-style weights)")], gap,
        [S("Run scored · 1      Four (bonus) · 1      Six (bonus) · 2")],
        [S("Wicket (credited to bowler) · 25      Dot ball · 1")],
        [S("Catch · 8      Stumping · 12      Run-out involvement · 6")],
        [Mu("One scale for batters, bowlers and keepers, so they sit on the same chart.")], gap,
        [Hd("Value Index")], gap,
        [S("(share of league Impact Points) ÷ (share of league auction spend), computed season by season and summed. 1.00 = fair value; above 1 = more output than the money suggests. Only auction-priced player-seasons count.")], gap,
        [Hd("Value quadrant")], gap,
        [S("Each priced player-season vs that season's median price and median Impact Points → Star, Steal, Overpaid, Passenger. Under 5 matches = Too few matches.")], gap,
        [Hd("Overpay")], gap,
        [S("Price minus fair value, where fair value = Impact Points × the league's ₹ per point that season.")],
    ], alt="Impact Points weights and Value Index definition")
    panel(p, "rules", LX + 830, TOP, W - LX - 830 - 16, BOTTOM - TOP, transparency=5, runs=[
        [Hd("Contract carry-forward rule")], gap,
        [S("A price covers the auction season and later seasons until the earliest of: the player's next auction − 1, the next mega auction − 1 (2014, 2018, 2022, 2025), or 2026. Later seasons count only while the player still plays for that team.")], gap,
        [Hd("Assumptions and limits")], gap,
        [S("• Retained, traded and replacement players have no auction price: 'Unpriced', excluded from value measures.")],
        [S("• 2013 prices in US$, converted at ₹54/$ (parameter UsdInrRate2013).")],
        [S("• Base prices exist only for 2025–26; earlier, a buy at that era's minimum base (₹10/20 lakh) counts as base-price.")],
        [S("• " + F["matched_text"])],
        [S("• Matches = playing-XI appearances (Cricsheet), incl. impact-player substitutes.")],
        [S("• The weights are a judgement call; the runs-only and wickets-only measures tell the same story at the top of the tables.")],
    ], alt="Contract rule, assumptions and limitations")
    return p


def page_tooltip():
    p = Page("tooltip", "Player Tooltip", hidden=True, width=320, height=240, ptype="Tooltip")
    f = col("DimPlayer", "PlayerName")
    p.filters = [{"name": "tooltip_player", "field": f, "type": "Categorical", "howCreated": "Drillthrough"}]
    p.binding = {"name": "tooltip_binding", "type": "Tooltip",
                 "parameters": [{"name": "tooltip_param", "boundFilter": "tooltip_player", "fieldExpr": f}]}
    panel(p, "bg", 0, 0, 320, 240, transparency=0, radius=16, alt="Tooltip background")
    items = [("Selected Player", "Player"), ("Selected Role", "Role"), ("Spend Cr", "Price"),
             ("Priced Impact", "Impact Points"), ("Value Quadrant Label", "Quadrant"), ("Value Index", "Value Index")]
    for i, (m, lbl) in enumerate(items):
        rr, c = divmod(i, 2)
        kpi(p, f"t{i}", 10 + c * 152, 10 + rr * 74, 146, m, lbl, size=13, h=68)
    return p


def page_qa():
    p = Page("qa", "QA Checks", hidden=True)
    header(p, "QA checks (hidden page): every headline number re-checked on refresh", "PRD section 9 · expected values in brackets")
    kpi_strip(p, [("QA 2026 Buys", "2026 buys (77)"), ("QA 2026 Spend Cr", "2026 spend (~₹215 Cr)"), ("Top Buy Price Cr", "Max price (₹27 Cr, Pant)"),
                  ("QA Bad Prices", "Null/zero prices (0)"), ("Spend Matched %", "Spend matched (≥95%)"), ("QA Unmapped Team Rows", "Unmapped team rows (0)"),
                  ("QA Contract Rows Beyond Mega", "Contract rows past mega (0)")])
    table(p, "matches", LX, TOP, 400, BOTTOM - TOP,
          [(col("DimSeason", "Season"), "Season"), (meas("QA Matches"), "Matches"), (meas("QA League Value Index"), "League VI (1.00)"), (meas("QA Avg Win %"), "Avg win % (~50%)")],
          "Matches, league Value Index and win % by season", "QA table of matches per season, league Value Index and average win percentage",
          sort=[(col("DimSeason", "Season"), "Ascending")])
    table(p, "caps", LX + 410, TOP, 600, BOTTOM - TOP,
          [(col("DimSeason", "Season"), "Season"), (meas("Top Run Scorer"), "Orange Cap"), (meas("Top Run Scorer Runs"), "Runs"),
           (meas("Top Wicket Taker"), "Purple Cap"), (meas("Top Wicket Taker Wickets"), "Wkts")],
          "Orange and Purple Cap check (compare with iplt20.com)", "QA table of the top run scorer and top wicket taker each season",
          sort=[(col("DimSeason", "Season"), "Ascending")])
    panel(p, "keys", LX + 1020, TOP, W - LX - 1020 - 16, BOTTOM - TOP, transparency=5, runs=[
        [T("Team keys expected", 10, INK, True)], [T("CSK, DC, GL, GT, KKR, LSG, MI, PBKS, PWI, RCB, RPS, RR, SRH", 9, MUTED)]], alt="Expected team keys")
    kpi(p, "teamkeys", LX + 1030, TOP + 90, W - LX - 1030 - 26, "QA Team Keys", "Team keys in data", size=10, h=120)
    return p


def build():
    rp = write_scaffold(PROJECT, [pid for pid, *_ in PAGES], "home", os.path.join(HERE, "assets", "CY24SU10.json"), os.path.join(HERE, "assets"))
    pages = [page_home(), page_market(), page_franchise(), page_valuemap(), page_steals(), page_roles(), page_brackets(),
             page_profile(), page_methodology(), page_tooltip(), page_qa()]
    for pg in pages:
        pg.write(rp)
    print("report written:", rp, "pages:", len(pages), "visuals:", sum(len(pg.visuals) for pg in pages))


if __name__ == "__main__":
    build()
