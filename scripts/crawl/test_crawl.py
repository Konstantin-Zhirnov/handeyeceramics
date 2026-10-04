"""Tests for the crawl module seam: page record -> inventory / issues.

Run: python -m unittest discover -s scripts/crawl -p "test_*.py"
Fixtures are hand-written HTML shaped like Wix server output; expected values are written by hand.
"""
import json
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(__file__))

import crawl  # noqa: E402

BUSINESS = {"phones": {"6045550100"}, "emails": {"info@example-studio.com"}}

PAGE = """<!doctype html><html><head><title>Wheel Class | Studio</title>
<meta name="description" content="Learn the wheel.">
</head><body>
<header id="SITE_HEADER"><a href="https://www.handeyeceramics.com/about-us">About</a></header>
<main id="PAGES_CONTAINER">
  <div><h1 class="font_0"><span>Wheel&nbsp;Class</span></h1></div>
  <div><p>Six weeks on the wheel.​</p></div>
  <div><img src="https://static.wixstatic.com/media/62bba2_abc~mv2.jpg/v1/fill/w_480,h_479,q_90/62bba2_abc~mv2.jpg" alt="Pots on a shelf"></div>
  <div><h2>Getting in</h2><p>The door code is 4821# after 6pm.</p>
  <p>Teacher page password: clay123</p>
  <p>Call 604-555-0100 or text Jane at 778 555 0199.</p>
  <p>Email info@example-studio.com or jane.doe@gmail.com</p></div>
  <a data-testid="linkElement" href="https://www.handeyeceramics.com/contact-us"><span>Book now</span></a>
  <form><label for="n">Name</label><input id="n" name="name" type="text" required>
  <input name="email" type="email" aria-label="Email"><textarea name="message"></textarea></form>
</main>
<footer id="SITE_FOOTER"><a href="tel:6045550100">604-555-0100</a></footer>
</body></html>"""


class ParsePageTest(unittest.TestCase):
    def setUp(self):
        self.rec, self.redactions = crawl.parse_page(
            PAGE, "https://www.handeyeceramics.com/wheel-class", 200, BUSINESS)

    def test_seo_fields(self):
        self.assertEqual(self.rec["url"], "https://www.handeyeceramics.com/wheel-class")
        self.assertEqual(self.rec["path"], "/wheel-class")
        self.assertEqual(self.rec["status"], 200)
        self.assertEqual(self.rec["title"], "Wheel Class | Studio")
        self.assertEqual(self.rec["description"], "Learn the wheel.")
        self.assertEqual(self.rec["h1"], ["Wheel Class"])
        self.assertEqual(self.rec["headings"], [
            {"level": 1, "text": "Wheel Class"}, {"level": 2, "text": "Getting in"}])

    def test_blocks_in_page_order(self):
        types = [b["type"] for b in self.rec["blocks"]]
        self.assertEqual(types, ["heading", "paragraph", "image", "heading", "paragraph",
                                 "paragraph", "paragraph", "paragraph", "button", "form"])
        self.assertEqual(self.rec["blocks"][1]["text"], "Six weeks on the wheel.")
        self.assertEqual(self.rec["blocks"][8], {"type": "button", "text": "Book now",
                                                  "href": "/contact-us"})
        form = self.rec["blocks"][9]
        self.assertEqual([f["name"] for f in form["fields"]], ["name", "email", "message"])
        self.assertEqual(form["fields"][0]["label"], "Name")
        self.assertTrue(form["fields"][0]["required"])
        self.assertTrue(self.rec["text"].startswith("Wheel Class\n\nSix weeks on the wheel."))

    def test_image_best_size_and_stable_local_name(self):
        self.assertEqual(self.rec["images"], [{
            "src": "https://static.wixstatic.com/media/62bba2_abc~mv2.jpg",
            "alt": "Pots on a shelf",
            "local": "content/images/62bba2_abc-mv2.jpg"}])

    def test_secrets_redacted(self):
        dump = json.dumps(self.rec)
        for secret in ["4821", "clay123", "0199", "jane.doe"]:
            self.assertNotIn(secret, dump)
        self.assertIn("604-555-0100", self.rec["text"])
        self.assertIn("info@example-studio.com", self.rec["text"])
        self.assertIn("[REDACTED]", self.rec["text"])
        kinds = sorted(r["kind"] for r in self.redactions)
        self.assertEqual(kinds, ["door-code", "email", "password", "phone"])
        self.assertTrue(all(r["path"] == "/wheel-class" for r in self.redactions))
        self.assertNotIn("4821", json.dumps(self.redactions))


def rec(path, title, desc="d", h1=("H",), links=(), images=()):
    return {"url": "https://www.handeyeceramics.com" + path, "path": path, "status": 200,
            "title": title, "description": desc, "h1": list(h1), "headings": [], "text": "",
            "blocks": [], "images": list(images), "links": list(links)}


class IssuesAndDeterminismTest(unittest.TestCase):
    def test_issues(self):
        records = [rec("/a", "Same"), rec("/b", "Same", desc=""), rec("/c", "C", h1=()),
                   rec("/d", "D", h1=("x", "y"), links=["/gone"])]
        statuses = {"/a": 200, "/b": 200, "/c": 200, "/d": 200, "/gone": 404}
        issues = crawl.build_issues(records, statuses, broken_images={})
        by = {i["path"]: sorted(x["type"] for x in i["issues"]) for i in issues}
        self.assertEqual(by, {"/a": ["duplicate-title"],
                              "/b": ["duplicate-title", "empty-description"],
                              "/c": ["no-h1"],
                              "/d": ["broken-link", "multiple-h1"]})

    def test_same_input_any_order_same_bytes(self):
        a = [rec("/b", "B"), rec("/a", "A")]
        b = [rec("/a", "A"), rec("/b", "B")]
        inv1 = crawl.dump_json(crawl.assemble({"pages": a, "products": [], "pricing": [],
                                               "other": []}, images=[]))
        inv2 = crawl.dump_json(crawl.assemble({"pages": b, "products": [], "pricing": [],
                                               "other": []}, images=[]))
        self.assertEqual(inv1, inv2)
        self.assertEqual([p["path"] for p in json.loads(inv1)["pages"]], ["/a", "/b"])


if __name__ == "__main__":
    unittest.main()


class ReadmeTest(unittest.TestCase):
    """content/README.md is in a public repository: it is written in English."""

    def test_summary_is_english(self):
        inv = {"pages": [dict(rec("/a", "A"), kind="page")], "products": [], "pricing": [], "other": [], "images": []}
        issues = [{"path": "/a", "issues": [{"type": "no-h1"}]}]
        redactions = [{"path": "/a", "kind": "email", "count": 1, "fields": ["text"]}]
        text = crawl.summary(inv, issues, redactions, images=False)
        self.assertNotRegex(text, "[Ѐ-ӿ]")
        self.assertIn("| pages | page | 200 | 1 |", text)
        self.assertIn("no-h1: 1", text)

    def test_hand_written_notes_survive_a_new_crawl(self):
        old = "# Old summary\n\n" + crawl.README_NOTES + "\n\n## Notes\n\n- checked by hand\n"
        new = crawl.readme_text("# New summary\n", old)
        self.assertTrue(new.startswith("# New summary\n"))
        self.assertIn("- checked by hand", new)
        self.assertNotIn("Old summary", new)
        self.assertEqual(crawl.readme_text("# New summary\n", None), "# New summary\n")
