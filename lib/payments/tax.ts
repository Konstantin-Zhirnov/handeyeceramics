/**
 * Manual tax rates (R23i), a table in code: goods take every rate of the
 * province, services only GST, exempt lines nothing. An unknown province is
 * charged GST alone. The province comes from the pickup studio's region.
 */
import type { TaxGroup, TaxLine } from "./types";

const GST = 5;

/** Rates by province: GST everywhere, PST where the province charges it. */
const PROVINCES: Record<string, { GST: number; PST?: number }> = {
  BC: { GST, PST: 7 },
  AB: { GST },
};

export function ratesFor(province: string, taxGroup: TaxGroup): TaxLine[] {
  if (taxGroup === "exempt") return [];
  const code = province.trim().toUpperCase();
  const rates = PROVINCES[code] || { GST };
  const lines: TaxLine[] = [{ code: "GST", province: code, percentage: rates.GST }];
  if (taxGroup === "goods" && rates.PST) lines.push({ code: "PST", province: code, percentage: rates.PST });
  return lines;
}
