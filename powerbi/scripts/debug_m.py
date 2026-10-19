"""Build a TMSL script that (re)creates the temporary zzDebug(Step, Result) table from an M file and refreshes it."""
import json, sys
m = open(sys.argv[1], encoding="utf-8").read()
table = {"name": "zzDebug",
         "columns": [{"name": "Step", "dataType": "string", "sourceColumn": "Step"}, {"name": "Result", "dataType": "string", "sourceColumn": "Result"}],
         "partitions": [{"name": "zzDebug", "mode": "import", "source": {"type": "m", "expression": m}}]}
parts = [{"delete": {"object": {"database": "__DB__", "table": "zzDebug"}}},
         {"create": {"parentObject": {"database": "__DB__"}, "table": table}},
         {"refresh": {"type": "full", "objects": [{"database": "__DB__", "table": "zzDebug"}]}}]
open(sys.argv[2], "w", encoding="utf-8").write("\n-----\n".join(json.dumps(p) for p in parts))
