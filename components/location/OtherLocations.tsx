"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Reveal, RevealGroup, riseVariants } from "../motion-primitives";
import { locations } from "@/lib/site";

/**
 * Cross-links to every other studio, on every studio page. The point is that
 * you cannot land on the Nanaimo page and come away believing Nanaimo is the
 * whole business — and vice versa.
 */
export function OtherLocations({ current }: { current: string }) {
  const others = locations.filter((l) => l.slug !== current);

  return (
    <section className="grain relative overflow-hidden bg-clay-100 py-14 md:py-20">
      <div className="shell relative z-10">
        <Reveal className="max-w-[46ch]">
          <span className="eyebrow text-clay-600">We're also here</span>
          <h2 className="display mt-3 text-[2rem] text-ink sm:text-[2.6rem]">
            {others.length} other studios
          </h2>
          <p className="mt-4 text-[0.95rem] leading-relaxed text-ink-soft">
            Same instructors, same six-week course. Pick whichever one you can actually get to.
          </p>
        </Reveal>

        <RevealGroup className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {others.map((loc) => (
            <motion.div key={loc.slug} variants={riseVariants}>
              <Link
                href={`/classes/${loc.slug}`}
                className="group flex h-full flex-col overflow-hidden rounded-[22px] border border-ink/10 bg-clay-50"
              >
                <div className="relative h-[160px] overflow-hidden">
                  <Image
                    src={loc.image}
                    alt={loc.name}
                    fill
                    sizes="(max-width: 640px) 100vw, 33vw"
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <span className="absolute left-3 top-3 rounded-full bg-sky-brand px-3 py-1.5 text-[0.68rem] font-bold uppercase tracking-[0.12em] text-sky-ink">
                    {loc.tag}
                  </span>
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <h3 className="display text-[1.3rem] text-ink">{loc.name}</h3>
                  <p className="mt-1 text-[0.86rem] font-semibold text-clay-600">{loc.street}</p>
                  <p className="mt-3 flex-1 text-[0.86rem] leading-relaxed text-ink-soft">
                    {loc.note}
                  </p>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-[0.86rem] font-bold text-ink">
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
            </motion.div>
          ))}
        </RevealGroup>
      </div>
    </section>
  );
}
