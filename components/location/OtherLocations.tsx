"use client";

import Image from "next/image";
import Link from "next/link";
import { Reveal, revealDelay } from "../motion-primitives";
import { useSiteData, type SectionText } from "../site/SiteData";

/**
 * Cross-links to every other studio, on every studio page. The point is that
 * you cannot land on the Nanaimo page and come away believing Nanaimo is the
 * whole business — and vice versa. `current` is this studio's path.
 */
export function OtherLocations({ current, text }: { current: string; text: SectionText }) {
  const others = useSiteData().studios.filter((l) => l.path !== current);
  if (!others.length) return null;

  return (
    <section className="grain relative overflow-hidden bg-clay-100 py-14 md:py-20">
      <div className="shell relative z-10">
        <Reveal className="max-w-[46ch]">
          {text.eyebrow && <span className="eyebrow text-clay-600">{text.eyebrow}</span>}
          <h2 className="display mt-3 text-heading-sm text-ink sm:text-heading-lg">
            {text.heading || `${others.length} other ${others.length === 1 ? "studio" : "studios"}`}
          </h2>
          {text.body && <p className="mt-4 text-copy leading-relaxed text-ink-soft">{text.body}</p>}
        </Reveal>

        <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {others.map((loc, i) => (
            <Reveal key={loc.path} delay={revealDelay(i)}>
              <Link
                href={loc.path}
                className="group flex h-full flex-col overflow-hidden rounded-panel border border-ink/10 bg-clay-50"
              >
                <div className="relative h-[160px] overflow-hidden bg-clay-200">
                  {loc.photo && (
                    <Image
                      src={loc.photo.src}
                      alt={loc.photo.alt}
                      fill
                      sizes="(max-width: 640px) 100vw, 33vw"
                      className={`object-cover transition-transform duration-700 group-hover:scale-105 ${
                        loc.status === "planned" ? "opacity-55 grayscale" : ""
                      }`}
                    />
                  )}
                  {loc.tag && (
                    <span className="absolute left-3 top-3 rounded-full bg-sky-brand px-3 py-1.5 text-micro font-bold uppercase tracking-[0.12em] text-sky-ink">
                      {loc.tag}
                    </span>
                  )}
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <h3 className="display text-title-sm text-ink">{loc.name}</h3>
                  <p className="mt-1 text-label font-semibold text-clay-600">{loc.street}</p>
                  <p className="mt-3 flex-1 text-label leading-relaxed text-ink-soft">{loc.note}</p>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-label font-bold text-ink">
                    See {loc.short}
                    <svg viewBox="0 0 16 12" fill="none" aria-hidden className="h-2.5 w-4">
                      <path
                        d="M1 6h13M9.5 1 14.5 6l-5 5"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
