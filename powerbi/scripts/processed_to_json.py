"""Write a JSON copy (array of records, typed) of every CSV in data/processed/, for seeding MongoDB.

Usage (from powerbi/):  ../.venv/Scripts/python -I scripts/processed_to_json.py ../data/processed
"""
import glob
import os
import sys

import pandas as pd

folder = sys.argv[1]
for path in sorted(glob.glob(os.path.join(folder, "*.csv"))):
    head = pd.read_csv(path, nrows=0).columns
    # IDs and keys stay strings (Cricsheet IDs are hex and can look numeric, e.g. "12e45678")
    text_cols = {c: "string" for c in head if (c.endswith(("ID", "Key")) and not c.startswith(("Has", "Is"))) or c in ("TeamColour", "Player", "AuctionName")}
    df = pd.read_csv(path, dtype=text_cols, keep_default_na=False, na_values=[""])
    for c in df.columns:
        # counts that came back as floats because of blanks -> nullable ints (money / ratios stay floats)
        if df[c].dtype == float and df[c].dropna().mod(1).eq(0).all() and not c.endswith(("Cr", "Pct", "Index", "PerPoint")):
            df[c] = df[c].astype("Int64")
    out = path[:-4] + ".json"
    df.to_json(out, orient="records", indent=1, force_ascii=False)
    print(f"{os.path.basename(out):22} {len(df):5} records")
