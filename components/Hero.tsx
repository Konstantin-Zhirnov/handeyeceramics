import Image from "next/image";
import { googleTotals, site } from "@/lib/site";

/**
 * Server component on purpose. The first screen must be painted and legible
 * before any JavaScript runs, so the entrance is a CSS stagger rather than
 * Framer Motion (whose `initial` ships as inline opacity:0).
 */
export function Hero() {
  return (
    <section id="top" className="relative">
      <div className="grain relative overflow-hidden rounded-b-[32px] bg-sky-brand pt-[92px] pb-14 md:rounded-b-[52px] md:pt-[140px] md:pb-20">
        {/* concentric wheel-rings, echoing a potter's wheel */}
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
          <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8">
            <div>
              <span
                className="rise eyebrow inline-flex items-center gap-2 rounded-full bg-white/55 px-3.5 py-2 text-sky-ink"
                style={{ animationDelay: "0.15s" }}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-terracotta" />
                Vancouver · Nanaimo · 7 days a week
              </span>

              <h1
                className="rise display mt-5 text-[2.6rem] text-sky-ink sm:text-[3.4rem] lg:text-[4.3rem]"
                style={{ animationDelay: "0.24s" }}
              >
                Throw your first pot
                <br />
                <em
                  className="not-italic"
                  style={{ fontVariationSettings: '"SOFT" 60, "WONK" 1', fontStyle: "italic" }}
                >
                  this&nbsp;week.
                </em>
              </h1>

              <p
                className="rise mt-6 max-w-[38ch] text-[1.02rem] leading-relaxed text-sky-ink/85 sm:text-[1.08rem]"
                style={{ animationDelay: "0.33s" }}
              >
                Hands-on pottery classes for people who have never touched clay. Six-week courses,
                one-night drop-ins and date nights across three studios.
              </p>

              <div
                className="rise mt-8 flex flex-col gap-3 sm:flex-row sm:items-center"
                style={{ animationDelay: "0.42s" }}
              >
                <a
                  href="#classes"
                  className="flex h-14 items-center justify-center rounded-full bg-ink px-8 text-[0.95rem] font-semibold text-clay-50 transition-transform hover:-translate-y-0.5 sm:h-13"
                >
                  See classes
                </a>
                {/* tel: link — one tap to call from a phone */}
                <a
                  href={site.phoneHref}
                  className="flex h-14 items-center justify-center rounded-full border border-sky-ink/25 px-8 text-[0.95rem] font-semibold text-sky-ink transition-colors hover:bg-white/55 sm:h-13"
                >
                  Call {site.phoneDisplay}
                </a>
              </div>

              <p
                className="rise mt-6 max-w-[46ch] text-[0.84rem] leading-relaxed text-sky-ink/65"
                style={{ animationDelay: "0.51s" }}
              >
                No experience needed. Every tool is provided — all you buy on your first day is an
                apron ($17) and a trimming tool ($10).
              </p>
            </div>

            {/* Cut-out photo from the studio, floating on the brand blue */}
            <div
              className="rise-media relative mx-auto w-full max-w-[440px] lg:max-w-none"
              style={{ animationDelay: "0.3s" }}
            >
              <div className="relative aspect-[5/4]">
                <Image
                  src="/images/potter-cutout-1.png"
                  alt="A Hand Eye Ceramics instructor holding a freshly thrown vase"
                  fill
                  priority
                  sizes="(max-width: 1024px) 90vw, 44vw"
                  className="object-contain drop-shadow-[0_26px_38px_rgba(16,51,77,0.22)]"
                />
              </div>

              <div
                className="rise absolute -bottom-2 left-0 flex items-center gap-3 rounded-2xl bg-clay-50 px-4 py-3 shadow-[0_16px_30px_rgba(16,51,77,0.16)] sm:left-2"
                style={{ animationDelay: "0.85s" }}
              >
                <span className="flex -space-x-2">
                  {["/images/wheel-spin.jpg", "/images/cups-shelf.jpg", "/images/hands-clay.jpg"].map(
                    (src) => (
                      <span
                        key={src}
                        className="relative h-9 w-9 overflow-hidden rounded-full ring-2 ring-clay-50"
                      >
                        <Image src={src} alt="" fill sizes="36px" className="object-cover" />
                      </span>
                    ),
                  )}
                </span>
                {/* Real, checkable numbers — the sum of the studios' Google
                    Business Profiles, not a decorative star row. */}
                <span className="leading-tight">
                  <span className="block text-[0.82rem] font-bold text-ink">
                    {googleTotals.count} Google reviews
                  </span>
                  <span className="block text-[0.76rem] text-ink-soft">
                    across our {googleTotals.profiles} studios
                  </span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
