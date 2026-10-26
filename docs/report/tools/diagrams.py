"""Draw the report's diagrams (star schema, system architecture) and crop tall web screenshots.

Usage (from repo root):  .venv/Scripts/python -I docs/report/tools/diagrams.py
"""
import os
from PIL import Image, ImageDraw, ImageFont

A = "docs/report/assets"
F = "C:/Windows/Fonts/"
def font(size, bold=False):
    return ImageFont.truetype(F + ("segoeuib.ttf" if bold else "segoeui.ttf"), size)

INK, MUTED, LINE, YELLOW, DARK, CARD = "#1A1A1A", "#6E6A62", "#BDB6A6", "#F2C94C", "#262626", "#FFFFFF"

def box(d, xy, title, lines, fill=CARD, title_fill=INK, outline=LINE, head=None):
    x0, y0, x1, _ = xy
    y1 = y0 + 72 + len(lines) * 32 + 18
    xy = (x0, y0, x1, y1)
    d.rounded_rectangle(xy, radius=18, fill=fill, outline=outline, width=3)
    if head:
        d.rounded_rectangle((x0, y0, x1, y0 + 54), radius=18, fill=head)
        d.rectangle((x0, y0 + 30, x1, y0 + 54), fill=head)
    d.text(((x0 + x1) / 2, y0 + 27), title, font=font(26, True), fill=title_fill, anchor="mm")
    for i, t in enumerate(lines):
        d.text((x0 + 22, y0 + 72 + i * 32), t, font=font(21), fill=MUTED)
    return xy

def arrow(d, a, b, colour=MUTED, width=4, head=14):
    import math
    d.line([a, b], fill=colour, width=width)
    ang = math.atan2(b[1] - a[1], b[0] - a[0])
    p1 = (b[0] - head * math.cos(ang - 0.45), b[1] - head * math.sin(ang - 0.45))
    p2 = (b[0] - head * math.cos(ang + 0.45), b[1] - head * math.sin(ang + 0.45))
    d.polygon([b, p1, p2], fill=colour)

def star_schema():
    W, H = 2000, 900
    im = Image.new("RGB", (W, H), "white"); d = ImageDraw.Draw(im)
    b = {}
    b["DimPlayer"] = box(d, (80, 40, 620, 0), "DimPlayer", ["778 players (Cricsheet ID)", "role, nationality, display name"], head="#ECE8DF")
    b["DimSeason"] = box(d, (1380, 40, 1920, 0), "DimSeason", ["14 seasons, 2013–2026", "mega / mini auction flag"], head="#ECE8DF")
    b["FactAuction"] = box(d, (80, 340, 560, 0), "FactAuction", ["1,380 auction buys", "price, base price, match pass"], head=YELLOW)
    b["Fact"] = box(d, (700, 320, 1300, 0), "FactPlayerSeason", ["player × season × team · 2,910 rows", "runs, wickets, catches, Impact Points", "PriceCr, PriceSource, Value Quadrant"], head=YELLOW)
    b["FactTeamMatch"] = box(d, (1440, 340, 1920, 0), "FactTeamMatch", ["1,842 team × match rows", "Won, NoResult"], head=YELLOW)
    b["DimTeam"] = box(d, (80, 640, 620, 0), "DimTeam", ["13 franchises (incl. defunct)", "name, colour, active flag"], head="#ECE8DF")
    b["DimTeamSeason"] = box(d, (1380, 640, 1920, 0), "DimTeamSeason", ["123 franchise-seasons", "bridge for team facts"], head="#ECE8DF")
    F_ = b["Fact"]
    arrow(d, (620, 150), (760, F_[1])); arrow(d, (1380, 150), (1240, F_[1]))
    arrow(d, (620, 720), (760, F_[3])); arrow(d, (1380, 720), (1240, F_[3]))
    arrow(d, (330, b["DimPlayer"][3]), (320, 340)); arrow(d, (1670, b["DimSeason"][3]), (1680, 340))
    arrow(d, (330, 640), (320, b["FactAuction"][3])); arrow(d, (1670, 640), (1680, b["FactTeamMatch"][3]))
    d.text((W / 2, 865), "Arrows run from the dimension (one) to the fact (many); every filter flows one way.", font=font(24), fill=MUTED, anchor="mm")
    im.save(f"{A}/diagram_star_schema.png")

def architecture():
    W, H = 2200, 700
    im = Image.new("RGB", (W, H), "white"); d = ImageDraw.Draw(im)
    top, bot = 110, 430
    box(d, (40, top, 460, 0), "Raw data", ["14 auction CSVs (2013–2026)", "1,243 Cricsheet match JSON", "Cricsheet register", "mappings, supplementary"], head="#ECE8DF")
    pm = box(d, (580, top, 1060, 0), "Power BI model", ["Power Query cleaning +", "6-pass name matching", "star schema, 93 DAX measures", "QA checks"], head=YELLOW)
    box(d, (580, bot, 1060, 0), "Power BI report", ["9 pages + profile + tooltip", "PDF export", "single-file .pbix"], head=YELLOW)
    box(d, (1180, top, 1640, 0), "data/processed", ["8 tables, CSV + JSON", "metrics pre-computed", "(DAX export)"], head="#ECE8DF")
    mg = box(d, (1760, top, 2160, 0), "MongoDB Atlas", ["8 collections", "7,139 documents", "M0 cluster, Mumbai"], head="#C7E8CF")
    box(d, (1760, bot, 2160, 0), "Vercel", ["React + Vite client (static)", "Express API as", "serverless function /api"], head=DARK, title_fill="white")
    box(d, (1180, bot, 1640, 0), "Users / evaluators", ["browser: dashboard pages,", "player profiles,", "Squad Builder"], head="#ECE8DF")
    y = top + 120
    arrow(d, (460, y), (580, y)); arrow(d, (1060, y), (1180, y)); arrow(d, (1640, y), (1760, y))
    arrow(d, (820, pm[3]), (820, bot)); arrow(d, (1960, mg[3]), (1960, bot)); arrow(d, (1760, bot + 110), (1640, bot + 110))
    d.text((1120, y - 22), "export", font=font(20), fill=MUTED, anchor="mm")
    d.text((1700, y - 22), "seed", font=font(20), fill=MUTED, anchor="mm")
    d.text((1975, (mg[3] + bot) / 2), "queries", font=font(20), fill=MUTED, anchor="lm")
    d.text((W / 2, 50), "One dataset, two front ends", font=font(30, True), fill=INK, anchor="mm")
    im.save(f"{A}/diagram_architecture.png")

def crops():
    out = f"{A}/web_crop"; os.makedirs(out, exist_ok=True)
    limits = {"steals": 1430, "squad": 1250, "methodology": 1250, "market": 1686, "franchises": 1492,
              "valuemap": 1461, "players": 1348, "home": 830, "roles": 1124, "brackets": 860}
    for name, h in limits.items():
        im = Image.open(f"{A}/web/{name}.png").convert("RGB")
        im.crop((0, 0, im.width, min(h, im.height))).save(f"{out}/{name}.png", optimize=True)

star_schema(); architecture(); crops()
print("diagrams + crops written")
