import type { Metadata } from "next";
import { cookies } from "next/headers";
import { PageHeading, SiteShell } from "@/components/site/SiteShell";
import { phoneHref } from "@/lib/cms/site";
import { SITE_SUFFIX } from "@/lib/cms/text";
import { readTeachersPage, TEACHERS_COOKIE, TEACHERS_UNLOCK_PATH, tokenOpens } from "@/lib/teachers";

/**
 * Teacher contacts for students (global `teachers`): behind one shared
 * password. Without the cookie of the current password the page shows only
 * the password form; `?wrong=1` is the form after a password that did not match,
 * `?wait=1` after too many tries. Never indexed.
 */
export const dynamic = "force-dynamic";

const TITLE = "Teacher contacts";

export const metadata: Metadata = {
  title: `${TITLE}${SITE_SUFFIX}`,
  description: "Phone numbers of your teachers, for students of Hand Eye Ceramics.",
  robots: { index: false, follow: false },
};

const wrap = "mx-auto mt-10 max-w-[62rem] px-5 sm:px-8";

export default async function TeachersPage({ searchParams }: { searchParams: Promise<{ wrong?: string; wait?: string }> }) {
  const { wrong, wait } = await searchParams;
  const page = await readTeachersPage();
  const open = tokenOpens((await cookies()).get(TEACHERS_COOKIE)?.value, page.password);

  if (!open) {
    return (
      <SiteShell>
        <PageHeading eyebrow="For students" title={TITLE}>
          <p className="mt-4 max-w-[40rem] text-lg text-ink-soft">
            {page.password ? "Enter the password from your confirmation email." : "This page is closed right now. Please call the studio."}
          </p>
        </PageHeading>
        {page.password && (
          <form data-teachers-form method="post" action={TEACHERS_UNLOCK_PATH} className={`${wrap} flex max-w-[32rem] flex-col gap-3`}>
            <label htmlFor="teachers-password" className="eyebrow text-clay-600">
              Password
            </label>
            <input
              id="teachers-password"
              name="password"
              type="password"
              required
              autoComplete="off"
              className="w-full min-w-0 rounded-inset border border-clay-200 bg-clay-50 px-4 py-3 text-ink"
            />
            {(wrong || wait) && (
              <p data-teachers-error role="alert" className="text-terracotta">
                {wait ? "Too many tries. Please wait a few minutes and try again." : "That password does not match. Check your confirmation email."}
              </p>
            )}
            <button type="submit" className="mt-2 flex h-12 items-center justify-center self-start rounded-full bg-terracotta px-7 text-copy font-semibold text-clay-50 transition-colors hover:bg-ink">
              Open
            </button>
          </form>
        )}
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <PageHeading eyebrow="For students" title={TITLE}>
        {page.intro && <p className="mt-4 max-w-[40rem] whitespace-pre-line text-lg text-ink-soft">{page.intro}</p>}
      </PageHeading>
      <div data-teachers className={`${wrap} flex flex-col gap-10`}>
        {page.groups.map(({ studio, teachers }) => (
          <section key={studio || "-"}>
            {studio && <h2 className="eyebrow text-clay-600">{studio}</h2>}
            <ul className="mt-3 divide-y divide-clay-200">
              {teachers.map((t, i) => (
                <li key={i} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-3">
                  <div className="min-w-0">
                    <p className="text-lg text-ink">{t.name}</p>
                    {t.classes && <p className="text-caption text-ink-soft">{t.classes}</p>}
                  </div>
                  <a href={phoneHref(t.phone)} className="text-lg text-ink underline">
                    {t.phone}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ))}
        {!page.groups.length && <p className="text-ink-soft">No teachers listed yet.</p>}
        {page.outro && <p data-teachers-outro className="max-w-[40rem] whitespace-pre-line text-lg text-ink-soft">{page.outro}</p>}
      </div>
    </SiteShell>
  );
}
