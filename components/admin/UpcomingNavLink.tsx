import Link from "next/link";
import type { ServerProps } from "payload";
import { UPCOMING_PATH } from "./UpcomingView";

/** "Upcoming classes" at the top of the admin menu, above the collections. */
export function UpcomingNavLink({ payload }: ServerProps) {
  const href = `${payload.config.routes.admin}${UPCOMING_PATH}`;
  return (
    <Link href={href} className="nav__link" style={{ fontWeight: 600, marginBottom: 12 }}>
      <span className="nav__link-label">Upcoming classes</span>
    </Link>
  );
}
