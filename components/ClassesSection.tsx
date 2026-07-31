"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { Reveal, ease } from "./motion-primitives";
import { classTabs, site } from "@/lib/site";

export function ClassesSection() {
  const [active, setActive] = useState(classTabs[0].id);
  const current = classTabs.find((t) => t.id === active) ?? classTabs[0];

  return (
    <section id="classes" className="grain relative overflow-hidden bg-clay-100 py-16 md:py-24">
      <div className="shell relative z-10">
        <Reveal className="text-center">
          <span className="eyebrow text-clay-600">Classes</span>
          <h2 className="display mx-auto mt-3 max-w-[15ch] text-[2.2rem] text-ink sm:text-[3rem]">
            Pick the one that fits your week
          </h2>
        </Reveal>

        {/* Segmented control — scrolls horizontally inside itself on small
            phones instead of pushing the page sideways. */}
        <Reveal delay={0.1} className="mt-8">
          <div className="-mx-5 overflow-x-auto px-5 pb-1 md:mx-0 md:px-0">
            <div className="mx-auto flex w-max gap-1 rounded-full border border-ink/10 bg-clay-50 p-1.5">
              {classTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActive(tab.id)}
                  className="relative h-11 whitespace-nowrap rounded-full px-5 text-[0.86rem] font-semibold transition-colors"
                >
                  {active === tab.id && (
                    <motion.span
                      layoutId="tab-pill"
                      transition={{ duration: 0.4, ease }}
                      className="absolute inset-0 rounded-full bg-sky-brand"
                    />
                  )}
                  <span
                    className={`relative z-10 ${
                      active === tab.id ? "text-sky-ink" : "text-ink-soft"
                    }`}
                  >
                    {tab.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </Reveal>

        <div className="mt-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={current.id}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.42, ease }}
              className="grid overflow-hidden rounded-[26px] bg-clay-50 shadow-[0_24px_50px_rgba(28,21,18,0.09)] md:rounded-[32px] lg:grid-cols-2"
            >
              <div className="relative min-h-[260px] lg:min-h-[440px]">
                <Image
                  src={current.image}
                  alt={current.title}
                  fill
                  sizes="(max-width: 1024px) 100vw, 46vw"
                  className="object-cover"
                />
                <span className="absolute left-4 top-4 rounded-full bg-clay-50/92 px-3.5 py-2 text-[0.74rem] font-semibold text-ink">
                  {current.price}
                </span>
              </div>

              <div className="flex flex-col justify-center p-6 sm:p-9 lg:p-11">
                <h3 className="display text-[1.75rem] text-ink sm:text-[2.15rem]">{current.title}</h3>
                <p className="mt-4 text-[0.97rem] leading-relaxed text-ink-soft">{current.body}</p>

                <ul className="mt-6 flex flex-col gap-3">
                  {current.points.map((point, i) => (
                    <motion.li
                      key={point}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.15 + i * 0.07, duration: 0.4, ease }}
                      className="flex gap-3 text-[0.9rem] leading-relaxed text-ink-soft"
                    >
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-terracotta" />
                      {point}
                    </motion.li>
                  ))}
                </ul>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <a
                    href={site.bookingUrl}
                    className="flex h-13 items-center justify-center rounded-full bg-ink px-7 text-[0.9rem] font-semibold text-clay-50 transition-transform hover:-translate-y-0.5"
                  >
                    Book now
                  </a>
                  <a
                    href={site.phoneHref}
                    className="flex h-13 items-center justify-center rounded-full border border-ink/20 px-7 text-[0.9rem] font-semibold text-ink transition-colors hover:bg-clay-100"
                  >
                    Ask us a question
                  </a>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
