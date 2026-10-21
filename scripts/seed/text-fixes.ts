/**
 * Lines of the old site that Wix printed as one run-on paragraph — the group
 * price list of the team-building page, typed in capitals without a break —
 * set as a small heading and a list, every figure kept, the words as they
 * were (decision of 2026-10-21). The one rule, shared by the seed and by
 * tests/site/inventory.test.ts, which looks for the heading and the items
 * where it would look for the old line.
 */
import * as L from "./lexical";

export type TextFix = { heading?: string; items: string[] };

const squash = (s: string) => s.replace(/\s+/g, " ").trim();

/** By page path, then by the old paragraph (whitespace squashed). */
const FIXES: Record<string, Record<string, TextFix>> = {
  "/team-building-special-events": {
    "If Hand Building Mugs": { heading: "If Hand Building Mugs", items: [] },
    "3 STUDENTS $83 PER STUDENT 4-5 STUDENTS $75 PER STUDENT 6-15 STUDENTS= $55 PER STUDENT 16-50 STUDENTS= $50 PER STUDENT": {
      items: ["3 students: $83 per student", "4–5 students: $75 per student", "6–15 students: $55 per student", "16–50 students: $50 per student"],
    },
    "IF WHEEL THROWING . IF WHEEL THROWING 3 STUDENTS $83 PER STUDENT 4-5 STUDENTS $75 PER STUDENT 6-9 STUDENTS $65 PER STUDENT 10-15 STUDENTS= $60 PER STUDENT 16-50 STUDENTS= $55 PER STUDENT":
      {
        heading: "If Wheel Throwing",
        items: [
          "3 students: $83 per student",
          "4–5 students: $75 per student",
          "6–9 students: $65 per student",
          "10–15 students: $60 per student",
          "16–50 students: $55 per student",
        ],
      },
    "TIME: GROUPs OVER 5 ARE 2.5 HRS + 15-20 MIN CLEAN UP, GROUPS UNDER 6 ARE 2 HRS": {
      heading: "Time",
      items: ["Groups over 5: 2.5 hrs + 15–20 min clean up", "Groups under 6: 2 hrs"],
    },
    "IF WHEEL THROWING . If wheel is picked: groups of 8 or more require 1 assistant instructor groups 13 or more require 2 assistant instructors groups 19 or more require 3 assistant instructors, + a 2nd lead instructor at$100+gst. groups of 25 or more 4 assistant instructors groups of 30 or more 5 assistant instructors":
      {
        heading: "Assistant instructors if wheel is picked",
        items: [
          "Groups of 8 or more: 1 assistant instructor",
          "Groups of 13 or more: 2 assistant instructors",
          "Groups of 19 or more: 3 assistant instructors, plus a 2nd lead instructor at $100 + GST",
          "Groups of 25 or more: 4 assistant instructors",
          "Groups of 30 or more: 5 assistant instructors",
        ],
      },
    "If Hand-building and painting mugs, sushi plates , 1 assistant instructor needed if 15 or more 2 assistants if 27 or more hand building $70+ gst per extra, instructor":
      {
        heading: "Assistant instructors if hand-building and painting mugs or sushi plates",
        items: ["15 or more: 1 assistant instructor", "27 or more: 2 assistant instructors", "Each extra hand-building instructor: $70 + GST"],
      },
  },
};

/** The paths that have fixes, for a test to check them against the inventory. */
export const FIXED_PATHS = Object.keys(FIXES);

/** The fixes of a page: old paragraph → heading and items. */
export const textFixes = (path: string): Record<string, TextFix> => FIXES[path] || {};

/** The fix of one paragraph of the old page, if it has one. */
export function textFix(path: string, text: string): TextFix | undefined {
  return FIXES[path]?.[squash(text)];
}

/** The words a fix puts on the page: its heading, then its items. */
export const textFixLines = (fix: TextFix): string[] => [...(fix.heading ? [fix.heading] : []), ...fix.items];

/** The rich-text nodes of a fix: a small heading and a bullet list. */
export function textFixNodes(fix: TextFix): L.Node[] {
  const nodes: L.Node[] = [];
  if (fix.heading) nodes.push(L.heading(fix.heading, 3));
  if (fix.items.length) nodes.push(L.list(fix.items));
  return nodes;
}
