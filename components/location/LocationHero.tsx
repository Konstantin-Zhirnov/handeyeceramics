import Image from "next/image";
import Link from "next/link";
import { LocationSwitcher } from "../LocationSwitcher";
import { site, type Location } from "@/lib/site";

/** Server component — see the note in Hero.tsx. The first screen is CSS-only. */
export function LocationHero({ location }: { location: Location }) {
  return (
    <section className="relative">
      <div className="grain relative overflow-hidden rounded-b-[32px] bg-sky-brand pt-[92px] pb-12 md:rounded-b-[52px] md:pt-[132px] md:pb-16">
        <svg
          aria-hidden
          viewBox="0 0 600 600"
          className="pointer-events-none absolute -right-24 -top-28 h-[420px] w-[420px] opacity-[0.22] md:h-[620px] md:w-[620px]"
        >
          {[60, 120, 180, 240, 290].map((r) => (
            <circle key={r} cx="300" cy="300" r={r} fill="none" stroke="#10334d" strokeWidth="1.2" />
          ))}
        </svg>

        <div className="shell relative z-10">
          <nav
            aria-label="Breadcrumb"
            className="rise flex flex-wrap items-center gap-2 text-[0.8rem] font-semibold text-sky-ink/70"
            style={{ animationDelay: "0.1s" }}
          >
            <Link href="/" className="hover:text-sky-ink">
              Hand Eye Ceramics
            </Link>
            <span aria-hidden>/</span>
            <span className="text-sky-ink">{location.region}</span>
          </nav>

          <div className="mt-6 grid items-center gap-9 lg:grid-cols-[1.05fr_0.95fr]">
            <div>
              <span
                className="rise eyebrow inline-flex items-center gap-2 rounded-full bg-white/55 px-3.5 py-2 text-sky-ink"
                style={{ animationDelay: "0.18s" }}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-terracotta" />
                {location.tag}
              </span>

              <h1
                className="rise display mt-5 text-[2.4rem] text-sky-ink sm:text-[3.1rem] lg:text-[3.9rem]"
                style={{ animationDelay: "0.26s" }}
              >
                {location.h1}
              </h1>

              <p
                className="rise mt-5 max-w-[44ch] text-[1.02rem] leading-relaxed text-sky-ink/85"
                style={{ animationDelay: "0.34s" }}
              >
                {location.intro}
              </p>

              <p
                className="rise mt-5 text-[0.95rem] font-semibold text-sky-ink"
                style={{ animationDelay: "0.42s" }}
              >
                {location.street}
                {location.status === "open" && `, ${location.locality}`}
              </p>

              <div
                className="rise mt-7 flex flex-col gap-3 sm:flex-row sm:items-center"
                style={{ animationDelay: "0.5s" }}
              >
                {location.status === "open" ? (
                  <a
                    href={site.bookingUrl}
                    className="flex h-14 items-center justify-center rounded-full bg-ink px-8 text-[0.95rem] font-semibold text-clay-50 transition-transform hover:-translate-y-0.5"
                  >
                    Book at {location.short}
                  </a>
                ) : (
                  <a
                    href={`mailto:${site.email}?subject=Calgary studio`}
                    className="flex h-14 items-center justify-center rounded-full bg-ink px-8 text-[0.95rem] font-semibold text-clay-50 transition-transform hover:-translate-y-0.5"
                  >
                    Tell me when it opens
                  </a>
                )}
                <a
                  href={site.phoneHref}
                  className="flex h-14 items-center justify-center rounded-full border border-sky-ink/25 px-8 text-[0.95rem] font-semibold text-sky-ink transition-colors hover:bg-white/55"
                >
                  Call {site.phoneDisplay}
                </a>
              </div>

              {/* Switcher sits inside the hero too, not just the header — this
                  is the page where someone is most likely to be in the wrong
                  city. */}
              <div
                className="rise mt-7 flex flex-wrap items-center gap-3"
                style={{ animationDelay: "0.58s" }}
              >
                <span className="text-[0.85rem] text-sky-ink/70">Looking for another studio?</span>
                <LocationSwitcher current={location.slug} tone="sky" />
              </div>
            </div>

            <div
              className="rise-media relative mx-auto w-full max-w-[460px] lg:max-w-none"
              style={{ animationDelay: "0.28s" }}
            >
              <div className="relative aspect-[4/3] overflow-hidden rounded-[26px] shadow-[0_26px_50px_rgba(16,51,77,0.22)]">
                <Image
                  src={location.image}
                  alt={`The ${location.name} studio`}
                  fill
                  priority
                  sizes="(max-width: 1024px) 92vw, 44vw"
                  className="object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
