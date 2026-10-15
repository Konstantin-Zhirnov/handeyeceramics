/**
 * Paying over HTTP through the fake gateway (R04, R04.2, R04.3, R07, R07.1,
 * R17i, R17i.1, R22i, R24i, R11, R25i): the whole path a buyer walks — the
 * cart checked, the order made and its seats held, the gateway's page, Pay,
 * the success page — and what the webhook does to an order: a wrong signature
 * refused, a refund applied once. Expected figures are worked out by hand from
 * the old site's prices (content/inventory.json): the wheel-throwing seat is
 * CA$296.80 on sale, GST 5% in BC.
 */
import Stripe from "stripe";
import { load } from "cheerio";
import { beforeAll, describe, expect, inject, it } from "vitest";
import { editorToken } from "./editor";

const base = () => inject("baseURL");
const CLASS = "/product-page/6-week-wheel-throwing-pottery-classes-in-vancouver";
const CLAY = "/product-page/coffee-clay";
const CHINATOWN_STUDIO = "/classes/vancouver-chinatown";

type Doc = Record<string, any>;
const json = { "Content-Type": "application/json" };
const where = (field: string, value: string | number) => `where[${field}][equals]=${encodeURIComponent(String(value))}`;

let token = "";
const auth = async () => {
  token ||= await editorToken(base());
  return { Authorization: `JWT ${token}` };
};
async function api(p: string, init: RequestInit = {}, asEditor = false): Promise<{ status: number; body: Doc }> {
  const res = await fetch(`${base()}/api${p}`, { ...init, headers: { ...json, ...(asEditor ? await auth() : {}), ...(init.headers || {}) } });
  const text = await res.text();
  let body: Doc = {};
  try {
    body = JSON.parse(text);
  } catch {
    /* an empty or HTML error body */
  }
  return { status: res.status, body };
}
const list = async (p: string, asEditor = false): Promise<Doc[]> => (await api(p, {}, asEditor)).body.docs || [];
const productId = async (path: string) => (await list(`/products?${where("path", path)}&depth=0`))[0].id as number;
const session = async (id: number): Promise<Doc> => (await api(`/sessions/${id}?depth=0`)).body;
const orderOf = async (cs: string): Promise<Doc> => (await list(`/orders?${where("stripeSessionId", cs)}&depth=0`, true))[0];
const registrationsOf = async (orderId: number) => list(`/registrations?${where("order", orderId)}&depth=0&limit=100`, true);

/** An open date of the class with all its seats still free. */
async function openSession(): Promise<Doc> {
  const docs = await list(`/sessions?${where("product", await productId(CLASS))}&${where("status", "open")}&depth=0&limit=100`);
  const free = docs.find((d) => d.left === d.seats && d.seats > 2);
  expect(free, "an open date with free seats").toBeDefined();
  return free!;
}

async function checkout(body: unknown, headers: Record<string, string> = {}) {
  const res = await fetch(`${base()}/checkout`, { method: "POST", headers: { ...json, ...headers }, body: JSON.stringify(body) });
  return { status: res.status, body: (await res.json()) as Doc };
}
/** The buttons of the fake gateway's page: the form posted as a browser would, the redirect kept. */
async function press(cs: string, action: "pay" | "abandon", fields: Record<string, string> = {}) {
  const form = new URLSearchParams({ cs, action, ...fields });
  return fetch(`${base()}/checkout/fake/pay`, { method: "POST", body: form, redirect: "manual" });
}
async function webhook(event: unknown, signature?: string) {
  const payload = JSON.stringify(event);
  const secret = inject("webhookSecret");
  const header = signature ?? (secret ? new Stripe("sk_test_unused").webhooks.generateTestHeaderString({ payload, secret }) : "fake");
  const res = await fetch(`${base()}/stripe/webhook`, { method: "POST", headers: { ...json, "stripe-signature": header }, body: payload });
  return { status: res.status, body: (await res.json().catch(() => ({}))) as Doc };
}

// The first requests compile the routes of the dev server: minutes on a slow machine, so not part of a test.
beforeAll(async () => {
  await Promise.all([fetch(`${base()}/cart`), fetch(`${base()}/checkout/success`), fetch(`${base()}/checkout/fake`), checkout({ lines: [] })]);
}, 600_000);

describe("POST /checkout", () => {
  it("refuses a cart that cannot be paid for, line by line", async () => {
    const empty = await checkout({ lines: [] });
    expect(empty.status).toBe(409);
    expect(empty.body.ok).toBe(false);
    expect(empty.body.errors).toContain("Your cart is empty");

    const gone = await checkout({ lines: [{ kind: "product", id: 999999, quantity: 1 }] });
    expect(gone.status).toBe(409);
    expect(gone.body.errors.join("\n")).toContain("This item is no longer available");

    expect((await fetch(`${base()}/checkout`, { method: "POST", body: "not json", headers: json })).status).toBe(400);
  });

  it("brakes one sender after five attempts in a row", async () => {
    const headers = { "x-forwarded-for": "203.0.113.9" };
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) statuses.push((await checkout({ lines: [] }, headers)).status);
    expect(statuses).toEqual([409, 409, 409, 409, 409, 429]);
    // Another sender is not held up by the first.
    expect((await checkout({ lines: [] }, { "x-forwarded-for": "203.0.113.10" })).status).toBe(409);
  });
});

describe("a seat and some clay, paid through the fake gateway", { timeout: 300_000 }, () => {
  let date: Doc;
  let cs = "";
  let order: Doc;

  it("POST /checkout makes a pending order with today's prices and holds the seats", async () => {
    date = await openSession();
    const clay = await productId(CLAY);
    const res = await checkout({ lines: [{ kind: "session", id: date.id, quantity: 2 }, { kind: "product", id: clay, quantity: 1 }] });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.order).toMatch(/^HE-\d{6}$/);
    const url = new URL(res.body.url);
    expect(url.pathname).toBe("/checkout/fake");
    cs = url.searchParams.get("cs")!;
    expect(cs).toMatch(/^cs_fake_/);

    order = await orderOf(cs);
    expect(order).toMatchObject({ status: "pending", number: res.body.order, gateway: "fake", currency: "cad", pickupStudio: date.studio });
    const seat = order.lines.find((l: Doc) => l.kind === "session");
    expect(seat).toMatchObject({ session: date.id, quantity: 2, unitAmount: 29680, taxGroup: "service", taxAmount: 2968, lineTotal: 62328 });
    const clayLine = order.lines.find((l: Doc) => l.kind === "product");
    expect(clayLine).toMatchObject({ product: clay, quantity: 1, unitAmount: 475, taxGroup: "goods", taxAmount: 57, lineTotal: 532 });
    expect(order.subtotal).toBe(59360 + 475);
    expect(order.tax).toBe(2968 + 57);
    expect(order.total).toBe(62328 + 532);
    // The seats are held, not sold, until the payment lands.
    expect(await session(date.id)).toMatchObject({ sold: 0, left: date.seats - 2 });
  });

  it("the gateway's page offers Pay and Abandon; without a session it is a 404", async () => {
    const res = await fetch(`${base()}/checkout/fake?cs=${cs}`);
    expect(res.status).toBe(200);
    const $ = load(await res.text());
    expect($("[data-fake-checkout] form[action='/checkout/fake/pay']")).toHaveLength(1);
    expect($("input[name=cs]").attr("value")).toBe(cs);
    for (const name of ["name", "email", "phone", "attendee"]) expect($(`input[name=${name}]`), name).toHaveLength(1);
    expect($("button[name=action][value=pay]")).toHaveLength(1);
    expect($("button[name=action][value=abandon]")).toHaveLength(1);
    expect((await fetch(`${base()}/checkout/fake?cs=cs_fake_nobody`)).status).toBe(404);
    expect((await fetch(`${base()}/checkout/fake`)).status).toBe(404);
  });

  it("Pay sends the buyer to the success page, which shows the order, the studio and what happens next", async () => {
    const paid = await press(cs, "pay", { name: "Ada Buyer", email: "ada@example.com", phone: "604-000-0000", attendee: "Ada's friend" });
    expect(paid.status).toBe(303);
    const next = new URL(paid.headers.get("location")!);
    expect(next.pathname).toBe("/checkout/success");
    expect(next.searchParams.get("session_id")).toBe(cs);

    const page = await fetch(`${base()}${next.pathname}${next.search}`);
    expect(page.status).toBe(200);
    const $ = load(await page.text());
    expect($("h1")).toHaveLength(1);
    expect($("h1").text()).toBe("Thank you for your order");
    expect($("[data-order]").attr("data-order")).toBe(order.number);
    expect($("body").text()).toContain(order.number);
    expect($("[data-order-lines]").text()).toContain(date.label);
    expect($("[data-order-total]").text()).toBe("CA$628.60");
    const studio = (await api(`/studios/${date.studio}?depth=0`)).body;
    expect($("[data-pickup-studio]").text()).toContain(studio.name);
    expect($("[data-pickup-studio]").text()).toContain(studio.address.split("\n")[0].trim());
    expect($("[data-what-next]").text()).toContain("What happens next");
    expect($("meta[name=robots]").attr("content")).toContain("noindex");
  });

  it("the order is paid, its students registered and the seats sold", async () => {
    const after = await orderOf(cs);
    expect(after.status).toBe("paid");
    expect(after.paidAt).toBeTruthy();
    expect(after.customer).toEqual({ name: "Ada Buyer", email: "ada@example.com", phone: "604-000-0000" });
    expect(after.attendee).toBe("Ada's friend");
    expect(after.events.filter((e: Doc) => e.type === "paid")).toHaveLength(1);
    const regs = await registrationsOf(after.id);
    expect(regs).toHaveLength(2);
    expect(regs.map((r) => [r.name, r.status, r.session])).toEqual([["Ada's friend", "confirmed", date.id], ["Ada's friend", "confirmed", date.id]]);
    expect(await session(date.id)).toMatchObject({ sold: 2, left: date.seats - 2 });
    // Shown again, the page finds the order done and shows it the same.
    expect((await fetch(`${base()}/checkout/success?session_id=${cs}`)).status).toBe(200);
  });

  it("a full refund from Stripe frees the seats and marks everyone refunded — once, however often the event arrives", async () => {
    const before = await orderOf(cs);
    const charge = (id: string) => ({
      id,
      type: "charge.refunded",
      data: { object: { id: "ch_fake_site_1", object: "charge", payment_intent: before.stripePaymentIntentId, amount: before.total, amount_refunded: before.total, refunded: true } },
    });
    const bad = await webhook(charge("evt_site_refund_bad"), "nonsense");
    expect(bad.status).toBe(400);
    expect((await orderOf(cs)).status).toBe("paid");

    const first = await webhook(charge("evt_site_refund_1"));
    expect(first.status).toBe(200);
    expect(first.body).toEqual({ received: true, handled: true });
    const again = await webhook(charge("evt_site_refund_1"));
    expect(again.status).toBe(200);

    const after = await orderOf(cs);
    expect(after.status).toBe("refunded");
    expect(after.refundedAmount).toBe(before.total);
    expect(after.events.filter((e: Doc) => e.type === "refunded")).toHaveLength(1);
    expect((await registrationsOf(after.id)).map((r) => r.status)).toEqual(["refunded", "refunded"]);
    expect(await session(date.id)).toMatchObject({ sold: 0, left: date.seats });
    expect((await webhook({ id: "evt_site_other", type: "payment_method.attached", data: { object: {} } })).body).toEqual({ received: true, handled: false });
  });
});

describe("the last seat", { timeout: 300_000 }, () => {
  it("goes to one buyer; the other gets 409 with what is short; abandoning gives it back", async () => {
    const product = await productId(CLASS);
    const studio = (await list(`/studios?${where("path", CHINATOWN_STUDIO)}&depth=0`))[0].id;
    const created = await api("/sessions", { method: "POST", body: JSON.stringify({ label: "Checkout test: one seat", product, studio, seats: 1, status: "open" }) }, true);
    expect(created.status).toBe(201);
    const id = created.body.doc.id as number;

    // Two buyers press Pay at the same moment: one gets the seat, the other is told it is gone.
    const both = await Promise.all([checkout({ lines: [{ kind: "session", id, quantity: 1 }] }), checkout({ lines: [{ kind: "session", id, quantity: 1 }] })]);
    expect(both.map((r) => r.status).sort()).toEqual([200, 409]);
    const first = both.find((r) => r.status === 200)!;
    const second = both.find((r) => r.status === 409)!;
    // The loser is refused either by the cart check (the hold already counted) or by the hold itself (then `short` says what is missing).
    expect(second.body.errors.join("\n")).toContain("Sold out");
    if (second.body.short) expect(second.body.short).toEqual([{ sessionId: id, left: 0 }]);
    expect(await session(id)).toMatchObject({ sold: 0, left: 0 });

    const cs = new URL(first.body.url).searchParams.get("cs")!;
    const left = await press(cs, "abandon");
    expect(left.status).toBe(303);
    expect(new URL(left.headers.get("location")!).pathname).toBe("/cart");
    const order = await orderOf(cs);
    expect(order.status).toBe("expired");
    expect(await session(id)).toMatchObject({ sold: 0, left: 1 });
    // The seat is for sale again, and the expired checkout is told so on its success page.
    expect((await checkout({ lines: [{ kind: "session", id, quantity: 1 }] })).status).toBe(200);
    const page = await fetch(`${base()}/checkout/success?session_id=${cs}`);
    expect(page.status).toBe(200);
    expect(load(await page.text())("h1").text()).toBe("This checkout has expired");
  });
});

describe("when Stripe's event is late", { timeout: 300_000 }, () => {
  it("the success page finishes the order on its own: paid, the student registered, the seat sold", async () => {
    const date = await openSession();
    const res = await checkout({ lines: [{ kind: "session", id: date.id, quantity: 1 }] });
    expect(res.status).toBe(200);
    const cs = new URL(res.body.url).searchParams.get("cs")!;
    const paid = await press(cs, "pay", { name: "Late Webhook", email: "late@example.com", skipWebhook: "1" });
    expect(paid.status).toBe(303);
    expect((await orderOf(cs)).status).toBe("pending");

    const page = await fetch(`${base()}/checkout/success?session_id=${cs}`);
    expect(page.status).toBe(200);
    expect(load(await page.text())("h1").text()).toBe("Thank you for your order");

    const order = await orderOf(cs);
    expect(order.status).toBe("paid");
    expect(order.customer).toMatchObject({ name: "Late Webhook", email: "late@example.com" });
    const regs = await registrationsOf(order.id);
    expect(regs.map((r) => [r.name, r.status])).toEqual([["Late Webhook", "confirmed"]]);
    expect(await session(date.id)).toMatchObject({ sold: 1, left: date.seats - 1 });
  });
});

describe("the other routes", () => {
  it("a success page for a session the site does not know is a 404", async () => {
    expect((await fetch(`${base()}/checkout/success?session_id=cs_fake_nobody`)).status).toBe(404);
    expect((await fetch(`${base()}/checkout/success`)).status).toBe(404);
  });

  it("POST /checkout/subscribe without a plan, or for a plan without a Stripe price, is 400", async () => {
    const none = await fetch(`${base()}/checkout/subscribe`, { method: "POST", body: new URLSearchParams({}), redirect: "manual" });
    expect(none.status).toBe(400);
    const [plan] = await list("/plans?limit=1&depth=0");
    expect(plan, "a plan of the seed").toBeDefined();
    expect(plan.stripePriceId ?? null).toBeNull();
    const priceless = await fetch(`${base()}/checkout/subscribe`, { method: "POST", body: new URLSearchParams({ plan: String(plan.id) }), redirect: "manual" });
    expect(priceless.status).toBe(400);
  });

  it("the old cart addresses lead to the new cart; only a GET is redirected", async () => {
    for (const from of ["/cart-page", "/checkout"]) {
      const res = await fetch(`${base()}${from}`, { redirect: "manual" });
      expect(res.status, from).toBe(301);
      expect(new URL(res.headers.get("location")!, base()).pathname).toBe("/cart");
    }
  });
});
