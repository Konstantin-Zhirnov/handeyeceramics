import { NextResponse, type NextRequest } from "next/server";
import { serverURL } from "./lib/server-url";
import { withoutLoops } from "./lib/redirect-loops";

/**
 * Answers the redirect rules from the admin (collection `redirects`) with a
 * real 301 before any page renders. The table is read from the public
 * redirects API and cached for a few seconds.
 */
type Rule = { from: string; to?: { type?: string; url?: string; reference?: { value?: { path?: string } | number } } };

const TTL = 10_000;
let table: { at: number; map: Map<string, string> } | undefined;

/**
 * Where this server reaches its own API: from config, never from the request's
 * Host header (which the visitor controls).
 */
const origin = serverURL();

let loading: Promise<Map<string, string>> | undefined;

async function load(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const res = await fetch(`${origin}/api/redirects?limit=0&pagination=false&depth=1`, { cache: "no-store" });
    const { docs = [] } = (await res.json()) as { docs?: Rule[] };
    for (const r of docs) {
      const ref = r.to?.reference?.value;
      const to = r.to?.type === "custom" ? r.to.url : typeof ref === "object" ? ref?.path : undefined;
      if (r.from && to) map.set(r.from, to);
    }
    table = { at: Date.now(), map: withoutLoops(map) };
  } catch {
    // CMS not up yet: serve without redirects (or with the last table) and do not ask again before the TTL.
    table = { at: Date.now(), map: table?.map ?? map };
  }
  return table.map;
}

/** The redirect table; concurrent requests share one load. */
async function rules() {
  if (table && Date.now() - table.at < TTL) return table.map;
  loading ??= load().finally(() => (loading = undefined));
  return loading;
}

/** True when the path has a percent escape that does not decode ("/abc%zz"). */
function malformed(path: string) {
  try {
    decodeURIComponent(path);
    return false;
  } catch {
    return true;
  }
}

export async function proxy(request: NextRequest) {
  // A broken address is a page that does not exist: the site's own 404, not an error.
  // Next cannot route it (it fails decoding the params), so the 404 page is fetched from an address that does not exist.
  if (malformed(request.nextUrl.pathname)) {
    const page = await fetch(`${origin}/page-not-found`, { cache: "no-store" }).catch(() => null);
    return new NextResponse(page ? await page.text() : "Not found", {
      status: 404,
      headers: { "content-type": page?.headers.get("content-type") || "text/plain; charset=utf-8" },
    });
  }
  const path = request.nextUrl.pathname.replace(/\/+$/, "") || "/";
  const to = (await rules()).get(path);
  if (!to || to === path) return NextResponse.next();
  return NextResponse.redirect(new URL(to, request.url), 301);
}

export const config = {
  matcher: ["/((?!api|admin|_next|media|images|assets|favicon|robots.txt|sitemap.xml).*)"],
};
