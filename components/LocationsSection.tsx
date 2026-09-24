"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Reveal, RevealGroup, riseVariants } from "./motion-primitives";
import { locations } from "@/lib/site";

export function LocationsSection() {
  return (
    <section id="locations" className="shell pb-16 md:pb-24">
      <Reveal className="max-w-[48ch]">
        <span className="eyebrow text-clay-600">Locations</span>
        <h2 className="display mt-3 text-[2.2rem] text-ink sm:text-[3rem]">
          Four studios, <em className="italic">one community</em>
        </h2>
        <p className="mt-4 text-[0.96rem] leading-relaxed text-ink-soft">
          Each studio has its own page, its own schedule and its own listing in local search — so
          nobody in Nanaimo assumes we only teach in Vancouver, and nobody in Vancouver assumes the
          opposite.
        </p>
      </Reveal>

      <RevealGroup className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {locations.map((loc) => (
          <motion.article key={loc.slug} variants={riseVariants} className="h-full">
            <Link
              href={`/classes/${loc.slug}`}
              className="group flex h-full flex-col overflow-hidden rounded-[22px] border border-ink/10 bg-clay-50 transition-shadow hover:shadow-[0_18px_36px_rgba(28,21,18,0.10)]"
            >
              <div className="relative h-[180px] overflow-hidden">
                <Image
                  src={loc.image}
                  alt={loc.name}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  className={`object-cover transition-transform duration-700 group-hover:scale-105 ${
                    loc.status === "planned" ? "opacity-55 grayscale" : ""
                  }`}
                />
                <span
                  className={`absolute left-3 top-3 rounded-full px-3 py-1.5 text-[0.68rem] font-bold uppercase tracking-[0.12em] ${
                    loc.status === "planned"
                      ? "bg-clay-200 text-clay-600"
                      : "bg-sky-brand text-sky-ink"
                  }`}
                >
                  {loc.tag}
                </span>
              </div>

              <div className="flex flex-1 flex-col p-5">
                <h3 className="display text-[1.32rem] text-ink">{loc.name}</h3>
                <p className="mt-1 text-[0.86rem] font-semibold text-clay-600">{loc.street}</p>
                <p className="mt-3 flex-1 text-[0.86rem] leading-relaxed text-ink-soft">
                  {loc.note}
                </p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-[0.86rem] font-bold text-ink">
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
          </motion.article>
        ))}
      </RevealGroup>
    </section>
  );
}
