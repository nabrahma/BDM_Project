"""Validate every PBIR JSON file against the published Microsoft schemas (local mirror)."""
import json, os, sys, glob
from jsonschema import Draft7Validator
from referencing import Registry, Resource
ROOT, SCHEMAS = sys.argv[1], sys.argv[2]
PREFIX = "https://developer.microsoft.com/json-schemas/"
def retrieve(uri):
    path = os.path.join(SCHEMAS, uri.replace(PREFIX, "").split("#")[0])
    return Resource.from_contents(json.load(open(path, encoding="utf-8")))
registry = Registry(retrieve=retrieve)
bad = 0; n = 0
for f in glob.glob(os.path.join(ROOT, "**", "*.json"), recursive=True) + glob.glob(os.path.join(ROOT, "*.pbir")):
    doc = json.load(open(f, encoding="utf-8"))
    s = doc.get("$schema") if isinstance(doc, dict) else None
    if not s or "fabric/item/report" not in s:
        continue
    n += 1
    schema = retrieve(s).contents
    errs = sorted(Draft7Validator(schema, registry=registry).iter_errors(doc), key=lambda e: e.path)
    for e in errs[:5]:
        bad += 1
        print(os.path.relpath(f, ROOT), "::", "/".join(map(str, e.absolute_path)), "::", e.message[:300])
print(f"validated {n} files, {bad} errors")
sys.exit(1 if bad else 0)
