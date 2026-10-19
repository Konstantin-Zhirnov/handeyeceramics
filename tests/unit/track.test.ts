/**
 * Ad tracking: which tags the environment switches on, the purchase both
 * copies describe (one event id, the total with tax), the Conversions API
 * body with hashed customer details, and the call itself through a stand-in
 * fetch — nothing is sent without a pixel id and a token.
 */
import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { trackPurchase } from "../../lib/payments/track";
import { trackingConfig } from "../../lib/track/config";
import { metaPurchaseBody, normalPhone, purchaseData, purchaseEventId } from "../../lib/track/purchase";
import type { Order } from "../../payload-types";

const sha = (v: string) => createHash("sha256").update(v).digest("hex");

const order = (over: Partial<Order> = {}): Order =>
  ({
    id: 7,
    number: "HE-000007",
    status: "paid",
    paidAt: "2026-10-18T19:00:00.000Z",
    total: 11760,
    customer: { name: "Ada Lovelace King", email: " Ada@Example.COM ", phone: "(604) 555-0100" },
    lines: [
      { kind: "session", session: 31, label: "Date night", quantity: 2, unitAmount: 5000, taxAmount: 500 },
      { kind: "product", product: { id: 9 }, label: "Apron", quantity: 1, unitAmount: 1500, taxAmount: 180 },
    ],
    tracking: { fbp: "fb.1.1700000000000.123", fbc: "fb.1.1700000000000.AbC", clientIp: "203.0.113.5", userAgent: "Mozilla/5.0" },
    createdAt: "2026-10-18T18:50:00.000Z",
    updatedAt: "2026-10-18T19:00:00.000Z",
    ...over,
  }) as unknown as Order;

describe("trackingConfig", () => {
  it("is all off without the environment", () => {
    expect(trackingConfig({})).toEqual({});
    expect(Object.values(trackingConfig({})).filter(Boolean)).toEqual([]);
  });

  it("takes the ids it recognises and nothing hanging off a missing one", () => {
    const on = trackingConfig({ META_PIXEL_ID: " 123 ", META_CAPI_TOKEN: "t", GOOGLE_ADS_ID: "AW-42", GOOGLE_ADS_PURCHASE_LABEL: "abc" });
    expect(on).toMatchObject({ metaPixelId: "123", metaCapiToken: "t", googleAdsId: "AW-42", googlePurchaseLabel: "abc" });
    expect(trackingConfig({ META_CAPI_TOKEN: "t", GOOGLE_ADS_PURCHASE_LABEL: "abc" })).toMatchObject({ metaCapiToken: undefined, googlePurchaseLabel: undefined });
    expect(trackingConfig({ META_PIXEL_ID: "not-a-pixel", GOOGLE_ADS_ID: "G-123" })).toMatchObject({ metaPixelId: undefined, googleAdsId: undefined });
  });
});

describe("purchaseData", () => {
  it("carries the order total with tax in dollars and one id per item", () => {
    const p = purchaseData(order());
    expect(p).toMatchObject({ eventId: purchaseEventId("HE-000007"), orderId: "HE-000007", value: 117.6, currency: "CAD", numItems: 3 });
    expect(p.contents).toEqual([
      { id: "session-31", quantity: 2, item_price: 50 },
      { id: "product-9", quantity: 1, item_price: 15 },
    ]);
    expect(p.contentIds).toEqual(["session-31", "product-9"]);
  });
});

describe("metaPurchaseBody", () => {
  it("hashes what identifies the buyer and keeps the browser's own ids as they are", () => {
    const body = metaPurchaseBody(order(), { sourceUrl: "https://example.test/checkout/success" });
    const [event] = body.data;
    expect(event).toMatchObject({ event_name: "Purchase", event_id: "purchase-HE-000007", action_source: "website", event_time: 1792350000 });
    expect(event.user_data).toEqual({
      em: [sha("ada@example.com")],
      ph: [sha("16045550100")],
      fn: [sha("ada")],
      ln: [sha("lovelace king")],
      country: [sha("ca")],
      client_ip_address: "203.0.113.5",
      client_user_agent: "Mozilla/5.0",
      fbp: "fb.1.1700000000000.123",
      fbc: "fb.1.1700000000000.AbC",
    });
    expect(event.custom_data).toMatchObject({ currency: "CAD", value: 117.6, order_id: "HE-000007", num_items: 3 });
    expect(body).not.toHaveProperty("test_event_code");
  });

  it("leaves out what the order does not have and adds the test code when asked", () => {
    const body = metaPurchaseBody(order({ customer: { email: "a@b.c" }, tracking: undefined } as Partial<Order>), { sourceUrl: "x", testEventCode: "TEST123" });
    expect(Object.keys(body.data[0].user_data).sort()).toEqual(["country", "em"]);
    expect(body.test_event_code).toBe("TEST123");
  });

  it("writes phone numbers the way Meta matches them", () => {
    expect(normalPhone("604-555-0100")).toBe("16045550100");
    expect(normalPhone("+1 (250) 555 0199")).toBe("12505550199");
    expect(normalPhone("")).toBe("");
  });
});

describe("trackPurchase", () => {
  const cms = (doc: Order) => ({ findByID: vi.fn(async () => doc), logger: { info: vi.fn() } }) as never;

  it("sends nothing without a pixel and a token", async () => {
    const fetch = vi.fn();
    await trackPurchase(7, cms(order()), { config: { metaPixelId: "123" }, fetch });
    await trackPurchase(7, cms(order()), { config: {}, fetch });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("posts the purchase to the pixel's events edge and fails loudly on an error answer", async () => {
    const fetch = vi.fn(async () => new Response("{}", { status: 200 }));
    await trackPurchase(7, cms(order()), { config: { metaPixelId: "123", metaCapiToken: "tok en" }, fetch });
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/^https:\/\/graph\.facebook\.com\/v\d+\.\d+\/123\/events\?access_token=tok%20en$/);
    expect(JSON.parse(String(init.body)).data[0].event_id).toBe("purchase-HE-000007");

    const failing = vi.fn(async () => new Response('{"error":{"message":"Invalid OAuth access token"}}', { status: 400 }));
    await expect(trackPurchase(7, cms(order()), { config: { metaPixelId: "123", metaCapiToken: "t" }, fetch: failing })).rejects.toThrow(/400.*Invalid OAuth/);
  });
});
