import { DefaultTemplate } from "@payloadcms/next/templates";
import { Gutter } from "@payloadcms/ui";
import { redirect } from "next/navigation";
import type { AdminViewServerProps } from "payload";
import { UpcomingClasses } from "./UpcomingClasses";

/** The admin path of this view; the nav link and the dashboard point here. */
export const UPCOMING_PATH = "/upcoming";

/**
 * "Upcoming classes" (R01.1): every class date from today on, grouped by day,
 * with a studio filter — the page the owner opens on the phone to check seats.
 * A custom admin view is public unless it checks the user itself, so a visitor
 * who is not signed in is sent to the login page.
 */
export async function UpcomingView({ initPageResult, params, searchParams }: AdminViewServerProps) {
  const { req, locale, permissions, visibleEntities } = initPageResult;
  const admin = req.payload.config.routes.admin;
  if (!req.user) redirect(`${admin}/login?redirect=${encodeURIComponent(`${admin}${UPCOMING_PATH}`)}`);
  return (
    <DefaultTemplate
      i18n={req.i18n}
      locale={locale}
      params={params}
      payload={req.payload}
      permissions={permissions}
      searchParams={searchParams}
      user={req.user}
      visibleEntities={visibleEntities}
    >
      <Gutter>
        <h1 style={{ margin: "24px 0 16px", fontSize: 28 }}>Upcoming classes</h1>
        <UpcomingClasses payload={req.payload} user={req.user} searchParams={searchParams} basePath={`${admin}${UPCOMING_PATH}`} />
      </Gutter>
    </DefaultTemplate>
  );
}
