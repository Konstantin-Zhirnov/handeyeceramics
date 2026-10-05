"use client";

import Image from "next/image";
import Link from "next/link";
import { Reveal, revealDelay } from "./motion-primitives";
import { Emph, useSiteData, type SectionText } from "./site/SiteData";

/** A card per published studio; the planned one is greyed and says so. */
export function LocationsSection({ text }: { text: SectionText }) {
  const { studios } = useSiteData();
  if (!studios.length) return null;
  return (
    <section id="locations" className="shell pb-16 md:pb-24">
      <Reveal className="max-w-[48ch]">
        {text.eyebrow && <span className="eyebrow text-clay-600">{text.eyebrow}</span>}
        {text.heading && (
          <h2 className="display mt-3 text-heading text-ink sm:text-display">
            <Emph text={text.heading} />
          </h2>
        )}
        {text.body && <p className="mt-4 text-copy leading-relaxed text-ink-soft">{text.body}</p>}
      </Reveal>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {studios.map((loc, i) => (
          <Reveal as="article" key={loc.path} delay={revealDelay(i)} className="h-full">
            <Link
              href={loc.path}
              className="group flex h-full flex-col overflow-hidden rounded-panel border border-ink/10 bg-clay-50 transition-shadow hover:shadow-[0_18px_36px_rgba(28,21,18,0.10)]"
            >
              <div className="relative h-[180px] overflow-hidden bg-clay-200">
                {loc.photo && (
                  <Image
                    src={loc.photo.src}
                    alt={loc.photo.alt}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                    className={`object-cover transition-transform duration-700 group-hover:scale-105 ${
                      loc.status === "planned" ? "opacity-55 grayscale" : ""
                    }`}
                  />
                )}
                {loc.tag && (
                  <span
                    className={`absolute left-3 top-3 rounded-full px-3 py-1.5 text-micro font-bold uppercase tracking-[0.12em] ${
                      loc.status === "planned" ? "bg-clay-200 text-ink" : "bg-sky-brand text-sky-ink"
                    }`}
                  >
                    {loc.tag}
                  </span>
                )}
              </div>
              <div className="flex flex-1 flex-col p-5">
                <h3 className="display text-title-sm text-ink">{loc.name}</h3>
                <p className="mt-1 text-label font-semibold text-clay-600">{loc.street}</p>
                <p className="mt-3 flex-1 text-label leading-relaxed text-ink-soft">{loc.note}</p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-label font-bold text-ink">
                  {loc.status === "planned" ? "Get notified" : `See ${loc.short} classes`}
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
    </section>
  );
}
