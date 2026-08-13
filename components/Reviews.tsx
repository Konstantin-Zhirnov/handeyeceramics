"use client";

import { Reveal } from "./motion-primitives";
import { reviews } from "@/lib/site";

/**
 * Only real testimonials go in `reviews`. There is one, so the section is
 * built around one — no filler quotes to make a three-column grid look full.
 */
export function Reviews() {
  const review = reviews[0];
  if (!review) return null;

  return (
    <section className="shell pb-16 md:pb-24">
      <Reveal as="figure" className="mx-auto max-w-[62ch] text-center">
        <span className="eyebrow text-clay-600">What students say</span>
        <p className="mt-5 text-[1.1rem] tracking-[0.25em] text-terracotta">★★★★★</p>
        <blockquote className="display mt-5 text-[1.5rem] leading-[1.28] text-ink sm:text-[1.95rem]">
          “{review.quote}”
        </blockquote>
        <figcaption className="mt-7 flex flex-col items-center gap-0.5">
          <span className="text-[0.95rem] font-bold text-ink">{review.author}</span>
          <span className="text-[0.85rem] text-ink-soft">{review.meta}</span>
        </figcaption>
      </Reveal>
    </section>
  );
}
