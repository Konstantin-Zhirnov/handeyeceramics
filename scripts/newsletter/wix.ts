/**
 * Reading the Wix Contacts export (CSV, one or several parts) into the people
 * to put on the Mailchimp list: only those Wix shows as subscribed to email,
 * one row per address, with their name and the tag of their city. Pure: the
 * columns are found by their header, so a renamed or reordered export only
 * needs a look at the dry run.
 */

/** RFC 4180: quoted fields, doubled quotes, line breaks inside quotes, CRLF or LF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const s = text.replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"' && s[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((v) => v.trim()));
}

const norm = (h: string) => h.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** The columns the import needs, by the first header that fits; `status` and `email` are required. */
export function findColumns(header: string[]) {
  const h = header.map(norm);
  const pick = (...tests: ((x: string) => boolean)[]) => {
    for (const t of tests) {
      const i = h.findIndex(t);
      if (i >= 0) return i;
    }
    return -1;
  };
  return {
    email: pick((x) => x === "email 1", (x) => x === "email", (x) => x.startsWith("email") && !x.includes("status") && !x.includes("subscri")),
    status: pick((x) => x.includes("email") && x.includes("subscri") && x.includes("status") && !x.includes("date") && !x.includes("updated")),
    first: pick((x) => x === "first name"),
    last: pick((x) => x === "last name"),
    city: pick((x) => x === "address 1 city", (x) => x.includes("city")),
  };
}

export type CityTags = Map<string, string>;

/** "Nanaimo=Nanaimo,Burnaby=Vancouver" → city (lower case) → tag. */
export function parseCityTags(spec: string | undefined): CityTags {
  const map: CityTags = new Map();
  for (const pair of (spec || "").split(",")) {
    const [city, tag] = pair.split("=").map((x) => x?.trim());
    if (city && tag) map.set(city.toLowerCase(), tag);
  }
  return map;
}

export type WixSubscriber = { email: string; firstName?: string; lastName?: string; tag?: string };

export type WixReadout = { subscribers: WixSubscriber[]; rows: number; notSubscribed: number; noEmail: number; duplicates: number; statuses: Map<string, number>; untaggedCities: Map<string, number> };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function wixSubscribers(files: string[][][], cityTags: CityTags): WixReadout {
  const out: WixReadout = { subscribers: [], rows: 0, notSubscribed: 0, noEmail: 0, duplicates: 0, statuses: new Map(), untaggedCities: new Map() };
  const seen = new Set<string>();
  for (const [header, ...rows] of files) {
    if (!header) continue;
    const col = findColumns(header);
    if (col.email < 0 || col.status < 0) throw new Error(`The export has no email or no subscriber status column: ${header.join(" | ")}`);
    for (const r of rows) {
      out.rows++;
      const status = (r[col.status] || "").trim();
      out.statuses.set(status || "(empty)", (out.statuses.get(status || "(empty)") || 0) + 1);
      if (status.toLowerCase() !== "subscribed") {
        out.notSubscribed++;
        continue;
      }
      const email = (r[col.email] || "").trim().toLowerCase();
      if (!EMAIL.test(email)) {
        out.noEmail++;
        continue;
      }
      if (seen.has(email)) {
        out.duplicates++;
        continue;
      }
      seen.add(email);
      const city = col.city >= 0 ? (r[col.city] || "").trim() : "";
      const tag = city ? cityTags.get(city.toLowerCase()) : undefined;
      if (!tag) out.untaggedCities.set(city || "(no city)", (out.untaggedCities.get(city || "(no city)") || 0) + 1);
      const first = col.first >= 0 ? (r[col.first] || "").trim() : "";
      const last = col.last >= 0 ? (r[col.last] || "").trim() : "";
      out.subscribers.push({ email, ...(first ? { firstName: first } : {}), ...(last ? { lastName: last } : {}), ...(tag ? { tag } : {}) });
    }
  }
  return out;
}
