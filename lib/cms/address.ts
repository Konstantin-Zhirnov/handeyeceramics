/**
 * The parts of a studio's postal address, as the admin writes it: the street
 * on the first line(s), "City, BC V6A 2Z9" on the last. Shared by the site
 * templates (server-only) and by the payments code, which also runs in plain
 * Node — so no `server-only` here.
 */
export type AddressParts = { street: string; locality: string; regionCode: string; postalCode: string };

export function addressParts(address: string | null | undefined): AddressParts {
  const lines = (address || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const last = lines.length > 1 ? lines[lines.length - 1] : "";
  const m = last.match(/^(.+?),\s*([A-Z]{2})(?:\s+(\S.*))?$/);
  if (!m) return { street: lines.join(", "), locality: "", regionCode: "", postalCode: "" };
  return { street: lines.slice(0, -1).join(", "), locality: m[1], regionCode: m[2], postalCode: m[3] || "" };
}
