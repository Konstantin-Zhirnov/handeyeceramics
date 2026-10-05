"use client";

import { Reveal, revealDelay } from "../motion-primitives";
import type { ScheduleRow, StudioView } from "../site/SiteData";

/**
 * What runs at the studio (its classes with their times, then the notes of
 * its description), and how to get there. A planned studio has no timetable.
 */
export function LocationSchedule({ studio, rows }: { studio: StudioView; rows: ScheduleRow[] }) {
  const open = studio.status === "open";
  const lines = [
    ...rows.map((r) => ({ label: r.label, text: r.times, price: r.price })),
    ...studio.notes.map((n) => ({ label: n.label, text: n.text, price: "" })),
  ];
  return (
    <section className="shell py-14 md:py-20">
      <div className="grid gap-10 lg:grid-cols-[1fr_0.85fr] lg:gap-16">
        <div>
          <Reveal>
            <span className="eyebrow text-clay-600">What runs here</span>
            <h2 className="display mt-3 text-heading-sm text-ink sm:text-heading-lg">
              {open ? `The ${studio.short} schedule` : "Nothing scheduled yet"}
            </h2>
          </Reveal>

          <div className="mt-8 flex flex-col" data-schedule>
            {lines.map((row, i) => (
              <Reveal
                key={row.label}
                delay={revealDelay(i)}
                className="flex flex-col gap-1 border-t border-ink/12 py-5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-8"
              >
                <span className="display text-title-sm text-ink">{row.label}</span>
                <span className="text-ui leading-relaxed text-ink-soft sm:max-w-[26ch] sm:text-right">
                  {row.text}
                  {row.price && (
                    <span className="block font-semibold text-ink" data-price>
                      {row.price}
                    </span>
                  )}
                </span>
              </Reveal>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <Reveal>
            <div className="rounded-panel border border-ink/10 bg-clay-100/70 p-6">
              <h3 className="eyebrow text-clay-600">Address</h3>
              <p className="display mt-3 text-title leading-tight text-ink">{studio.street}</p>
              {(studio.locality || studio.regionCode) && (
                <p className="mt-1 text-ui font-semibold text-clay-600">
                  {[studio.locality, studio.regionCode].filter(Boolean).join(", ")}
                </p>
              )}
              {open && studio.hours.length > 0 && (
                <dl className="mt-4 flex flex-col gap-1 text-label text-ink-soft">
                  {studio.hours.map((h) => (
                    <div key={h.days} className="flex justify-between gap-4">
                      <dt className="font-semibold">{h.days}</dt>
                      <dd>{h.time}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {open && studio.access && (
                <p className="mt-4 text-label leading-relaxed text-ink-soft">{studio.access}</p>
              )}
              {studio.phoneHref && (
                <a
                  href={studio.phoneHref}
                  className="mt-5 flex h-12 items-center justify-center rounded-full border border-ink/20 text-label font-semibold text-ink transition-colors hover:bg-clay-50"
                >
                  Call {studio.phone}
                </a>
              )}
            </div>
          </Reveal>

          {studio.highlights.length > 0 && (
            <Reveal delay={0.1}>
              <ul className="flex flex-col gap-3 rounded-panel bg-sky-brand/35 p-6">
                {studio.highlights.map((point) => (
                  <li key={point} className="flex gap-3 text-ui leading-relaxed text-sky-ink">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-terracotta" />
                    {point}
                  </li>
                ))}
              </ul>
            </Reveal>
          )}
        </div>
      </div>
    </section>
  );
}
