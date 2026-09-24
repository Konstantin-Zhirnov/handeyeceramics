import Image from "next/image";
import Link from "next/link";
import { LocationSwitcher } from "../LocationSwitcher";
import { site, type Location } from "@/lib/site";

/**
 * Studio pages open with the same split card as the home page — copy panel
 * left, rounded photo right — minus the scroll set piece, so every page reads
 * as one site. Server component: the first screen is CSS-only.
 */
export function LocationHero({ location }: { location: Location }) {
  const [first, ...rest] = location.h1.split(" in ");
  const place = rest.join(" in ");

  return (
    <section className="shell pt-[84px] pb-4 lg:max-w-[92rem] lg:pt-24">
      <nav
        aria-label="Breadcrumb"
        className="rise flex flex-wrap items-center gap-2 px-1 py-3 text-[0.8rem] font-semibold text-ink-soft"
        style={{ animationDelay: "0.05s" }}
      >
        <Link href="/" className="hover:text-ink">
          Hand Eye Ceramics
        </Link>
        <span aria-hidden className="text-clay-400">
          /
        </span>
        <span className="text-ink">{location.region}</span>
      </nav>

      <div className="grid gap-3 lg:grid-cols-[42fr_58fr] lg:gap-[14px]">
        <div className="grain relative order-2 overflow-hidden rounded-[24px] border border-clay-200 bg-clay-100 px-5 py-7 sm:px-8 lg:order-1 lg:rounded-[30px] lg:px-12 lg:py-12">
          <div className="relative z-10">
            <p className="rise eyebrow text-clay-600" style={{ animationDelay: "0.12s" }}>
              {location.tag}
            </p>

            <h1
              className="rise display mt-4 text-[1.95rem] leading-[1.06] text-ink sm:text-[3rem] lg:text-[clamp(2.8rem,3.8vw,3.9rem)]"
              style={{ animationDelay: "0.2s" }}
            >
              {/* Keeps the exact "… in <place>" wording in the H1 text for
                  search; the italic place name carries the reference's style. */}
              {place ? (
                <>
                  {first} <span className="text-clay-400">in</span>{" "}
                  <br />
                  <em className="italic">{place}</em>
                </>
              ) : (
                location.h1
              )}
            </h1>

            <p
              className="rise mt-5 max-w-[44ch] text-[0.98rem] leading-relaxed text-ink-soft"
              style={{ animationDelay: "0.28s" }}
            >
              {location.intro}
            </p>

            <p
              className="rise mt-5 text-[0.95rem] font-semibold text-clay-600"
              style={{ animationDelay: "0.34s" }}
            >
              {location.street}
              {location.status === "open" && `, ${location.locality}`}
            </p>

            {/* This studio's own Google rating, linked to its own profile —
                each location earns its own social proof. */}
            {location.google && (
              <a
                href={location.google.url}
                target="_blank"
                rel="noopener noreferrer"
                className="rise mt-4 inline-flex min-h-11 items-center gap-2.5 rounded-full border border-ink/15 bg-clay-50 px-4 text-[0.86rem] text-ink transition-colors hover:bg-clay-50/60"
                style={{ animationDelay: "0.4s" }}
              >
                <span className="font-bold">{location.google.rating.toFixed(1)}</span>
                <span className="tracking-[0.1em] text-terracotta">★★★★★</span>
                <span className="text-ink-soft">{location.google.count} Google reviews</span>
              </a>
            )}

            <div
              className="rise mt-7 flex flex-col gap-3 sm:flex-row sm:items-center lg:flex-col lg:items-stretch xl:flex-row xl:items-center"
              style={{ animationDelay: "0.46s" }}
            >
              {location.status === "open" ? (
                <a
                  href={site.bookingUrl}
                  className="flex h-13 shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-terracotta px-8 text-[0.92rem] font-semibold text-clay-50 transition-transform hover:-translate-y-0.5"
                >
                  Book at {location.short}
                </a>
              ) : (
                <a
                  href={`mailto:${site.email}?subject=Calgary studio`}
                  className="flex h-13 shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-terracotta px-8 text-[0.92rem] font-semibold text-clay-50 transition-transform hover:-translate-y-0.5"
                >
                  Tell me when it opens
                </a>
              )}
              <a
                href={site.phoneHref}
                className="flex h-13 shrink-0 items-center justify-center whitespace-nowrap rounded-full border border-ink/25 px-7 text-[0.92rem] font-semibold text-ink transition-colors hover:bg-clay-50"
              >
                Call {site.phoneDisplay}
              </a>
            </div>

            {/* Switcher sits inside the hero too, not just the header — this
                is the page where someone is most likely to be in the wrong
                city. */}
            <div
              className="rise mt-7 flex flex-wrap items-center gap-3 border-t border-ink/10 pt-6"
              style={{ animationDelay: "0.52s" }}
            >
              <span className="text-[0.85rem] text-ink-soft">Looking for another studio?</span>
              <LocationSwitcher current={location.slug} />
            </div>
          </div>
        </div>

        <div
          className="rise-media relative order-1 min-h-[260px] overflow-hidden rounded-[24px] bg-clay-200 sm:min-h-[340px] lg:order-2 lg:min-h-0 lg:rounded-[30px]"
          style={{ animationDelay: "0.15s" }}
        >
          <Image
            src={location.image}
            alt={`The ${location.name} studio`}
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 56vw"
            className={`object-cover ${location.status === "planned" ? "grayscale opacity-70" : ""}`}
          />
        </div>
      </div>
    </section>
  );
}
