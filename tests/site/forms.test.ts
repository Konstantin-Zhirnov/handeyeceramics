import * as cheerio from "cheerio";
import { beforeAll, describe, expect, inject, it } from "vitest";
import { editorToken } from "./editor";

/**
 * The enquiry forms, through HTTP only: the page carries the form, a valid
 * submission is stored with its answers, an invalid one is refused with a
 * message. Stored enquiries are read back through the REST API as a signed-in
 * editor (anonymous reads are 403).
 *
 * These tests write enquiries, which nobody can delete, and each one sends the
 * owner a letter. So they run only against the throw-away database the test
 * setup seeds itself; against a server you started (TEST_BASE_URL) they refuse
 * to run unless you say it is a temporary one: TEST_TEMP_DB=1.
 */
const base = () => inject("baseURL");
const ENDPOINT = "/forms/enquiry";

function assertThrowAwayTarget() {
  const host = new URL(base()).hostname;
  if (host !== "localhost" && host !== "127.0.0.1") {
    throw new Error(`forms tests write enquiries: refusing to run against ${host}`);
  }
  if (process.env.TEST_BASE_URL && process.env.TEST_TEMP_DB !== "1") {
    throw new Error(
      "forms tests write enquiries that cannot be deleted and send letters: " +
        "run them without TEST_BASE_URL, or set TEST_TEMP_DB=1 if that server uses a temporary database",
    );
  }
}

let seq = 0;
const unique = (tag: string) => `${tag}-${Date.now()}-${++seq}@example.com`;

async function submit(body: Record<string, unknown>, headers: Record<string, string> = {}) {
  const res = await fetch(`${base()}${ENDPOINT}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    message?: string;
    errors?: Record<string, string>;
  };
  return { status: res.status, json };
}

let token = "";

type Stored = {
  id: number;
  type: string;
  email: string;
  message?: string | null;
  page?: string | null;
  status: string;
  createdAt: string;
  answers?: { question: string; answer: string }[] | null;
};

async function storedByEmail(email: string): Promise<Stored[]> {
  const res = await fetch(`${base()}/api/enquiries?where[email][equals]=${encodeURIComponent(email)}&depth=0`, {
    headers: { Authorization: `JWT ${token}` },
  });
  expect(res.status).toBe(200);
  return ((await res.json()) as { docs: Stored[] }).docs;
}

const answersOf = (doc: Stored) => Object.fromEntries((doc.answers || []).map((a) => [a.question, a.answer]));

beforeAll(async () => {
  assertThrowAwayTarget();
  token = await editorToken(base());
});

describe("enquiry forms: pages", () => {
  /** Labels and choices as on the old site (the full list is checked in tests/unit/forms-live.test.ts). */
  const expected: Record<string, { type: string; labels: string[]; options: string[] }> = {
    "/contact-us": {
      type: "contact",
      labels: [
        "Email",
        "What would you like to book?",
        "What level of studio access?",
        "Which type of wheel?",
        "How many in your group?",
        "Select a date",
        "Preferred Time",
        "Comments",
      ],
      options: [
        "Group Workshop",
        "Date Night",
        "Studio Membership",
        "Wheel Rental",
        "General Question",
        "24/7 Access",
        "Midnight to Noon Access",
        "Floor model",
        "Table top model",
        "02:30 PM",
      ],
    },
    "/commissions-form": {
      type: "commission",
      labels: ["Email", "What are you interested in?", "Object Dimensions", "When do you need it by?", "Comments"],
      options: ["Coffee mug", "Cremation urn", "Hanging plant pot", "Film prop work", "Hand-painted vase", "Other"],
    },
  };

  for (const [path, want] of Object.entries(expected)) {
    it(`${path} carries the ${want.type} form with the Wix fields`, async () => {
      const res = await fetch(`${base()}${path}`);
      expect(res.status).toBe(200);
      const $ = cheerio.load(await res.text());
      const form = $(`form[data-enquiry-form="${want.type}"]`);
      expect(form.length).toBe(1);

      const labels = form
        .find("label")
        .map((_, el) => $(el).text().replace(/\s*\*\s*$/, "").trim())
        .get();
      for (const label of want.labels) expect(labels).toContain(label);
      // every label points at a real control
      form.find("label[for]").each((_, el) => {
        expect(form.find(`[id="${$(el).attr("for")}"]`).length).toBe(1);
      });

      const options = form.find("option").map((_, el) => $(el).text().trim()).get();
      for (const option of want.options) expect(options).toContain(option);

      expect(form.find('input[type="email"][required]').length).toBe(1);
      expect(form.find('button[type="submit"]').text().trim()).toBe("Send");
    });
  }
});

describe("enquiry forms: valid submissions are stored", () => {
  it("stores a contact enquiry with every answer", async () => {
    const email = unique("contact");
    const { status, json } = await submit({
      type: "contact",
      page: "/contact-us",
      values: {
        email,
        booking: "Group Workshop",
        groupSize: "6",
        date: "2026-11-14",
        time: "02:30 PM",
        comments: "A birthday, two of us have thrown before.",
      },
    });
    expect(status).toBe(201);
    expect(json.ok).toBe(true);

    const docs = await storedByEmail(email);
    expect(docs).toHaveLength(1);
    const doc = docs[0];
    expect(doc.type).toBe("contact");
    expect(doc.status).toBe("new");
    expect(doc.page).toBe("/contact-us");
    expect(doc.message).toBe("A birthday, two of us have thrown before.");
    expect(Date.now() - new Date(doc.createdAt).getTime()).toBeLessThan(120_000);
    expect(answersOf(doc)).toEqual({
      "What would you like to book?": "Group Workshop",
      "How many in your group?": "6",
      "Select a date": "2026-11-14",
      "Preferred Time": "02:30 PM",
      Comments: "A birthday, two of us have thrown before.",
    });
  });

  it("stores a commission enquiry with every answer", async () => {
    const email = unique("commission");
    const { status, json } = await submit({
      type: "commission",
      page: "/commissions-form",
      values: {
        email,
        interest: "Cremation urn",
        dimensions: "10 x 6 in, 2 L",
        neededBy: "2026-12-01",
        comments: "",
      },
    });
    expect(status).toBe(201);
    expect(json.ok).toBe(true);

    const docs = await storedByEmail(email);
    expect(docs).toHaveLength(1);
    expect(docs[0].type).toBe("commission");
    expect(docs[0].page).toBe("/commissions-form");
    expect(answersOf(docs[0])).toEqual({
      "What are you interested in?": "Cremation urn",
      "Object Dimensions": "10 x 6 in, 2 L",
      "When do you need it by?": "2026-12-01",
    });
  });

  it("stores the page only as a normalised site path", async () => {
    const send = async (page: unknown) => {
      const email = unique("page");
      const { status } = await submit({ type: "contact", page, values: { email, booking: "General Question" } });
      expect(status).toBe(201);
      return (await storedByEmail(email))[0].page ?? null;
    };
    expect(await send("/contact-us/?utm_source=x#top")).toBe("/contact-us");
    expect(await send("https://evil.example/contact-us")).toBeNull();
    expect(await send("javascript:alert(1)")).toBeNull();
    expect(await send("contact-us")).toBeNull();
    expect(await send("/a\nIn the admin: https://evil.example")).toBeNull();
    expect(await send(42)).toBeNull();
  });
});

describe("enquiry forms: invalid submissions are refused", () => {
  const contact = (values: Record<string, string>) => ({ type: "contact", page: "/contact-us", values });

  it("refuses an empty email and says so", async () => {
    const marker = `empty-email-${Date.now()}`;
    const { status, json } = await submit(contact({ email: "", booking: "General Question", comments: marker }));
    expect(status).toBe(400);
    expect(json.ok).toBe(false);
    expect(json.errors?.email).toBe("Enter your email address.");
    expect(json.message).toBeTruthy();
  });

  it("refuses a malformed email, says so, and stores nothing", async () => {
    const email = `broken-${Date.now()}-at-example.com`;
    const { status, json } = await submit(contact({ email, booking: "General Question" }));
    expect(status).toBe(400);
    expect(json.errors?.email).toBe("Enter a valid email address, like name@example.com.");
    expect(await storedByEmail(email)).toHaveLength(0);
  });

  it("refuses a booking without the required choice, date and time", async () => {
    const email = unique("no-choice");
    const { status, json } = await submit(contact({ email }));
    expect(status).toBe(400);
    expect(Object.keys(json.errors || {}).sort()).toEqual(["booking", "date", "time"]);
    expect(await storedByEmail(email)).toHaveLength(0);
  });

  it("refuses an answer that is not one of the options", async () => {
    const email = unique("bad-option");
    const { status, json } = await submit(contact({ email, booking: "Free Pots For Everyone" }));
    expect(status).toBe(400);
    expect(json.errors?.booking).toBeTruthy();
    expect(await storedByEmail(email)).toHaveLength(0);
  });

  it("refuses an unknown form type", async () => {
    const { status } = await submit({ type: "newsletter", values: { email: unique("type") } });
    expect(status).toBe(400);
  });
});

describe("enquiry forms: bots", () => {
  const general = (email: string) => ({ type: "contact", page: "/contact-us", values: { email, booking: "General Question" } });

  it("stores nothing when the hidden trap field is filled", async () => {
    const email = unique("bot");
    const { status } = await submit({ ...general(email), company_url: "http://spam.example" });
    expect(status).toBeLessThan(500);
    expect(await storedByEmail(email)).toHaveLength(0);
  });

  // The test server has no proxy in front: requests arrive from the loopback
  // address, which is nobody's client address, so the limit counts per sender
  // email. No header is set to dodge it.
  it("stops a sender after five enquiries in a row, without stopping the others", async () => {
    const email = unique("flood");
    for (let i = 0; i < 5; i++) expect((await submit(general(email))).status).toBe(201);
    const sixth = await submit(general(email));
    expect(sixth.status).toBe(429);
    expect(sixth.json.message).toBeTruthy();
    expect(await storedByEmail(email)).toHaveLength(5);
    expect((await submit(general(unique("neighbour")))).status).toBe(201);
  });

  it("counts by the last forwarded hop: a made-up first hop does not reset the limit", async () => {
    // what a proxy would append; unique per run so a re-run starts a fresh count
    const proxyHop = `198.51.100.${1 + Math.floor(Math.random() * 250)}:${Date.now()}`;
    const from = (i: number) => ({ "x-forwarded-for": `203.0.113.${i + 1}, ${proxyHop}` });
    for (let i = 0; i < 5; i++) expect((await submit(general(unique("hop")), from(i))).status).toBe(201);
    const late = unique("hop-late");
    expect((await submit(general(late), from(77))).status).toBe(429);
    expect(await storedByEmail(late)).toHaveLength(0);
  });
});

describe("enquiries API", () => {
  it("refuses an anonymous create: enquiries come in only through the form route", async () => {
    const email = unique("direct");
    const res = await fetch(`${base()}/api/enquiries`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "contact", email, message: "hello", status: "done" }),
    });
    expect(res.status).toBe(403);
    expect(await storedByEmail(email)).toHaveLength(0);
  });
});
