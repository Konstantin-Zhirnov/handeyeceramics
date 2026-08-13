"use client";

import { motion } from "framer-motion";
import { Reveal, RevealGroup, riseVariants } from "../motion-primitives";
import { site, type Location } from "@/lib/site";

export function LocationSchedule({ location }: { location: Location }) {
  return (
    <section className="shell py-14 md:py-20">
      <div className="grid gap-10 lg:grid-cols-[1fr_0.85fr] lg:gap-16">
        <div>
          <Reveal>
            <span className="eyebrow text-clay-600">What runs here</span>
            <h2 className="display mt-3 text-[2rem] text-ink sm:text-[2.6rem]">
              {location.status === "open"
                ? `The ${location.short} schedule`
                : "Nothing scheduled yet"}
            </h2>
          </Reveal>

          <RevealGroup className="mt-8 flex flex-col">
            {location.schedule.map((row) => (
              <motion.div
                key={row.label}
                variants={riseVariants}
                className="flex flex-col gap-1 border-t border-ink/12 py-5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-8"
              >
                <span className="display text-[1.24rem] text-ink">{row.label}</span>
                <span className="text-[0.92rem] leading-relaxed text-ink-soft sm:max-w-[26ch] sm:text-right">
                  {row.times}
                </span>
              </motion.div>
            ))}
          </RevealGroup>
        </div>

        <div className="flex flex-col gap-4">
          <Reveal>
            <div className="rounded-[22px] border border-ink/10 bg-clay-100/70 p-6">
              <h3 className="eyebrow text-clay-600">Address</h3>
              <p className="display mt-3 text-[1.4rem] leading-tight text-ink">{location.street}</p>
              <p className="mt-1 text-[0.92rem] font-semibold text-clay-600">
                {location.locality}, {location.regionCode}
              </p>
              {location.access && (
                <p className="mt-4 text-[0.88rem] leading-relaxed text-ink-soft">{location.access}</p>
              )}
              <a
                href={site.phoneHref}
                className="mt-5 flex h-12 items-center justify-center rounded-full border border-ink/20 text-[0.86rem] font-semibold text-ink transition-colors hover:bg-clay-50"
              >
                Call {site.phoneDisplay}
              </a>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <ul className="flex flex-col gap-3 rounded-[22px] bg-sky-brand/35 p-6">
              {location.highlights.map((point) => (
                <li key={point} className="flex gap-3 text-[0.9rem] leading-relaxed text-sky-ink">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-terracotta" />
                  {point}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
