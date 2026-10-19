#!/usr/bin/env bash
# Export the open report to PDF via Desktop's File > Export > Export to PDF (UI Automation), copy it to deliverables/
# and render each page to deliverables/screenshots/.
set -e
cd "$(dirname "$0")/.."
touch build/.export_marker
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/pbi_ui.ps1 -Invoke "File" >/dev/null; sleep 3
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/pbi_ui.ps1 -Invoke "Export" >/dev/null; sleep 3
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/pbi_ui.ps1 -Invoke "Export to PDF"
f=""
for i in $(seq 1 90); do
  f=$(find "$LOCALAPPDATA/Temp/Power BI Desktop" -name "IPL_Auction_Value.pdf" -newer build/.export_marker -printf "%T@ %p
" 2>/dev/null | sort -n | tail -1 | cut -d" " -f2-)
  [ -n "$f" ] && break; sleep 4
done
[ -z "$f" ] && { echo "no PDF produced"; exit 1; }
# wait until Desktop has finished writing (size stable for 3 checks)
prev=-1; same=0
while [ $same -lt 8 ]; do sz=$(stat -c %s "$f"); if [ "$sz" = "$prev" ]; then same=$((same+1)); else same=0; fi; prev=$sz; sleep 3; done
cp "$f" deliverables/IPL_Auction_Value.pdf
../.venv/Scripts/python -I - <<'PY'
import pypdfium2 as pdfium
names = ["00_home", "01_auction_market", "02_franchise_efficiency", "03_player_value_map", "04_steals_and_overpaid",
         "05_role_and_nationality", "06_price_brackets", "08_methodology"]
pdf = pdfium.PdfDocument("deliverables/IPL_Auction_Value.pdf")
for i in range(len(pdf)):
    pdf[i].render(scale=2).to_pil().save(f"deliverables/screenshots/{names[i] if i < len(names) else f'page_{i}'}.png")
print("pdf pages:", len(pdf))
PY
