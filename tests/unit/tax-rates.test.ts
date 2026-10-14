/**
 * Manual tax rates (R23i): the table of the specification, written out by hand.
 * BC charges GST 5% and PST 7%; Alberta GST only; services are GST only
 * everywhere; exempt lines carry no tax; an unknown province gets GST.
 */
import { describe, expect, it } from "vitest";
import { ratesFor } from "../../lib/payments/tax";

describe("ratesFor", () => {
  it("BC goods: GST 5 and PST 7", () => {
    expect(ratesFor("BC", "goods")).toEqual([
      { code: "GST", province: "BC", percentage: 5 },
      { code: "PST", province: "BC", percentage: 7 },
    ]);
  });

  it("BC service: GST only", () => {
    expect(ratesFor("BC", "service")).toEqual([{ code: "GST", province: "BC", percentage: 5 }]);
  });

  it("AB goods: GST only", () => {
    expect(ratesFor("AB", "goods")).toEqual([{ code: "GST", province: "AB", percentage: 5 }]);
  });

  it("exempt: nothing", () => {
    expect(ratesFor("BC", "exempt")).toEqual([]);
    expect(ratesFor("AB", "exempt")).toEqual([]);
  });

  it("an unknown province: GST 5", () => {
    expect(ratesFor("ZZ", "goods")).toEqual([{ code: "GST", province: "ZZ", percentage: 5 }]);
    expect(ratesFor("", "service")).toEqual([{ code: "GST", province: "", percentage: 5 }]);
  });

  it("the province is read case-insensitively and trimmed", () => {
    expect(ratesFor(" bc ", "goods").map((l) => l.code)).toEqual(["GST", "PST"]);
  });
});
