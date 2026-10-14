import type { Registration } from "@/payload-types";
import { registrationRows } from "../csv";
import { csvFile, editorOf, notFound, unauthorized } from "../shared";

/**
 * The list of a class date (R09.1): `GET /exports/registrations.csv?session=ID`
 * for a signed-in editor — every student of the date with the order that
 * paid the seat, when there is one. 401 without an editor, 404 when the date
 * is missing or unknown.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { payload, user } = await editorOf(request);
  if (!user) return unauthorized();

  const id = Number(new URL(request.url).searchParams.get("session"));
  if (!Number.isInteger(id) || id < 1) return notFound("Name the class date: ?session=ID");
  const session = await payload.findByID({
    collection: "sessions",
    id,
    depth: 0,
    overrideAccess: false,
    user,
    disableErrors: true,
    context: { skipAvailability: true },
  });
  if (!session) return notFound("No class date with this id");

  const res = await payload.find({
    collection: "registrations",
    where: { session: { equals: id } },
    sort: "createdAt",
    depth: 1,
    limit: 0,
    pagination: false,
    overrideAccess: false,
    user,
    context: { skipAvailability: true },
  });
  return csvFile(registrationRows(res.docs as Registration[]), `registrations-${id}.csv`);
}
