/**
 * Joining the lines Wix split: hand-written pairs from content/inventory.json.
 * Lines that were separate on Wix stay separate; a phrase broken mid-sentence joins.
 */
import { describe, expect, it } from "vitest";
import { continuesLine } from "../../scripts/seed/wix-litter";

describe("continuesLine", () => {
  it("keeps lines that were separate on Wix apart", () => {
    // /about-us
    expect(continuesLine("(access through right gate Studio in Back of house)", "all 6 pm 6 wk classes held here")).toBe(false);
    expect(continuesLine("all 6 pm 6 wk classes held here", "currently only Wed 6PM available here")).toBe(false);
    // /membership-rentals
    expect(continuesLine("3.5 visits each", "no access during 6pm classes")).toBe(false);
    // /team-building-special-events
    expect(continuesLine("(A Home Based business)", "enter via right side gate studio in Back Yard")).toBe(false);
    // /student-resources: a lone letter is a label, not an article.
    expect(continuesLine("A", "Arriving at 322 E 5th Ave")).toBe(false);
    // Never after a sentence ends.
    expect(continuesLine("Book now.", "and bring a friend")).toBe(false);
  });

  it("joins the home page's lines that Wix broke mid-sentence", () => {
    expect(continuesLine("Unlock", "creative potential with a")).toBe(true);
    expect(continuesLine("creative potential with a", "Studio access")).toBe(true);
    expect(continuesLine("Membership", "with no time limits and flexible days to come use studio")).toBe(true);
    expect(continuesLine("with no time limits and flexible days to come use studio", "as low as $145 monthly")).toBe(true);
    expect(continuesLine("Pottery workshops for team building, family gatherings, bachelorettes , and", "kid's birthday parties.")).toBe(true);
  });
});
