"""Remove Power BI Desktop's export-time toast overlay (teal bar + shadow + close glyph, bottom-left)
from every page of an exported report PDF. Report content is left untouched.

Usage (from powerbi/):  ../.venv/Scripts/python -I scripts/clean_pdf.py <in.pdf> <out.pdf>
"""
import ctypes
import sys

import pypdfium2 as pdfium
import pypdfium2.raw as raw

TEAL = (12, 105, 90)


def fill(obj):
    r, g, b, a = (ctypes.c_uint() for _ in range(4))
    if raw.FPDFPageObj_GetFillColor(obj.raw, r, g, b, a):
        return r.value, g.value, b.value, a.value
    return None


pdf = pdfium.PdfDocument(sys.argv[1])
removed = 0
for page in pdf:
    w, h = page.get_width(), page.get_height()
    objs = list(page.get_objects(max_depth=1))
    teal = [o for o in objs if o.type == raw.FPDF_PAGEOBJ_PATH and (fill(o) or (0,))[:3] == TEAL
            and o.get_bounds()[0] < w * 0.5 and o.get_bounds()[3] < h * 0.15]
    if not teal:
        continue
    # bounding box of the toast (teal parts), padded to catch its shadow and close glyph
    x0 = min(o.get_bounds()[0] for o in teal) - 8
    x1 = max(o.get_bounds()[2] for o in teal) + 8
    y1 = max(o.get_bounds()[3] for o in teal) + 8
    for o in objs:
        l, b, r, t = o.get_bounds()
        inside = l >= x0 and r <= x1 and t <= y1
        f = fill(o) or (0, 0, 0, 0)
        is_toast = (o in teal
                    or (inside and o.type == raw.FPDF_PAGEOBJ_PATH and f[:3] == (0, 0, 0) and f[3] < 255)   # shadow
                    or (inside and o.type == raw.FPDF_PAGEOBJ_TEXT and f[:3] == (255, 255, 255)))         # close glyph
        if is_toast:
            page.remove_obj(o)
            removed += 1
    page.gen_content()
pdf.save(sys.argv[2])
print(f"removed {removed} toast objects from {len(pdf)} pages -> {sys.argv[2]}")
