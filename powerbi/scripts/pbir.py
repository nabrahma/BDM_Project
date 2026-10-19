"""Small helpers for writing Power BI enhanced report format (PBIR) JSON."""
import hashlib
import json
import os

VC_SCHEMA = "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/visualContainer/2.4.0/schema.json"
PAGE_SCHEMA = "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/page/2.0.0/schema.json"
M = "_Measures"


def uid(*parts, n=20):
    return hashlib.sha1("/".join(map(str, parts)).encode()).hexdigest()[:n]


# ---------- expression literals ----------
def lit(v):
    if isinstance(v, bool):
        s = "true" if v else "false"
    elif isinstance(v, int):
        s = f"{v}L"
    elif isinstance(v, float):
        s = f"{v:g}D"
    else:
        s = "'" + str(v).replace("'", "''") + "'"
    return {"expr": {"Literal": {"Value": s}}}


def num(v):
    return {"expr": {"Literal": {"Value": f"{v:g}D"}}}


def color(hexv):
    return {"solid": {"color": {"expr": {"Literal": {"Value": f"'{hexv}'"}}}}}


def measure_color(measure):
    return {"solid": {"color": {"expr": {"Measure": {"Expression": {"SourceRef": {"Entity": M}}, "Property": measure}}}}}


def props(**kw):
    """props(show=True, fontSize=num(12)) -> PBIR properties dict; plain values are wrapped as literals."""
    out = {}
    for k, v in kw.items():
        out[k] = v if isinstance(v, dict) else lit(v)
    return out


def obj(selector=None, **kw):
    o = {"properties": props(**kw)}
    if selector is not None:
        o["selector"] = selector
    return o


# ---------- fields ----------
def col(entity, prop):
    return {"Column": {"Expression": {"SourceRef": {"Entity": entity}}, "Property": prop}}


def meas(prop, entity=M):
    return {"Measure": {"Expression": {"SourceRef": {"Entity": entity}}, "Property": prop}}


def field_name(f):
    k = "Column" if "Column" in f else "Measure"
    return f[k]["Expression"]["SourceRef"]["Entity"], f[k]["Property"]


def proj(f, display=None, active=None):
    e, p = field_name(f)
    out = {"field": f, "queryRef": f"{e}.{p}", "nativeQueryRef": p}
    if display:
        out["displayName"] = display
    if active is not None:
        out["active"] = active
    return out


def query(roles, sort=None):
    q = {"queryState": {}}
    for role, fields in roles.items():
        q["queryState"][role] = {"projections": [f if "field" in f else proj(f) for f in fields]}
    if sort:
        q["sortDefinition"] = {"sort": [{"field": f, "direction": d} for f, d in sort], "isDefaultSort": True}
    return q


# ---------- filters ----------
def filter_in(f, values, name, how=None, ftype="Categorical"):
    e, p = field_name(f)
    kind = "Column" if "Column" in f else "Measure"
    vals = [[lit(v)["expr"]] for v in values]
    flt = {
        "name": name,
        "field": f,
        "type": ftype,
        "filter": {
            "Version": 2,
            "From": [{"Name": "s", "Entity": e, "Type": 0}],
            "Where": [{"Condition": {"In": {"Expressions": [{kind: {"Expression": {"SourceRef": {"Source": "s"}}, "Property": p}}], "Values": vals}}}],
        },
    }
    if how:
        flt["howCreated"] = how
    return flt


def filter_measure_cmp(f, op, value, name):
    """Visual-level advanced filter on a measure, e.g. op 'GreaterThanOrEqual'."""
    e, p = field_name(f)
    kinds = {"Equal": 0, "GreaterThan": 1, "GreaterThanOrEqual": 2, "LessThan": 3, "LessThanOrEqual": 4}
    return {
        "name": name,
        "field": f,
        "type": "Advanced",
        "filter": {
            "Version": 2,
            "From": [{"Name": "s", "Entity": e, "Type": 0}],
            "Where": [{"Condition": {"Comparison": {"ComparisonKind": kinds[op],
                                                     "Left": {"Measure": {"Expression": {"SourceRef": {"Source": "s"}}, "Property": p}},
                                                     "Right": lit(value)["expr"]}}}],
        },
    }


def filter_topn(f_by_cat, order_measure, n, name, desc=True):
    """Top N filter on a category column ordered by a measure."""
    ce, cp = field_name(f_by_cat)
    me, mp = field_name(order_measure)
    return {
        "name": name,
        "field": f_by_cat,
        "type": "TopN",
        "filter": {
            "Version": 2,
            "From": [
                {"Name": "subquery", "Expression": {"Subquery": {"Query": {
                    "Version": 2,
                    "From": [{"Name": "d", "Entity": ce, "Type": 0}, {"Name": "m", "Entity": me, "Type": 0}],
                    "Select": [{"Column": {"Expression": {"SourceRef": {"Source": "d"}}, "Property": cp}, "Name": "field"}],
                    "OrderBy": [{"Direction": 2 if desc else 1, "Expression": {"Measure": {"Expression": {"SourceRef": {"Source": "m"}}, "Property": mp}}}],
                    "Top": n}}}, "Type": 2},
                {"Name": "d", "Entity": ce, "Type": 0},
            ],
            "Where": [{"Condition": {"In": {"Expressions": [{"Column": {"Expression": {"SourceRef": {"Source": "d"}}, "Property": cp}}],
                                            "Table": {"SourceRef": {"Source": "subquery"}}}}}],
        },
    }


# ---------- containers ----------
def visual(name, vtype, x, y, w, h, z=0, roles=None, sort=None, objects=None, vco=None, filters=None, title=None,
           alt=None, drill=True, extra=None):
    v = {"visualType": vtype}
    if roles:
        v["query"] = query(roles, sort)
    if objects:
        v["objects"] = objects
    vco = dict(vco or {})
    if title is not None:
        vco.setdefault("title", [obj(show=True, text=title)])
    if alt:
        vco.setdefault("general", [obj(altText=alt)])
    if vco:
        v["visualContainerObjects"] = vco
    if drill and roles:
        v["drillFilterOtherVisuals"] = True
    if extra:
        v.update(extra)
    out = {"$schema": VC_SCHEMA, "name": name,
           "position": {"x": x, "y": y, "z": z, "height": h, "width": w, "tabOrder": z},
           "visual": v}
    if filters:
        out["filterConfig"] = {"filters": filters}
    return out


def textbox(name, x, y, w, h, runs, z=0, align=None, bg=None, alt=None):
    """runs: list of paragraphs; each paragraph = list of (text, style dict)."""
    paras = []
    for para in runs:
        p = {"textRuns": [{"value": t, "textStyle": s} if s else {"value": t} for t, s in para]}
        if align:
            p["horizontalTextAlignment"] = align
        paras.append(p)
    vco = {"background": [obj(show=bg is not None, **({"color": color(bg)} if bg else {}))]}
    if alt:
        vco["general"] = [obj(altText=alt)]
    return {"$schema": VC_SCHEMA, "name": name,
            "position": {"x": x, "y": y, "z": z, "height": h, "width": w, "tabOrder": z},
            "visual": {"visualType": "textbox", "objects": {"general": [{"properties": {"paragraphs": paras}}]},
                       "visualContainerObjects": vco}}


def write_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")
