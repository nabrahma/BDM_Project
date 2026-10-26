"""Find the printed page number of every TOC / figure / table entry in a rendered report PDF.

Usage (from repo root):
  .venv/Scripts/python -I docs/report/tools/pagemap.py <report.pdf> <report.docx.entries.json> <pagemap.json>

Body pages are numbered from 1 starting at the page that holds the "1. Introduction" chapter heading.
"""
import json, re, sys
import pypdfium2 as pdfium

pdf_path, entries_path, out_path = sys.argv[1:4]
norm = lambda s: re.sub(r"\s+", " ", s.replace(" ", " ")).strip()
pdf = pdfium.PdfDocument(pdf_path)
pages = [norm(pdf[i].get_textpage().get_text_range()) for i in range(len(pdf))]
entries = json.load(open(entries_path, encoding="utf-8"))

intro = [i for i, t in enumerate(pages) if "1. Introduction" in t]
body_start = max(intro)  # the TOC also lists it; the chapter itself comes last
result, missing = {}, []

def find(text, key):
    for i in range(body_start, len(pages)):
        if norm(text) in pages[i]:
            result[key] = i - body_start + 1
            return
    missing.append(text)

for e in entries["toc"]:
    find(e["text"], "toc:" + e["text"])
for f in entries["figures"]:
    find(f, "fig:" + f.split(":")[0])
for t in entries["tables"]:
    find(t, "tab:" + t.split(":")[0])

json.dump(result, open(out_path, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
print(f"pdf pages: {len(pdf)}, body starts at pdf page {body_start + 1}, mapped {len(result)}, missing {len(missing)}")
for m in missing:
    print("  missing:", m)
