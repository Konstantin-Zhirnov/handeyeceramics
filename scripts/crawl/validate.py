"""Check content/ against the crawl contract (interfaces.md, module `crawl`).

Run: python scripts/crawl/validate.py [content_dir]   -> exit 0 and "OK ..." or exit 1 with errors.
Checks: inventory schema, product/pricing fields, stable order, local images present,
crawl-issues structure, no door codes / passwords / private contacts left in text.
"""
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(__file__))
import crawl  # noqa: E402

BASE = {"url": str, "path": str, "status": (int, type(None)), "title": str, "description": str,
        "h1": list, "headings": list, "text": str, "blocks": list, "images": list}
PRODUCT = {"price": (int, float, type(None)), "currency": str, "category": str, "options": list}
PLAN = {"name": str, "price": str, "currency": str, "period": str, "description": str}
ISSUE_TYPES = {"duplicate-title", "empty-description", "no-h1", "multiple-h1", "broken-link",
               "broken-image"}


def check(content_dir):
    errors = []
    root = os.path.dirname(os.path.abspath(content_dir))

    def err(where, msg):
        errors.append(f"{where}: {msg}")

    with open(os.path.join(content_dir, "inventory.json"), encoding="utf-8") as f:
        inv = json.load(f)
    for key in ("pages", "products", "pricing", "images", "other"):
        if not isinstance(inv.get(key), list):
            err("inventory", f"missing list '{key}'")
    if errors:
        return errors, inv

    seen_paths = set()
    for key in ("pages", "products", "pricing", "other"):
        paths = [r.get("path") for r in inv[key]]
        if paths != sorted(paths):
            err(key, "records not sorted by path")
        for r in inv[key]:
            where = f"{key}{r.get('path')}"
            for field, typ in BASE.items():
                if not isinstance(r.get(field, None) if field in r else KeyError(), typ):
                    err(where, f"field '{field}' missing or not {typ}")
            if r.get("path") in seen_paths:
                err(where, "path listed twice")
            seen_paths.add(r.get("path"))
            if key != "other" and r.get("status") != 200:
                err(where, "non-200 record outside 'other'")
            if key != "other" and not (r.get("title") and r.get("text")):
                err(where, "200 page without title or text (empty fetch?)")
            for img in r.get("images", []):
                if set(img) < {"src", "alt", "local"}:
                    err(where, "image without src/alt/local")
            if key == "products":
                for field, typ in PRODUCT.items():
                    if field not in r or not isinstance(r[field], typ):
                        err(where, f"product field '{field}' missing or not {typ}")
            if key == "pricing":
                if not r.get("plans"):
                    err(where, "pricing page without plans")
                for p in r.get("plans", []):
                    for field, typ in PLAN.items():
                        if not isinstance(p.get(field), typ):
                            err(where, f"plan field '{field}' missing")
            leftovers = set().union(*[secrets_in(v) for v in strings(r)])
            if leftovers:
                err(where, f"unredacted {', '.join(sorted(leftovers))}")
    if not inv["pages"] or not inv["products"] or not inv["pricing"]:
        err("inventory", "pages, products and pricing must not be empty")

    locals_ = [i["local"] for i in inv["images"]]
    if locals_ != sorted(locals_):
        err("images", "not sorted by local")
    for i in inv["images"]:
        if i.get("local") and not os.path.isfile(os.path.join(root, i["local"])):
            err("images", f"file missing: {i['local']}")

    with open(os.path.join(content_dir, "crawl-issues.json"), encoding="utf-8") as f:
        issues = json.load(f)
    for i in issues:
        if i.get("path") not in seen_paths:
            err("crawl-issues", f"unknown path {i.get('path')}")
        for x in i.get("issues", []):
            if x.get("type") not in ISSUE_TYPES:
                err("crawl-issues", f"unknown issue type {x.get('type')}")
    return errors, inv


def strings(o):
    if isinstance(o, str):
        yield o
    elif isinstance(o, dict):
        for v in o.values():
            yield from strings(v)
    elif isinstance(o, list):
        for v in o:
            yield from strings(v)


def secrets_in(s):
    """Patterns that must never survive redaction (business phones/info@ are allowed)."""
    found = set()
    for m in crawl.RE_DOOR.finditer(s):
        if crawl.REDACTED not in m.group(0):
            found.add("door-code")
    for m in crawl.RE_PASSWORD.finditer(s):
        if not m.group(3).startswith("[REDACTED"):
            found.add("password")
    for m in crawl.RE_EMAIL.finditer(s):
        e = m.group(0).lower()
        if not e.startswith("info@") and not re.search(r"@(wix|wixstatic|sentry|example)\.", e):
            found.add("email")
    return found


if __name__ == "__main__":
    d = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "..",
                                                           "content")
    errors, inv = check(os.path.normpath(d))
    if errors:
        print("\n".join(errors[:50]))
        print(f"FAIL: {len(errors)} problem(s)")
        sys.exit(1)
    print(f"OK pages={len(inv['pages'])} products={len(inv['products'])} "
          f"pricing={len(inv['pricing'])} other={len(inv['other'])} images={len(inv['images'])}")
