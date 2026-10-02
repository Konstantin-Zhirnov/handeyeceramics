import { NextResponse, type NextRequest } from "next/server";
import { serverURL } from "./lib/server-url";

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

async function rules() {
  if (table && Date.now() - table.at < TTL) return table.map;
  const map = new Map<string, string>();
  try {
    const res = await fetch(`${origin}/api/redirects?limit=0&pagination=false&depth=1`, { cache: "no-store" });
    const { docs = [] } = (await res.json()) as { docs?: Rule[] };
    for (const r of docs) {
      const ref = r.to?.reference?.value;
      const to = r.to?.type === "custom" ? r.to.url : typeof ref === "object" ? ref?.path : undefined;
      if (r.from && to) map.set(r.from, to);
    }
    table = { at: Date.now(), map };
  } catch {
    return table?.map ?? map; // CMS not up yet: serve without redirects
  }
  return map;
}

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname.replace(/\/+$/, "") || "/";
  const to = (await rules()).get(path);
  if (!to || to === path) return NextResponse.next();
  return NextResponse.redirect(new URL(to, request.url), 301);
}

export const config = {
  matcher: ["/((?!api|admin|_next|media|images|assets|favicon|robots.txt|sitemap.xml).*)"],
};
