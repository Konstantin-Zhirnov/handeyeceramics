import Link from "next/link";
import type { ServerProps } from "payload";
import { UpcomingClasses } from "./UpcomingClasses";
import { UPCOMING_PATH } from "./UpcomingView";

const DAYS = 7;

/** The first thing on the dashboard (R01.1): the class dates of the coming week and their seats. */
export function UpcomingDashboard({ payload, user, searchParams }: ServerProps) {
  const admin = payload.config.routes.admin;
  return (
    <section style={{ marginBottom: 32 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: 8, margin: "0 0 12px" }}>
        <h2 style={{ margin: 0, fontSize: 22 }}>Upcoming classes · next {DAYS} days</h2>
        <Link href={`${admin}${UPCOMING_PATH}`} style={{ fontSize: 14 }}>
          All upcoming dates →
        </Link>
      </div>
      <UpcomingClasses payload={payload} user={user} searchParams={searchParams} days={DAYS} basePath={admin} />
    </section>
  );
}
