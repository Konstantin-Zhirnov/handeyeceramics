"""Inventory crawl of the public Wix site.

Usage:
  python scripts/crawl/crawl.py                 # full crawl -> content/
  python scripts/crawl/crawl.py --cache DIR     # also keep raw responses in DIR (outside the repo)
  python scripts/crawl/crawl.py --cache DIR --offline   # rebuild content/ from DIR, no network
  python scripts/crawl/crawl.py --no-images     # skip image downloads

Writes content/inventory.json, content/crawl-issues.json, content/redactions.json,
content/README.md and content/images/*. Needs: requests, beautifulsoup4.
Never logs in and never submits forms: only GET requests, at most 2 per second.
"""
import argparse
import hashlib
import json
import os
import re
import sys
import time
from collections import defaultdict
from urllib.parse import urljoin, urlsplit, unquote

from bs4 import BeautifulSoup, NavigableString, Tag, Comment

SITE = "https://www.handeyeceramics.com"
HOSTS = {"www.handeyeceramics.com", "handeyeceramics.com"}
SITEMAP_INDEX = SITE + "/sitemap.xml"
SITEMAP_KINDS = {"pages": "pages", "store-products": "products",
                 "booking-services": "services", "pricing-plans": "pricing"}
MIN_INTERVAL = 0.5          # seconds between requests -> max 2 req/s
MAX_URLS = 600
IMAGE_BOX = 2400            # longest edge of downloaded images (Wix "fit", never upscales)
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) "
      "Chrome/126.0 Safari/537.36 HandEyeMigrationInventory/1.0")

# Paths we never fetch: member areas, account and login flows, Wix internals.
NO_FETCH = re.compile(r"^/(account|members|members-area|profile|login|signup|_api|_partials|"
                      r"_serverless|my-account|my-bookings|my-subscriptions|my-wallet|"
                      r"cart-page|checkout|thank-you-page)(/|$)", re.I)
FILE_EXT = re.compile(r"\.(pdf|jpe?g|png|gif|webp|svg|mp4|mov|zip|docx?|xlsx?)$", re.I)

BLOCK_TAGS = {"h1": "heading", "h2": "heading", "h3": "heading", "h4": "heading",
              "h5": "heading", "h6": "heading", "p": "paragraph", "li": "list-item",
              "label": "label", "figcaption": "text", "blockquote": "paragraph",
              "td": "text", "th": "text"}
SKIP_TAGS = {"script", "style", "noscript", "svg", "template", "iframe"}
ZERO_WIDTH = re.compile("[​‌‍⁠﻿]")

# ---------------------------------------------------------------- text + secrets


def norm(s):
    s = ZERO_WIDTH.sub("", s or "").replace("\xa0", " ")
    return re.sub(r"\s+", " ", s).strip()


RE_DOOR = re.compile(
    r"(?i)\b((?:door|lock|gate|entry|entrance|access|keypad|buzzer|lock\s*box|key\s*box|alarm)"
    r"\s*(?:code|combo|combination|#)?(?:\s*(?:is|:|=|-))?\s*|(?:code|combo|combination)"
    r"\s*(?:is|:|=|-)\s*)([#*]?\d{3,8}[#*]?)(?!\d)")
RE_PASSWORD = re.compile(r"(?i)\b(pass\s*word|passcode|pwd|pw)(\s*(?:is|:|=|-)\s*)([^\s)\].,;]+)")
RE_PHONE = re.compile(r"(?<![\d/])(?:\+?1[\s.-]?)?\(?(\d{3})\)?[\s.-]?(\d{3})[\s.-]?(\d{4})(?![\d/])")
RE_EMAIL = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
REDACTED = "[REDACTED]"
RE_CATEGORY = re.compile(r'"category":\{"id":"([0-9a-f-]{36})","name":"((?:[^"\\]|\\.)*)"')
CURRENCY = {"CA$": "CAD", "C$": "CAD", "$": "CAD", "US$": "USD"}
ALL_PRODUCTS = "00000000-000000-000000-000000000001"


class Redactor:
    """Cuts door codes, passwords, private phones and e-mails; remembers where, never what."""

    def __init__(self, business):
        self.phones = set(business.get("phones", ()))
        self.emails = {e.lower() for e in business.get("emails", ())}
        self.hits = defaultdict(lambda: defaultdict(int))   # (path, kind) -> field -> count

    def email_ok(self, e):
        e = e.lower()
        return e in self.emails or e.startswith("info@")

    def __call__(self, s, path, field):
        if not s:
            return s

        def hit(kind):
            self.hits[(path, kind)][field] += 1

        def door(m):
            hit("door-code")
            return m.group(1) + REDACTED

        def pw(m):
            hit("password")
            return m.group(1) + m.group(2) + REDACTED

        def phone(m):
            if "".join(m.groups()) in self.phones:
                return m.group(0)
            hit("phone")
            return REDACTED

        def email(m):
            if self.email_ok(m.group(0)):
                return m.group(0)
            hit("email")
            return REDACTED

        s = RE_DOOR.sub(door, s)
        s = RE_PASSWORD.sub(pw, s)
        s = RE_EMAIL.sub(email, s)
        s = RE_PHONE.sub(phone, s)
        return s

    def report(self):
        out = []
        for (path, kind), fields in self.hits.items():
            out.append({"path": path, "kind": kind, "count": sum(fields.values()),
                        "fields": sorted(fields)})
        return sorted(out, key=lambda r: (r["path"], r["kind"]))


# ---------------------------------------------------------------- urls + images


def internal_path(href, base=SITE + "/"):
    """Return the normalized path of a same-site link, or None for external / non-http links."""
    if not href:
        return None
    href = href.strip()
    if href.startswith(("mailto:", "tel:", "javascript:", "#", "data:", "sms:")):
        return None
    u = urlsplit(urljoin(base, href))
    if u.scheme not in ("http", "https") or u.hostname not in HOSTS:
        return None
    path = unquote(u.path) or "/"
    if len(path) > 1:
        path = path.rstrip("/")
    return path


def link_target(href, base=SITE + "/"):
    p = internal_path(href, base)
    return p if p is not None else (href or "").strip()


def image_ref(src):
    """Canonical (original-size) src and stable local path for an image URL."""
    if not src or src.startswith("data:"):
        return None
    src = urljoin(SITE + "/", src.strip())
    m = re.match(r"https?://static\.wixstatic\.com/media/([^/?#]+)", src)
    if m:
        name = m.group(1)
        canonical = "https://static.wixstatic.com/media/" + name
        local = re.sub(r"[^A-Za-z0-9._-]", "-", name)
        if "." not in local:
            local += ".jpg"
        return canonical, "content/images/" + local
    u = urlsplit(src)
    ext = os.path.splitext(u.path)[1].lower()
    if ext not in (".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".avif"):
        ext = ".bin"
    digest = hashlib.sha1(src.encode()).hexdigest()[:16]
    return src, "content/images/ext-" + digest + ext


def download_url(canonical):
    m = re.match(r"https://static\.wixstatic\.com/media/([^/]+)$", canonical)
    if not m:
        return canonical
    name = m.group(1)
    ext = os.path.splitext(name)[1].lower()
    if ext in (".gif", ".svg") or not ext:
        return canonical
    q = 90 if ext == ".png" else 85
    return f"{canonical}/v1/fit/w_{IMAGE_BOX},h_{IMAGE_BOX},q_{q}/file{ext}"


# ---------------------------------------------------------------- page parsing


def page_root(soup):
    main = soup.find(id="PAGES_CONTAINER") or soup.find("main")
    if main is not None:
        return main
    body = soup.body or soup
    for sel in ("SITE_HEADER", "SITE_FOOTER"):
        el = body.find(id=sel)
        if el:
            el.decompose()
    for el in body.find_all(["header", "footer"]):
        el.decompose()
    return body


def skipped(node, root):
    for p in node.parents:
        if p is root or p is None:
            return False
        if p.name in SKIP_TAGS:
            return True
        hook = p.get("data-hook") or ""
        if "screen-reader" in hook:
            return True
        if p.get("aria-hidden") == "true" and p.name == "span" and "price" in hook:
            # Wix price widgets render the price twice; keep the screen-reader-free copy
            return False
    return False


def has_block_desc(tag):
    return tag.find(list(BLOCK_TAGS) + ["img", "form", "a", "button"]) is not None


def block_owner(node, root):
    """Nearest element whose text forms one block, plus that block's type."""
    first_link = None
    for p in node.parents:
        if p is root or p is None:
            break
        if p.name in BLOCK_TAGS:
            return p, BLOCK_TAGS[p.name]
        if p.name in ("a", "button") and first_link is None:
            first_link = p
    if first_link is not None:
        return first_link, "button"
    parent = node.parent
    if parent is not None and parent is not root and not has_block_desc(parent):
        return parent, "text"
    return node, "text"


def form_fields(form, clean, path):
    labels = {}
    for lab in form.find_all("label"):
        if lab.get("for"):
            labels[lab["for"]] = norm(lab.get_text(" "))
    fields = []
    for el in form.find_all(["input", "textarea", "select"]):
        typ = el.get("type", "text" if el.name == "input" else el.name).lower()
        if typ in ("hidden", "submit", "button", "image", "reset"):
            continue
        label = (labels.get(el.get("id") or "") or norm(el.get("aria-label") or "")
                 or norm(el.get("placeholder") or ""))
        if not label:
            wrap = el.find_parent("label")
            label = norm(wrap.get_text(" ")) if wrap else ""
        name = el.get("name") or el.get("id") or label
        f = {"name": clean(name, path, "blocks"), "label": clean(label, path, "blocks"),
             "type": typ, "required": el.has_attr("required") or el.get("aria-required") == "true"}
        if el.name == "select":
            f["options"] = [clean(norm(o.get_text(" ")), path, "blocks")
                            for o in el.find_all("option") if norm(o.get_text(" "))]
        fields.append(f)
    submit = form.find(["button"]) or form.find("input", attrs={"type": "submit"})
    block = {"type": "form", "fields": fields}
    if submit is not None:
        block["submit"] = norm(submit.get_text(" ") or submit.get("value") or "")
    return block


def extract_blocks(root, clean, path, base):
    blocks, seen = [], set()
    skip_until = None
    for node in root.descendants:
        if skip_until is not None:
            if node is skip_until or skip_until in node.parents:
                continue
            skip_until = None
        if isinstance(node, Comment):
            continue
        if isinstance(node, Tag):
            if node.name in SKIP_TAGS:
                skip_until = node
                continue
            if node.name == "form":
                blocks.append(form_fields(node, clean, path))
                skip_until = node
                continue
            if node.name == "img":
                ref = image_ref(node.get("src") or node.get("data-src") or "")
                if ref and not skipped(node, root):
                    blocks.append({"type": "image", "src": ref[0],
                                   "alt": clean(norm(node.get("alt") or ""), path, "images"),
                                   "local": ref[1]})
            continue
        if not isinstance(node, NavigableString) or not norm(str(node)):
            continue
        if skipped(node, root):
            continue
        owner, typ = block_owner(node, root)
        if id(owner) in seen:
            continue
        seen.add(id(owner))
        if isinstance(owner, NavigableString):
            text = norm(str(owner))
        else:
            text = norm(owner.get_text(" "))
        if not text:
            continue
        text = clean(text, path, "blocks")
        if typ == "heading":
            blocks.append({"type": "heading", "level": int(owner.name[1]), "text": text})
        elif typ == "button":
            href = owner.get("href") if isinstance(owner, Tag) else None
            b = {"type": "button", "text": text}
            if href:
                if href.startswith(("tel:", "mailto:")):
                    href = clean(href, path, "blocks")
                b["href"] = link_target(href, base)
            blocks.append(b)
        else:
            blocks.append({"type": typ, "text": text})
    return blocks


def parse_plans(soup, clean, path):
    plans, seen = [], set()
    for li in soup.find_all(attrs={"data-hook": "plan"}):
        def hook(name):
            el = li.find(attrs={"data-hook": name})
            return norm(el.get_text(" ")) if el else ""
        plan = {"name": clean(hook("plan-title"), path, "plans"),
                "price": hook("price-amount"),
                "currency": CURRENCY.get(hook("price-currency"), hook("price-currency")),
                "period": clean(hook("plan-duration") or hook("plan-recurrence"), path, "plans"),
                "description": clean(hook("plan-tagline"), path, "plans"),
                "benefits": [clean(norm(b.get_text(" ")), path, "plans")
                             for b in li.select('[data-hook="benefits"] li')
                             if norm(b.get_text(" "))]}
        cta = li.find(attrs={"data-hook": re.compile("plan-cta|button")})
        if cta is not None:
            plan["cta"] = norm(cta.get_text(" "))
        key = json.dumps(plan, sort_keys=True)
        if key not in seen:
            seen.add(key)
            plans.append(plan)
    return plans


def parse_page(html, url, status, business, redactor=None):
    """Parse one HTML page into an inventory record. Returns (record, redactions)."""
    red = redactor or Redactor(business)
    path = internal_path(url) or "/"
    soup = BeautifulSoup(html, "html.parser")
    title = red(norm(soup.title.get_text()) if soup.title else "", path, "title")
    d = soup.find("meta", attrs={"name": "description"})
    description = red(norm(d.get("content") if d else ""), path, "description")
    h1 = [red(norm(h.get_text(" ")), path, "h1") for h in soup.find_all("h1")]
    h1 = [h for h in h1 if h]

    links, external = set(), set()
    for a in soup.find_all("a", href=True):
        p = internal_path(a["href"], url)
        if p is not None:
            links.add(p)
        elif a["href"].startswith(("http://", "https://")):
            external.add(a["href"].strip())

    plans = parse_plans(soup, red, path)
    root = page_root(soup)
    blocks = extract_blocks(root, red, path, url)
    headings = [{"level": b["level"], "text": b["text"]} for b in blocks if b["type"] == "heading"]
    text = "\n\n".join(b["text"] for b in blocks if b.get("text"))
    images, seen = [], set()
    for b in blocks:
        if b["type"] == "image" and b["src"] not in seen:
            seen.add(b["src"])
            images.append({"src": b["src"], "alt": b["alt"], "local": b["local"]})
    rec = {"url": url, "path": path, "status": status, "title": title,
           "description": description, "h1": h1, "headings": headings, "text": text,
           "blocks": blocks, "images": images, "links": sorted(links),
           "externalLinks": sorted(red(e, path, "externalLinks") for e in external)}
    if plans:
        rec["plans"] = plans
    if redactor is None:
        return rec, red.report()
    return rec, None


# ---------------------------------------------------------------- products


def _find(obj, pred):
    if isinstance(obj, dict):
        if pred(obj):
            return obj
        for v in obj.values():
            r = _find(v, pred)
            if r is not None:
                return r
    elif isinstance(obj, list):
        for v in obj:
            r = _find(v, pred)
            if r is not None:
                return r
    return None


def product_fields(html, path, red):
    """Price, currency, options, full-size media and description of a Wix Stores product."""
    slug = path.rsplit("/", 1)[-1]
    soup = BeautifulSoup(html, "html.parser")
    out = {"price": None, "currency": "", "category": "", "options": [], "media": [],
           "productDescription": ""}
    w = soup.find("script", id="wix-warmup-data")
    prod = None
    if w and w.string:
        try:
            prod = _find(json.loads(w.string),
                         lambda o: o.get("urlPart") == slug and "price" in o)
        except ValueError:
            prod = None
    if prod:
        out["price"] = prod.get("price")
        out["currency"] = prod.get("currency") or ""
        for opt in prod.get("options") or []:
            out["options"].append({
                "title": red(norm(opt.get("title") or ""), path, "options"),
                "type": opt.get("optionType") or "",
                "choices": [red(norm(s.get("description") or s.get("value") or ""), path, "options")
                            for s in opt.get("selections") or []]})
        for m in prod.get("media") or []:
            src = m.get("fullUrl") or m.get("url") or ""
            if src and not src.startswith("http"):
                src = "https://static.wixstatic.com/media/" + src
            ref = image_ref(src)
            if ref:
                out["media"].append({"src": ref[0], "alt": red(norm(m.get("altText") or m.get("title")
                                                                     or ""), path, "images"),
                                     "local": ref[1]})
        desc = prod.get("description") or ""
        out["productDescription"] = red(norm(BeautifulSoup(desc, "html.parser").get_text(" ")),
                                        path, "productDescription")
        if (prod.get("subscriptionPlans") or {}).get("list"):
            out["subscription"] = True
        out["categoryIds"] = list(prod.get("categoryIds") or [])
    for ld in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(ld.string or "")
        except ValueError:
            continue
        if isinstance(data, dict) and data.get("@type") == "Product":
            offer = data.get("Offers") or data.get("offers") or {}
            if isinstance(offer, list):
                offer = offer[0] if offer else {}
            if out["price"] is None and offer.get("price") is not None:
                out["price"] = float(offer["price"])
            if not out["currency"]:
                out["currency"] = offer.get("priceCurrency") or ""
            if not out["productDescription"]:
                out["productDescription"] = red(norm(data.get("description") or ""), path,
                                                "productDescription")
    return out


# ---------------------------------------------------------------- issues + assembly


def build_issues(records, statuses, broken_images):
    """SEO findings per page. statuses: path -> HTTP status; broken_images: src -> status."""
    ok = [r for r in records if r.get("status") == 200]
    by_title = defaultdict(list)
    for r in ok:
        by_title[r["title"]].append(r["path"])
    out = []
    for r in sorted(ok, key=lambda r: r["path"]):
        issues = []
        others = sorted(p for p in by_title[r["title"]] if p != r["path"])
        if others:
            issues.append({"type": "duplicate-title", "title": r["title"], "samePathsAs": others})
        if not r.get("description"):
            issues.append({"type": "empty-description"})
        if len(r.get("h1", [])) == 0:
            issues.append({"type": "no-h1"})
        elif len(r["h1"]) > 1:
            issues.append({"type": "multiple-h1", "count": len(r["h1"]), "h1": r["h1"]})
        for link in r.get("links", []):
            st = statuses.get(link)
            if isinstance(st, int) and st >= 400:
                issues.append({"type": "broken-link", "target": link, "status": st})
        for img in r.get("images", []):
            if img["src"] in broken_images:
                issues.append({"type": "broken-image", "src": img["src"],
                               "status": broken_images[img["src"]]})
        if issues:
            out.append({"path": r["path"], "kind": r.get("kind", ""), "issues": issues})
    return out


def assemble(groups, images, site=None):
    inv = {}
    for key in ("pages", "products", "pricing"):
        inv[key] = sorted(groups.get(key, []), key=lambda r: r["path"])
    inv["images"] = sorted(images, key=lambda i: i["local"])
    inv["other"] = sorted(groups.get("other", []), key=lambda r: r["path"])
    if site is not None:
        inv["site"] = site
    return inv


def dump_json(obj):
    return json.dumps(obj, ensure_ascii=False, indent=2) + "\n"


# ---------------------------------------------------------------- network


class Fetcher:
    def __init__(self, cache=None, offline=False):
        self.cache, self.offline, self.last = cache, offline, 0.0
        self.session = None
        if cache:
            os.makedirs(cache, exist_ok=True)
        if not offline:
            import requests
            self.session = requests.Session()
            self.session.headers["User-Agent"] = UA

    def _wait(self):
        dt = time.monotonic() - self.last
        if dt < MIN_INTERVAL:
            time.sleep(MIN_INTERVAL - dt)
        self.last = time.monotonic()

    def _get_once(self, url, body):
        self._wait()
        try:
            r = self.session.get(url, allow_redirects=False, timeout=30, stream=not body)
            res = {"status": r.status_code, "location": r.headers.get("Location", ""),
                   "ctype": r.headers.get("Content-Type", "").split(";")[0].strip(), "text": ""}
            if (body and "html" in res["ctype"]) or url.endswith(".xml"):
                r.encoding = r.encoding or "utf-8"
                res["text"] = r.text
            r.close()
        except Exception as e:  # network error is data for the inventory, not a crash
            res = {"status": None, "location": "", "ctype": "", "text": "",
                   "error": type(e).__name__}
        return res

    def _cpath(self, url):
        return os.path.join(self.cache, hashlib.sha1(url.encode()).hexdigest() + ".json")

    def get(self, url, body=True):
        """-> dict(status, location, ctype, text). Never follows redirects."""
        if self.cache and os.path.exists(self._cpath(url)):
            with open(self._cpath(url), encoding="utf-8") as f:
                return json.load(f)
        if self.offline:
            return {"status": None, "location": "", "ctype": "", "text": "", "error": "not cached"}
        for attempt in range(4):   # Wix now and then answers 200 with an empty page, or 429/5xx
            if attempt:
                time.sleep(2 ** attempt)
            res = self._get_once(url, body)
            st = res["status"]
            html_empty = (st == 200 and body and "html" in res["ctype"]
                          and "</html>" not in res["text"][-2000:].lower())
            if st is not None and st != 429 and st < 500 and not html_empty:
                break
        else:
            if res["status"] == 200:
                res["error"] = "empty or truncated page"
        if self.cache and res["status"] is not None and res["status"] < 500 and not res.get("error"):
            with open(self._cpath(url), "w", encoding="utf-8") as f:
                json.dump(res, f)
        return res

    def download(self, url, dest):
        if os.path.exists(dest) and os.path.getsize(dest) > 0:
            return 200
        if self.offline:
            return None
        self._wait()
        try:
            r = self.session.get(url, timeout=60)
        except Exception:
            return None
        if r.status_code == 200 and r.content:
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            with open(dest, "wb") as f:
                f.write(r.content)
        return r.status_code


def sitemap_urls(fetch):
    idx = fetch.get(SITEMAP_INDEX)
    seeds = []
    for loc in re.findall(r"<loc>\s*([^<\s]+)\s*</loc>", idx.get("text", "")):
        name = loc.rsplit("/", 1)[-1].replace("-sitemap.xml", "")
        kind = SITEMAP_KINDS.get(name, "other")
        sm = fetch.get(loc)
        for u in re.findall(r"<url>\s*<loc>\s*([^<\s]+)\s*</loc>", sm.get("text", "")):
            p = internal_path(u)
            if p is not None:
                seeds.append((p, "sitemap:" + name, kind))
    return seeds


def classify(path, sitemap_kind, res):
    st = res.get("status")
    if path.startswith("/product-page/"):
        kind = "product"
    elif path.startswith("/pricing-plans/"):
        kind = "pricing"
    elif path.startswith("/service-page/"):
        kind = "service"
    elif path.startswith(("/booking-calendar", "/book-online", "/booking-form")):
        kind = "booking"
    elif path.startswith("/event-details") or path.startswith("/events"):
        kind = "event"
    elif path.startswith("/post/") or path.startswith("/blog"):
        kind = "blog"
    elif sitemap_kind == "pages" or path.count("/") == 1:
        kind = "page"
    else:
        kind = "other"
    if st is None or res.get("error"):
        return "error", "other"
    if 300 <= st < 400:
        return "redirect", "other"
    if st >= 400:
        return "not-found" if st in (404, 410) else "error", "other"
    if kind in ("page",) and "html" in (res.get("ctype") or "html"):
        return kind, "pages"
    if kind == "product":
        return kind, "products"
    if kind == "pricing":
        return kind, "pricing"
    return kind, "other"


def empty_record(url, path, status):
    return {"url": url, "path": path, "status": status, "title": "", "description": "",
            "h1": [], "headings": [], "text": "", "blocks": [], "images": [], "links": [],
            "externalLinks": []}


def site_chrome(html, red):
    soup = BeautifulSoup(html, "html.parser")
    out = {}
    for key, sel in (("nav", "SITE_HEADER"), ("footer", "SITE_FOOTER")):
        el = soup.find(id=sel)
        items = []
        if el:
            for a in el.find_all("a", href=True):
                t = norm(a.get_text(" "))
                if t:
                    items.append({"text": red(t, "/", "site"), "href": red(link_target(a["href"]),
                                                                           "/", "site")})
        out[key] = items
    return out


def business_contacts(pages):
    """Published business phone(s) and info@ mail: tel: links in header/footer and on /contact-us."""
    phones, emails = set(), set()
    for path, html in pages.items():
        soup = BeautifulSoup(html, "html.parser")
        scopes = [soup] if path == "/contact-us" else [soup.find(id="SITE_HEADER"),
                                                       soup.find(id="SITE_FOOTER")]
        for sc in scopes:
            if sc is None:
                continue
            for a in sc.find_all("a", href=True):
                if a["href"].startswith("tel:"):
                    for m in RE_PHONE.finditer(unquote(a["href"][4:])):
                        phones.add("".join(m.groups()))
            if sc is not soup:
                for m in RE_PHONE.finditer(sc.get_text(" ")):
                    phones.add("".join(m.groups()))
            for m in RE_EMAIL.finditer(sc.get_text(" ")):
                if m.group(0).lower().startswith("info@"):
                    emails.add(m.group(0).lower())
        # a number printed as the studio's own line: next to the info@ address (Wix business
        # info card) or introduced as "studio cell/phone/line"
        root = soup.find(id="PAGES_CONTAINER") or soup
        text = norm(root.get_text(" "))
        for m in RE_PHONE.finditer(text):
            around = text[max(0, m.start() - 80):m.end() + 80].lower()
            if "info@" in around or RE_STUDIO_LINE.search(text[max(0, m.start() - 80):m.start()]):
                phones.add("".join(m.groups()))
    return {"phones": phones, "emails": emails}


RE_STUDIO_LINE = re.compile(r"(?i)\bstudio(?:'s)?\s+(?:cell|phone|line|number|text line)\b")


def crawl(out_dir, cache=None, offline=False, images=True, log=print):
    fetch = Fetcher(cache, offline)
    seeds = sitemap_urls(fetch)
    sitemap_kind = {}
    source = {}
    for p, src, kind in seeds:
        sitemap_kind.setdefault(p, kind)
        source.setdefault(p, src)
    queue = sorted(set(p for p, _, _ in seeds))
    seen, responses = set(queue), {}
    while queue and len(responses) < MAX_URLS:
        path = queue.pop(0)
        url = SITE + (path if path != "/" else "")
        if NO_FETCH.match(path):
            responses[path] = {"status": None, "skipped": "member/login area — not entered"}
            continue
        res = fetch.get(url, body=not FILE_EXT.search(path))
        responses[path] = res
        new = []
        if res.get("status") and 300 <= res["status"] < 400 and res.get("location"):
            t = internal_path(res["location"], url)
            if t is not None:
                new.append(t)
        if res.get("text") and "html" in (res.get("ctype") or ""):
            soup = BeautifulSoup(res["text"], "html.parser")
            for a in soup.find_all("a", href=True):
                t = internal_path(a["href"], url)
                if t is not None:
                    new.append(t)
        for t in sorted(set(new)):
            if t not in seen:
                seen.add(t)
                source.setdefault(t, "link:" + path)
                queue.append(t)
        log(f"[{len(responses):3d}] {res.get('status')} {path}")

    html_ok = {p: r["text"] for p, r in responses.items()
               if r.get("status") == 200 and r.get("text")}
    business = business_contacts(html_ok)
    red = Redactor(business)
    statuses = {p: r.get("status") for p, r in responses.items()}
    groups = defaultdict(list)
    for path in sorted(responses):
        res = responses[path]
        url = SITE + (path if path != "/" else "")
        kind, group = classify(path, sitemap_kind.get(path), res)
        if path in html_ok and "html" in (res.get("ctype") or ""):
            rec, _ = parse_page(res["text"], url, 200, business, redactor=red)
        else:
            rec = empty_record(url, path, res.get("status"))
        rec["kind"] = kind
        rec["source"] = source.get(path, "")
        if res.get("skipped"):
            rec["skipped"] = res["skipped"]
        if res.get("error"):
            rec["error"] = res["error"]
        if res.get("location"):
            rec["redirect"] = link_target(res["location"], url)
        if res.get("ctype") and "html" not in res["ctype"]:
            rec["contentType"] = res["ctype"]
        if group == "products":
            pf = product_fields(res["text"], path, red)
            for img in pf.pop("media"):
                if img["src"] not in {i["src"] for i in rec["images"]}:
                    rec["images"].append(img)
            rec.update(pf)
            rec["name"] = rec["h1"][0] if rec["h1"] else rec["title"].split(" | ")[0]
        groups[group].append(rec)

    # product category: Wix Stores category names (from category widgets on shop pages);
    # categoryPath = the most specific shop page that lists the product
    cat_names, cat_pages = {}, defaultdict(set)
    for path, html in html_ok.items():
        for cid, name in RE_CATEGORY.findall(html):
            if cid != ALL_PRODUCTS:
                cat_names.setdefault(cid, json.loads('"' + name + '"'))
                cat_pages[cid].add(path)
    lists = defaultdict(list)
    for r in groups["pages"]:
        prods = [l for l in r["links"] if l.startswith("/product-page/")]
        for l in prods:
            lists[l].append((len(prods), r["path"]))
    for p in groups["products"]:
        ids = [c for c in p.pop("categoryIds", []) if c in cat_names]
        names = sorted({cat_names[c] for c in ids})
        p["categories"] = names
        p["category"] = names[0] if len(names) == 1 else ", ".join(names)
        cands = sorted(lists.get(p["path"], []))
        p["categoryPath"] = cands[0][1] if cands else ""

    # images
    used = defaultdict(set)
    alts = {}
    for g in groups.values():
        for r in g:
            for img in r["images"]:
                used[(img["src"], img["local"])].add(r["path"])
                if img["alt"] and img["src"] not in alts:
                    alts[img["src"]] = img["alt"]
    image_list, broken = [], {}
    root_dir = os.path.dirname(os.path.abspath(out_dir))
    for (src, local) in sorted(used, key=lambda k: k[1]):
        entry = {"src": src, "local": local, "alt": alts.get(src, ""),
                 "usedOn": sorted(used[(src, local)])}
        if images:
            st = fetch.download(download_url(src), os.path.join(root_dir, local))
            if st != 200:
                broken[src] = st
                entry["status"] = st
                entry["local"] = ""
        image_list.append(entry)
    if broken:   # a failed download leaves no local copy on the page records either
        for g in groups.values():
            for r in g:
                for img in r["images"]:
                    if img["src"] in broken:
                        img["local"] = ""
                for b in r["blocks"]:
                    if b["type"] == "image" and b["src"] in broken:
                        b["local"] = ""

    site = site_chrome(html_ok.get("/", ""), red)
    inv = assemble(groups, image_list, site)
    issues = build_issues(inv["pages"] + inv["products"] + inv["pricing"] +
                          [r for r in inv["other"] if r.get("status") == 200],
                          statuses, broken)
    redactions = red.report()
    os.makedirs(out_dir, exist_ok=True)
    for name, obj in (("inventory.json", inv), ("crawl-issues.json", issues),
                      ("redactions.json", redactions)):
        with open(os.path.join(out_dir, name), "w", encoding="utf-8", newline="\n") as f:
            f.write(dump_json(obj))
    with open(os.path.join(out_dir, "README.md"), "w", encoding="utf-8", newline="\n") as f:
        f.write(summary(inv, issues, redactions, images))
    return inv, issues, redactions


def summary(inv, issues, redactions, images):
    kinds = defaultdict(int)
    for key in ("pages", "products", "pricing", "other"):
        for r in inv[key]:
            kinds[(key, r.get("kind", ""), r.get("status"))] += 1
    itypes = defaultdict(int)
    for i in issues:
        for x in i["issues"]:
            itypes[x["type"]] += 1
    rk = defaultdict(int)
    for r in redactions:
        rk[r["kind"]] += r["count"]
    lines = ["# Опись сайта handeyeceramics.com", "",
             "Сгенерировано `python scripts/crawl/crawl.py`; проверка — "
             "`python scripts/crawl/validate.py`. Руками не править: повторный обход перезапишет.",
             "", "- `inventory.json` — опись: `pages`, `products`, `pricing`, `images`, `other`, `site`",
             "- `crawl-issues.json` — SEO-находки по страницам",
             "- `redactions.json` — где вырезаны секреты и частные контакты (без значений)",
             "- `images/` — картинки (Wix, длинная сторона до 2400px; gif/svg — оригинал)", "",
             "## URL", "", "| раздел | вид | статус | сколько |", "|---|---|---|---|"]
    for (key, kind, st), n in sorted(kinds.items(), key=lambda x: (x[0][0], x[0][1], str(x[0][2]))):
        lines.append(f"| {key} | {kind} | {st} | {n} |")
    total = sum(kinds.values())
    lines += [f"| всего | | | {total} |", "",
              f"## Картинки: {len(inv['images'])}"
              + ("" if images else " (не скачивались)"), "",
              f"## Находки SEO: {sum(itypes.values())} на {len(issues)} страницах", ""]
    for t, n in sorted(itypes.items()):
        lines.append(f"- {t}: {n}")
    lines += ["", f"## Вырезано: {sum(rk.values())}", ""]
    for t, n in sorted(rk.items()):
        lines.append(f"- {t}: {n}")
    for r in redactions:
        lines.append(f"  - `{r['path']}` — {r['kind']} ×{r['count']} ({', '.join(r['fields'])})")
    return "\n".join(lines) + "\n"


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "..", "..", "content"))
    ap.add_argument("--cache")
    ap.add_argument("--offline", action="store_true")
    ap.add_argument("--no-images", action="store_true")
    a = ap.parse_args(argv)
    if a.offline and not a.cache:
        ap.error("--offline needs --cache")
    inv, issues, red = crawl(os.path.normpath(a.out), a.cache, a.offline, not a.no_images)
    print(f"pages={len(inv['pages'])} products={len(inv['products'])} pricing={len(inv['pricing'])}"
          f" other={len(inv['other'])} images={len(inv['images'])} issuePages={len(issues)}"
          f" redactions={sum(r['count'] for r in red)}")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
