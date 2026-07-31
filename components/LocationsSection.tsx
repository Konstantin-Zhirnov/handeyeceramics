"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { Reveal, RevealGroup, riseVariants } from "./motion-primitives";
import { locations, site } from "@/lib/site";

export function LocationsSection() {
  return (
    <section id="locations" className="shell pb-16 md:pb-24">
      <Reveal className="max-w-[46ch]">
        <span className="eyebrow text-clay-600">Locations</span>
        <h2 className="display mt-3 text-[2.2rem] text-ink sm:text-[3rem]">
          Three studios, one community
        </h2>
        <p className="mt-4 text-[0.96rem] leading-relaxed text-ink-soft">
          Most classes run at our main Chinatown studio. Booking a private class? We'll assign you
          a location based on availability — just call and ask.
        </p>
      </Reveal>

      <RevealGroup className="mt-10 grid gap-4 md:grid-cols-3">
        {locations.map((loc) => (
          <motion.article
            key={loc.name}
            variants={riseVariants}
            className="group overflow-hidden rounded-[22px] border border-ink/10 bg-clay-50"
          >
            <div className="relative h-[190px] overflow-hidden">
              <Image
                src={loc.image}
                alt={loc.name}
                fill
                sizes="(max-width: 768px) 100vw, 33vw"
                className="object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <span className="absolute left-3 top-3 rounded-full bg-sky-brand px-3 py-1.5 text-[0.7rem] font-bold uppercase tracking-[0.12em] text-sky-ink">
                {loc.tag}
              </span>
            </div>

            <div className="p-6">
              <h3 className="display text-[1.4rem] text-ink">{loc.name}</h3>
              <p className="mt-1.5 text-[0.9rem] font-semibold text-clay-600">{loc.address}</p>
              <p className="mt-3 text-[0.88rem] leading-relaxed text-ink-soft">{loc.note}</p>
              {/* Every card gets its own tap-to-call target. */}
              <a
                href={site.phoneHref}
                className="mt-5 flex h-12 items-center justify-center gap-2 rounded-full border border-ink/20 text-[0.86rem] font-semibold text-ink transition-colors hover:bg-clay-100"
              >
                Call {site.phoneDisplay}
              </a>
            </div>
          </motion.article>
        ))}
      </RevealGroup>
    </section>
  );
}
