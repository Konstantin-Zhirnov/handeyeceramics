"use client";

import { motion } from "framer-motion";
import { RevealGroup, riseVariants } from "./motion-primitives";

const items = [
  {
    title: "No experience needed",
    body: "If you've never touched clay in your life, you're exactly who these classes are built for.",
    icon: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
  },
  {
    title: "Three studios",
    body: "Chinatown, Mt Pleasant and Nanaimo — pick whichever one is on your way home.",
    icon: (
      <>
        <path d="M12 21s6.5-5.6 6.5-10a6.5 6.5 0 1 0-13 0c0 4.4 6.5 10 6.5 10Z" />
        <circle cx="12" cy="11" r="2.4" />
      </>
    ),
  },
  {
    title: "Small classes",
    body: "Enough wheels, enough space and an instructor who actually gets round to you.",
    icon: (
      <>
        <circle cx="9" cy="9.5" r="3" />
        <circle cx="17" cy="11" r="2.3" />
        <path d="M3.5 19c.6-3 3-4.6 5.5-4.6S14 16 14.6 19M16 14.6c2 .3 3.7 1.8 4.2 4.4" />
      </>
    ),
  },
  {
    title: "From $145 / month",
    body: "Studio membership with no time limits — come practise on your own schedule.",
    icon: (
      <>
        <path d="M4 8.5h16v10H4z" />
        <path d="M4 8.5 8 4h8l4 4.5M9.5 12.5h5" />
      </>
    ),
  },
];

export function FeatureStrip() {
  return (
    <section className="shell py-14 md:py-20">
      <RevealGroup className="grid gap-x-8 gap-y-9 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item, i) => (
          <motion.div
            key={item.title}
            variants={riseVariants}
            className={`relative pt-7 ${
              i > 0 ? "lg:pl-8" : ""
            } before:absolute before:left-0 before:top-0 before:h-px before:w-full before:bg-ink/12`}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
              className="h-8 w-8 text-clay-600"
            >
              {item.icon}
            </svg>
            <h3 className="display mt-4 text-[1.32rem] text-ink">{item.title}</h3>
            <p className="mt-2 text-[0.92rem] leading-relaxed text-ink-soft">{item.body}</p>
          </motion.div>
        ))}
      </RevealGroup>
    </section>
  );
}
