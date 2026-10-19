import { NextResponse } from "next/server";
import { addressOf, rateLimiter, SENDER_LIMIT } from "@/lib/rate-limit";
import { serverURL } from "@/lib/server-url";
import { passwordMatches, readTeachersPage, TEACHERS_COOKIE, TEACHERS_COOKIE_MAX_AGE, TEACHERS_PATH, teachersToken } from "@/lib/teachers";

/**
 * The password form of /teachers posts here. A match sets the cookie of the
 * current password and goes back to the page (303); a miss goes back with
 * `?wrong=1`. Tries are braked like the enquiry forms: 5 per sender in 10
 * minutes, then `?wait=1`.
 */
export const dynamic = "force-dynamic";

const limiter = rateLimiter(SENDER_LIMIT);

const back = (query = "") => NextResponse.redirect(new URL(`${TEACHERS_PATH}${query}`, serverURL()), 303);

export async function POST(request: Request) {
  const address = addressOf(request.headers);
  if (address && !limiter.allow(`teachers:${address}`)) return back("?wait=1");
  let typed = "";
  try {
    typed = String((await request.formData()).get("password") || "");
  } catch {
    return back("?wrong=1");
  }
  const page = await readTeachersPage();
  if (!passwordMatches(typed, page.password)) return back("?wrong=1");
  const res = back();
  res.cookies.set(TEACHERS_COOKIE, teachersToken(page.password), {
    httpOnly: true,
    sameSite: "lax",
    secure: serverURL().startsWith("https://"),
    path: TEACHERS_PATH,
    maxAge: TEACHERS_COOKIE_MAX_AGE,
  });
  return res;
}
