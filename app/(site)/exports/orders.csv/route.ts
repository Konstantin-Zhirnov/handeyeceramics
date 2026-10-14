import type { Where } from "payload";
import type { Order } from "@/payload-types";
import { orderRows } from "../csv";
import { STUDIO_TIME_ZONE, dayRange } from "../period";
import { badRequest, csvFile, editorOf, unauthorized } from "../shared";

/**
 * The accountant's file (R26i): `GET /exports/orders.csv?from=YYYY-MM-DD&to=YYYY-MM-DD`
 * for a signed-in editor — one row per order line, GST and PST apart, for
 * the orders paid in the period (calendar days in the studios' time zone,
 * both inclusive; either bound may be left out). Orders never paid are not
 * in it: a pending or expired checkout is not a sale. 401 without an editor,
 * 400 when a bound is not a date.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { payload, user } = await editorOf(request);
  if (!user) return unauthorized();

  const params = new URL(request.url).searchParams;
  const from = params.get("from") || undefined;
  const to = params.get("to") || undefined;
  const range = dayRange(from, to, STUDIO_TIME_ZONE);
  if (!range) return badRequest("`from` and `to` must be dates like 2026-10-31, and `from` must not come after `to`");

  const paid: Where[] = [{ paidAt: { exists: true } }];
  if (range.from) paid.push({ paidAt: { greater_than_equal: range.from.toISOString() } });
  if (range.to) paid.push({ paidAt: { less_than_equal: range.to.toISOString() } });
  const res = await payload.find({
    collection: "orders",
    where: { and: paid },
    sort: "paidAt",
    depth: 1,
    limit: 0,
    pagination: false,
    overrideAccess: false,
    user,
    context: { skipAvailability: true },
  });
  const name = `orders${from ? `-${from}` : ""}${to ? `-${to}` : ""}.csv`;
  return csvFile(orderRows(res.docs as Order[]), name);
}
