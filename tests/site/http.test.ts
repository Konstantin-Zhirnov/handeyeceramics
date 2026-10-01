import { describe, expect, inject, it } from "vitest";

const base = () => inject("baseURL");

describe("HTTP", () => {
  it("does not let anonymous visitors read enquiries", async () => {
    const res = await fetch(`${base()}/api/enquiries`);
    expect(res.status).toBe(403);
  });

  it("keeps the test address out of search engines", async () => {
    const res = await fetch(`${base()}/robots.txt`);
    expect(res.status).toBe(200);
    expect(await res.text()).toMatch(/Disallow: \/\s*$/m);
  });

  it("redirects the prototype Nanaimo address to the Wix one", async () => {
    const res = await fetch(`${base()}/classes/nanaimo`, { redirect: "manual" });
    expect(res.status).toBe(301);
    expect(new URL(res.headers.get("location") || "", base()).pathname).toBe("/nanaimo-pottery-classes");
  });

  it("answers an unknown path with 404 in the site design", async () => {
    const res = await fetch(`${base()}/no-such-page-here`);
    expect(res.status).toBe(404);
    // Next sends a thrown 404 as a shell that the browser fills in, so the
    // page's own markup is in the payload, not in server-rendered tags.
    const html = await res.text();
    expect(html).toContain("Page not found | Hand Eye Ceramics");
    expect(html).toContain("Go to the home page");
  });
});
