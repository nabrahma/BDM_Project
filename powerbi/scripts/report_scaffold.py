"""Report-level files for the PBIR report: definition.pbir, report.json, theme, background image, pages.json."""
import os
import shutil

from pbir import write_json

NAME = "IPL_Auction_Value"

# Design tokens: warm off-white canvas, white rounded cards, charcoal accents, one yellow data colour.
CANVAS = "#F6F4EF"
CARD = "#FFFFFF"
CARD_ALT = "#FAF8F3"
LINE = "#ECE8DF"
INK = "#1A1A1A"
MUTED = "#6E6A62"
FAINT = "#A8A396"
DARK = "#262626"
YELLOW = "#F2C94C"
YELLOW_SOFT = "#F7E3A1"
# Fixed meaning across pages (PRD section 8): green = Steal, yellow = Star, red = Overpaid, grey = Passenger/Unpriced
GREEN = "#3BA55C"
RED = "#E5484D"
GREY = "#A3A3A3"
QUADRANT_COLOURS = {"Steal": GREEN, "Star": YELLOW, "Overpaid": RED, "Passenger": GREY,
                    "Too few matches": "#D6D3CC", "Unpriced": "#C9C5BC"}
BG_IMAGE = "bg_canvas.png"
THEME_FILE = "IPL_Auction_Light.json"

FONT = "Segoe UI"
FONT_SB = "Segoe UI Semibold"


def solid(c):
    return {"solid": {"color": c}}


THEME = {
    "name": "IPL Auction Light",
    "dataColors": [YELLOW, DARK, "#8C8C8C", GREEN, RED, "#D9A400", "#5B7DB1", "#B88A5A", "#C9C5BC", "#4A4A4A"],
    "foreground": INK, "foregroundNeutralSecondary": MUTED, "foregroundNeutralTertiary": FAINT,
    "background": CARD, "backgroundLight": CARD_ALT, "backgroundNeutral": LINE,
    "tableAccent": YELLOW, "good": GREEN, "neutral": YELLOW, "bad": RED,
    "maximum": GREEN, "center": "#FFFFFF", "minimum": RED, "null": "#C9C5BC",
    "hyperlink": DARK, "visitedHyperlink": DARK,
    "textClasses": {
        "callout": {"fontSize": 26, "fontFace": FONT_SB, "color": INK},
        "title": {"fontSize": 12, "fontFace": FONT_SB, "color": INK},
        "header": {"fontSize": 11, "fontFace": FONT_SB, "color": INK},
        "label": {"fontSize": 9, "fontFace": FONT, "color": MUTED},
    },
    "visualStyles": {
        "*": {"*": {
            "background": [{"show": True, "color": solid(CARD), "transparency": 8}],
            "border": [{"show": True, "color": solid(LINE), "radius": 22, "width": 1}],
            "dropShadow": [{"show": False}],
            "title": [{"show": True, "fontColor": solid(INK), "fontSize": 12, "fontFamily": FONT_SB}],
            "visualHeader": [{"show": True, "background": solid(CARD), "foreground": solid(MUTED), "border": solid(CARD)}],
            "padding": [{"top": 12, "bottom": 10, "left": 14, "right": 14}],
            "categoryAxis": [{"labelColor": solid(MUTED), "titleColor": solid(MUTED), "fontSize": 9, "gridlineShow": False}],
            "valueAxis": [{"labelColor": solid(FAINT), "titleColor": solid(MUTED), "fontSize": 9, "gridlineColor": solid(LINE), "gridlineStyle": "dotted"}],
            "legend": [{"labelColor": solid(MUTED), "fontSize": 9}],
            "labels": [{"color": solid("#FFFFFF"), "fontSize": 9, "enableBackground": True, "backgroundColor": solid(DARK), "backgroundTransparency": 0}],
        }},
        "page": {"*": {"background": [{"color": solid(CANVAS), "transparency": 0}], "outspace": [{"color": solid(CANVAS)}]}},
        "textbox": {"*": {"background": [{"show": False}], "border": [{"show": False}], "padding": [{"top": 0, "bottom": 0, "left": 2, "right": 2}]}},
        "actionButton": {"*": {"background": [{"show": False}], "border": [{"show": False}], "padding": [{"top": 0, "bottom": 0, "left": 0, "right": 0}]}},
        "card": {"*": {"background": [{"show": False}], "border": [{"show": False}], "padding": [{"top": 0, "bottom": 0, "left": 4, "right": 4}]}},
        "slicer": {"*": {"background": [{"show": False}], "border": [{"show": False}],
                         "items": [{"fontColor": solid(INK), "background": solid("#F1EFEA"), "fontSize": 10}],
                         "header": [{"fontColor": solid(MUTED), "fontSize": 9, "show": True}]}},
        "tableEx": {"*": {"columnHeaders": [{"fontColor": solid(MUTED), "backColor": solid(CARD), "fontFamily": FONT_SB, "fontSize": 9}],
                          "values": [{"fontColorPrimary": solid(INK), "backColorPrimary": solid(CARD),
                                      "fontColorSecondary": solid(INK), "backColorSecondary": solid(CARD_ALT), "fontSize": 10}],
                          "grid": [{"gridHorizontalColor": solid(LINE), "gridVerticalColor": solid(CARD), "outlineColor": solid(LINE)}]}},
        "pivotTable": {"*": {"columnHeaders": [{"fontColor": solid(MUTED), "backColor": solid(CARD), "fontFamily": FONT_SB, "fontSize": 9}],
                             "rowHeaders": [{"fontColor": solid(INK), "backColor": solid(CARD), "fontSize": 10}],
                             "values": [{"fontColorPrimary": solid(INK), "backColorPrimary": solid(CARD),
                                         "fontColorSecondary": solid(INK), "backColorSecondary": solid(CARD_ALT), "fontSize": 10}],
                             "grid": [{"gridHorizontalColor": solid(LINE), "gridVerticalColor": solid(CARD), "outlineColor": solid(LINE)}]}},
    },
}


def write_scaffold(project, page_names, active, base_theme_src, assets_dir):
    rp = os.path.join(project, f"{NAME}.Report")
    keep = os.path.join(rp, ".pbi")
    if os.path.isdir(rp):
        for entry in os.listdir(rp):
            path = os.path.join(rp, entry)
            if path != keep:
                shutil.rmtree(path) if os.path.isdir(path) else os.remove(path)
    write_json(os.path.join(rp, "definition.pbir"), {
        "$schema": "https://developer.microsoft.com/json-schemas/fabric/item/report/definitionProperties/2.0.0/schema.json",
        "version": "4.0",
        "datasetReference": {"byPath": {"path": f"../{NAME}.SemanticModel"}}})
    write_json(os.path.join(rp, ".platform"), {
        "$schema": "https://developer.microsoft.com/json-schemas/fabric/gitIntegration/platformProperties/2.0.0/schema.json",
        "metadata": {"type": "Report", "displayName": NAME},
        "config": {"version": "2.0", "logicalId": "8a3f6c1e-2b7d-4f51-9c0a-1d2e3f4a5b6c"}})
    d = os.path.join(rp, "definition")
    write_json(os.path.join(d, "version.json"), {
        "$schema": "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/versionMetadata/1.0.0/schema.json",
        "version": "2.0.0"})
    ver = {"visual": "1.8.95", "report": "2.0.95", "page": "1.3.95"}
    write_json(os.path.join(d, "report.json"), {
        "$schema": "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/report/3.0.0/schema.json",
        "themeCollection": {
            "baseTheme": {"name": "CY24SU10", "reportVersionAtImport": ver, "type": "SharedResources"},
            "customTheme": {"name": THEME_FILE, "reportVersionAtImport": ver, "type": "RegisteredResources"},
        },
        "objects": {"outspacePane": [{"properties": {"expanded": {"expr": {"Literal": {"Value": "false"}}}}}]},
        "resourcePackages": [
            {"name": "SharedResources", "type": "SharedResources",
             "items": [{"name": "CY24SU10", "path": "BaseThemes/CY24SU10.json", "type": "BaseTheme"}]},
            {"name": "RegisteredResources", "type": "RegisteredResources",
             "items": [{"name": THEME_FILE, "path": THEME_FILE, "type": "CustomTheme"},
                       {"name": BG_IMAGE, "path": BG_IMAGE, "type": "Image"}]},
        ],
        "settings": {"useStylableVisualContainerHeader": True, "exportDataMode": "AllowSummarized",
                     "defaultDrillFilterOtherVisuals": True, "useEnhancedTooltips": True, "allowChangeFilterTypes": True},
    })
    os.makedirs(os.path.join(rp, "StaticResources", "SharedResources", "BaseThemes"), exist_ok=True)
    shutil.copy(base_theme_src, os.path.join(rp, "StaticResources", "SharedResources", "BaseThemes", "CY24SU10.json"))
    write_json(os.path.join(rp, "StaticResources", "RegisteredResources", THEME_FILE), THEME)
    shutil.copy(os.path.join(assets_dir, BG_IMAGE), os.path.join(rp, "StaticResources", "RegisteredResources", BG_IMAGE))
    write_json(os.path.join(d, "pages", "pages.json"), {
        "$schema": "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/pagesMetadata/1.0.0/schema.json",
        "pageOrder": page_names, "activePageName": active})
    write_json(os.path.join(project, f"{NAME}.pbip"), {
        "$schema": "https://developer.microsoft.com/json-schemas/fabric/pbip/pbipProperties/1.0.0/schema.json",
        "version": "1.0", "artifacts": [{"report": {"path": f"{NAME}.Report"}}], "settings": {"enableAutoRecovery": True}})
    return rp


def background_image_objects():
    """Page objects: canvas background = the registered glow image, wallpaper = canvas colour."""
    img = {"image": {"name": {"expr": {"Literal": {"Value": f"'{BG_IMAGE}'"}}},
                     "url": {"expr": {"ResourcePackageItem": {"PackageName": "RegisteredResources", "PackageType": 1, "ItemName": BG_IMAGE}}},
                     "scaling": {"expr": {"Literal": {"Value": "'Fill'"}}}}}
    return {"background": [{"properties": {"image": img, "transparency": {"expr": {"Literal": {"Value": "0D"}}}}}],
            "outspace": [{"properties": {"color": {"solid": {"color": {"expr": {"Literal": {"Value": f"'{CANVAS}'"}}}}}}}]}
