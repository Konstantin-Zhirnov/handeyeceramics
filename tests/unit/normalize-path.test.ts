import { describe, expect, it } from "vitest";
import { normalizePath } from "../../collections/fields/path";

// Expectations written by hand from the rule: leading "/", no trailing "/",
// no query or hash, no repeated slashes, full URLs reduced to their path.
describe("normalizePath", () => {
  it.each([
    ["/", "/"],
    ["", ""],
    ["   ", ""],
    ["about-us", "/about-us"],
    ["/about-us/", "/about-us"],
    ["//product-page//apron///", "/product-page/apron"],
    ["/contact-us?lang=en#form", "/contact-us"],
    ["https://www.handeyeceramics.com/nanaimo-pottery-classes", "/nanaimo-pottery-classes"],
    ["https://www.handeyeceramics.com/", "/"],
    ["  /gift-card  ", "/gift-card"],
  ])("%j → %j", (input, expected) => {
    expect(normalizePath(input)).toBe(expected);
  });

  it("returns an empty string for non-strings", () => {
    expect(normalizePath(undefined)).toBe("");
    expect(normalizePath(42)).toBe("");
  });
});
