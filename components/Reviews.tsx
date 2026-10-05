"use client";

import { Reveal } from "./motion-primitives";
import type { SectionText } from "./site/SiteData";

/**
 * Only real testimonials go in the home global (`review-1`: eyebrow — which
 * course, heading — who, body — the quote). The section is built around one —
 * no filler quotes to make a three-column grid look full.
 */
export function Reviews({ text, review }: { text: SectionText; review?: SectionText }) {
  if (!review?.body) return null;

  return (
    <section className="shell pb-16 md:pb-24">
      <Reveal as="figure" className="mx-auto max-w-[62ch] text-center">
        {text.eyebrow && <span className="eyebrow text-clay-600">{text.eyebrow}</span>}
        <p className="mt-5 text-[1.1rem] tracking-[0.25em] text-terracotta">★★★★★</p>
        <blockquote className="display mt-5 text-title leading-[1.28] text-ink sm:text-heading-sm">
          “{review.body}”
        </blockquote>
        <figcaption className="mt-7 flex flex-col items-center gap-0.5">
          <span className="text-copy font-bold text-ink">{review.heading}</span>
          <span className="text-label text-ink-soft">{review.eyebrow}</span>
        </figcaption>
      </Reveal>
    </section>
  );
}
