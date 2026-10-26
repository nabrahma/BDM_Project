#!/usr/bin/env bash
# Rebuild Handover/BDM_Project_Report.docx with correct TOC page numbers (two passes), and render a PDF check copy.
#   bash docs/report/build.sh            (from the repo root; needs node, LibreOffice, the repo .venv)
set -e
cd "$(dirname "$0")/../.."
B=docs/report/build; mkdir -p $B
SOFF="/c/Program Files/LibreOffice/program/soffice.exe"
LO="-env:UserInstallation=file:///$(cygpath -m "$(pwd)/.tools/lo-profile" | sed "s/ /%20/g")"
PY=.venv/Scripts/python
pdf() { "$SOFF" --headless "$LO" --convert-to pdf --outdir "$(cygpath -w $B)" "$(cygpath -w "$1")" >/dev/null 2>&1; }
node docs/report/make_report.js $B/pass1.docx
pdf $B/pass1.docx
$PY -I docs/report/tools/pagemap.py $B/pass1.pdf $B/pass1.docx.entries.json $B/pagemap.json
node docs/report/make_report.js Handover/BDM_Project_Report.docx $B/pagemap.json
mv Handover/BDM_Project_Report.docx.entries.json $B/final.entries.json
pdf Handover/BDM_Project_Report.docx
$PY -I docs/report/tools/pagemap.py $B/BDM_Project_Report.pdf $B/final.entries.json $B/pagemap_check.json
cmp -s $B/pagemap.json $B/pagemap_check.json && echo "TOC page numbers verified" || { echo "TOC page numbers shifted"; exit 1; }
