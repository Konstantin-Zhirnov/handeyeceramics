/**
 * The mailing list: which environment switches Mailchimp on, how a buyer who
 * asked for the emails is added and tagged (through a stand-in fetch), and how
 * the Wix Contacts export becomes the list of subscribers to move.
 */
import { describe, expect, it, vi } from "vitest";
import { mailchimpConfig, splitName, subscribe, subscriberHash } from "../../lib/newsletter/mailchimp";
import { studioTag } from "../../lib/newsletter";
import { findColumns, parseCityTags, parseCsv, wixSubscribers } from "../../scripts/newsletter/wix";

const cfg = { apiKey: "k-us21", audienceId: "aud1", base: "https://us21.api.mailchimp.com/3.0" };

describe("mailchimpConfig", () => {
  it("needs a key with its data centre and an audience", () => {
    expect(mailchimpConfig({})).toBeNull();
    expect(mailchimpConfig({ MAILCHIMP_API_KEY: "abc", MAILCHIMP_AUDIENCE_ID: "x" })).toBeNull();
    expect(mailchimpConfig({ MAILCHIMP_API_KEY: "abc-us21", MAILCHIMP_AUDIENCE_ID: " aud1 " })).toEqual({ apiKey: "abc-us21", audienceId: "aud1", base: "https://us21.api.mailchimp.com/3.0" });
  });
});

describe("subscribe", () => {
  it("adds the person without touching an existing status, then the tags", async () => {
    const fetch = vi.fn(async () => new Response("{}", { status: 200 }));
    await subscribe(cfg, { email: " Ada@Example.com ", firstName: "Ada", tags: ["Vancouver", "Vancouver", ""] }, fetch);
    const hash = subscriberHash("ada@example.com");
    expect(hash).toMatch(/^[0-9a-f]{32}$/);
    const calls = fetch.mock.calls as unknown as [string, RequestInit][];
    expect(calls.map(([url, init]) => `${init.method} ${url}`)).toEqual([
      `PUT https://us21.api.mailchimp.com/3.0/lists/aud1/members/${hash}`,
      `POST https://us21.api.mailchimp.com/3.0/lists/aud1/members/${hash}/tags`,
    ]);
    expect(JSON.parse(String(calls[0][1].body))).toEqual({ email_address: "Ada@Example.com", status_if_new: "subscribed", merge_fields: { FNAME: "Ada" } });
    expect(JSON.parse(String(calls[1][1].body))).toEqual({ tags: [{ name: "Vancouver", status: "active" }] });
    expect(String((calls[0][1].headers as Record<string, string>).Authorization)).toMatch(/^Basic /);
  });

  it("names Mailchimp's reason when it refuses", async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ title: "Invalid Resource", detail: "looks fake" }), { status: 400 }));
    await expect(subscribe(cfg, { email: "a@b.co" }, fetch)).rejects.toThrow(/400: Invalid Resource: looks fake/);
  });
});

describe("names and tags", () => {
  it("splits a full name into FNAME and LNAME", () => {
    expect(splitName("Ada Lovelace King")).toEqual({ firstName: "Ada", lastName: "Lovelace King" });
    expect(splitName("  ")).toEqual({});
  });

  it("tags a studio with the city of its address", () => {
    expect(studioTag({ address: "739 Gore Ave\nVancouver, BC V6A 2Z9" })).toBe("Vancouver");
    expect(studioTag({ address: "" })).toBeUndefined();
  });
});

describe("the Wix Contacts export", () => {
  const csv = [
    '﻿"First Name","Last Name","Email 1","Address 1 - City","Email subscriber status"',
    'Ada,"Lovelace, King",ADA@example.com,Vancouver,Subscribed',
    'Bob,,bob@example.com,Nanaimo,Unsubscribed',
    'Cy,,cy@example.com,lantzville,Subscribed',
    'Dee,,not-an-email,Vancouver,Subscribed',
    'Eve,"Multi\nline",eve@example.com,Surrey,Subscribed',
    'Ada,,ada@example.com,Vancouver,Subscribed',
  ].join("\r\n");

  it("parses quoted fields, commas and line breaks inside quotes", () => {
    const rows = parseCsv(csv);
    expect(rows).toHaveLength(7);
    expect(rows[1][1]).toBe("Lovelace, King");
    expect(rows[5][1]).toBe("Multi\nline");
    expect(findColumns(rows[0])).toEqual({ email: 2, status: 4, first: 0, last: 1, city: 3 });
  });

  it("moves only the subscribed, once per address, tagged by city", () => {
    const r = wixSubscribers([parseCsv(csv)], parseCityTags("Vancouver=Vancouver, Lantzville=Nanaimo,bad"));
    expect(r.subscribers).toEqual([
      { email: "ada@example.com", firstName: "Ada", lastName: "Lovelace, King", tag: "Vancouver" },
      { email: "cy@example.com", firstName: "Cy", tag: "Nanaimo" },
      { email: "eve@example.com", firstName: "Eve", lastName: "Multi\nline" },
    ]);
    expect(r).toMatchObject({ rows: 6, notSubscribed: 1, noEmail: 1, duplicates: 1 });
    expect(Object.fromEntries(r.untaggedCities)).toEqual({ Surrey: 1 });
  });

  it("refuses an export without the columns it needs", () => {
    expect(() => wixSubscribers([parseCsv("Name,Phone\nA,1")], new Map())).toThrow(/no email or no subscriber status/);
  });
});
