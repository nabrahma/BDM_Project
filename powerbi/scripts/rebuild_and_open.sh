#!/usr/bin/env bash
# Regenerate the PBIP from scripts, restart Power BI Desktop on it, wait until it has loaded, then fully refresh.
#   bash powerbi/scripts/rebuild_and_open.sh [--no-refresh]
# Paths: runs inside powerbi/, uses the repo-root .venv and the shared repo-root data/raw/.
set -e
cd "$(dirname "$0")/.."
PY=../.venv/Scripts/python
WIN=$(cygpath -w "$(pwd)")
DATA=$(cygpath -w "$(cd .. && pwd)/data/raw")
$PY -I scripts/build_model.py "$WIN" "$DATA"
$PY -I scripts/build_report.py "$WIN"
if [ -d build/schemas_full ]; then $PY -I scripts/validate_report.py IPL_Auction_Value.Report build/schemas_full | tail -1; else echo "schema validation skipped (no build/schemas_full)"; fi
grep -qF "\"$DATA\\\"" IPL_Auction_Value.SemanticModel/definition/expressions.tmdl || { echo "DataFolder path check failed"; exit 1; }
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/open_pbip.ps1 -Path "$WIN\IPL_Auction_Value.pbip"
until powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/pbi_windows.ps1 2>/dev/null | grep -qE "IPL_Auction_Value|Unable|rror|Issues"; do sleep 3; done
sleep 8
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/pbi_windows.ps1
if [ "$1" != "--no-refresh" ]; then powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/pbi_engine.ps1 -Refresh; fi
