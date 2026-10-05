"use client";

import Image from "next/image";
import { AnimatePresence, LazyMotion, MotionConfig } from "framer-motion";
import * as m from "framer-motion/m";
import { useState } from "react";
import { Reveal, ease } from "./motion-primitives";
import { Emph, useSiteData, type ClassTab, type SectionText } from "./site/SiteData";

/** The animation engine arrives after the section is on screen and usable: the tabs work without it. */
const loadFeatures = () => import("./motion-features").then((r) => r.default);

/** The classes with a tab name, one tab each. Nothing to show — no section. */
export function ClassesSection({ text, tabs }: { text: SectionText; tabs: ClassTab[] }) {
  const { phoneHref } = useSiteData();
  const [active, setActive] = useState(tabs[0]?.id);
  const current = tabs.find((t) => t.id === active) ?? tabs[0];
  if (!current) return null;

  return (
    <LazyMotion features={loadFeatures}>
    <MotionConfig reducedMotion="user">
    <section id="classes" className="grain relative overflow-hidden bg-clay-100 py-16 md:py-24">
      <div className="shell relative z-10">
        <Reveal className="text-center">
          {text.eyebrow && <span className="eyebrow text-clay-600">{text.eyebrow}</span>}
          {text.heading && (
            <h2 className="display mx-auto mt-3 max-w-[15ch] text-heading text-ink sm:text-display">
              <Emph text={text.heading} />
            </h2>
          )}
        </Reveal>

        {/* Segmented control — scrolls horizontally inside itself on small
            phones instead of pushing the page sideways. */}
        {tabs.length > 1 && (
          <Reveal delay={0.1} className="mt-8">
            <div className="-mx-5 overflow-x-auto px-5 pb-1 md:mx-0 md:px-0">
              <div className="mx-auto flex w-max gap-1 rounded-full border border-ink/10 bg-clay-50 p-1.5">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActive(tab.id)}
                    className="relative h-11 whitespace-nowrap rounded-full px-5 text-label font-semibold transition-colors"
                  >
                    {current.id === tab.id && (
                      <m.span
                        layoutId="tab-pill"
                        transition={{ duration: 0.4, ease }}
                        className="absolute inset-0 rounded-full bg-sky-brand"
                      />
                    )}
                    <span className={`relative z-10 ${current.id === tab.id ? "text-sky-ink" : "text-ink-soft"}`}>
                      {tab.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </Reveal>
        )}

        <div className="mt-10">
          <AnimatePresence mode="wait" initial={false}>
            <m.div
              key={current.id}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.55, ease }}
              className="grid overflow-hidden rounded-panel bg-clay-50 shadow-[0_24px_50px_rgba(28,21,18,0.09)] md:rounded-stage lg:grid-cols-2"
            >
              <div className="relative min-h-[260px] bg-clay-200 lg:min-h-[440px]">
                {current.photo && (
                  <Image
                    src={current.photo.src}
                    alt={current.photo.alt}
                    fill
                    sizes="(max-width: 1024px) 100vw, 46vw"
                    className="object-cover"
                  />
                )}
                {current.badge && (
                  <span className="absolute left-4 top-4 rounded-full bg-clay-50/92 px-3.5 py-2 text-caption font-semibold text-ink">
                    {current.badge}
                  </span>
                )}
              </div>

              <div className="flex flex-col justify-center p-6 sm:p-9 lg:p-11">
                <h3 className="display text-title-lg text-ink sm:text-heading">{current.title}</h3>
                {current.body && <p className="mt-4 text-copy leading-relaxed text-ink-soft">{current.body}</p>}
                <ul className="mt-6 flex flex-col gap-3">
                  {current.points.map((point, i) => (
                    <m.li
                      key={point}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.15 + i * 0.07, duration: 0.4, ease }}
                      className="flex gap-3 text-ui leading-relaxed text-ink-soft"
                    >
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-terracotta" />
                      {point}
                    </m.li>
                  ))}
                </ul>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <a
                    href={current.bookHref}
                    className="flex h-13 items-center justify-center rounded-full bg-terracotta px-7 text-ui font-semibold text-clay-50 transition-transform hover:-translate-y-0.5"
                  >
                    Book now
                  </a>
                  {phoneHref && (
                    <a
                      href={phoneHref}
                      className="flex h-13 items-center justify-center rounded-full border border-ink/20 px-7 text-ui font-semibold text-ink transition-colors hover:bg-clay-100"
                    >
                      Ask us a question
                    </a>
                  )}
                </div>
              </div>
            </m.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
    </MotionConfig>
    </LazyMotion>
  );
}
