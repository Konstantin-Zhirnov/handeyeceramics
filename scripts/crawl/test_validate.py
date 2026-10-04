"""Tests for the inventory validator: no private phone number survives in content/.

Run: python -m unittest discover -s scripts/crawl -p "test_*.py"
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(__file__))

import validate  # noqa: E402


class PhonesTest(unittest.TestCase):
    def test_private_number_next_to_studio_fails(self):
        # the word "studio" next to a number does not make it the studio's line
        self.assertIn("phone", validate.secrets_in("Ask the studio manager on 604-555-0199 after class"))
        self.assertIn("phone", validate.secrets_in("studio cell 1 (604) 555 0199"))

    def test_published_business_numbers_pass(self):
        self.assertEqual(validate.secrets_in("Then if needed call 778-898-3414 to get in"), set())
        self.assertEqual(validate.secrets_in("studio cell is monitored Mondays 1 (778) 874-5424"), set())

    def test_digits_inside_an_image_address_are_not_a_phone(self):
        record = {"path": "/x", "text": "A pot.",
                  "images": [{"src": "https://static.wixstatic.com/media/e1f013_a7f5d10c5282434697e547a19621.jpg",
                              "local": "content/images/e1f013_a7f5d10c5282434697e547a19621.jpg", "alt": ""}]}
        self.assertEqual(validate.record_secrets(record), set())
        record["text"] = "Text Jane at 778 555 0199."
        self.assertEqual(validate.record_secrets(record), {"phone"})


if __name__ == "__main__":
    unittest.main()
