"use client";

import { motion } from "framer-motion";
import { RevealGroup, Reveal, riseVariants } from "./motion-primitives";
import { reviews } from "@/lib/site";

export function Reviews() {
  return (
    <section className="shell pb-16 md:pb-24">
      <Reveal>
        <span className="eyebrow text-clay-600">What students say</span>
      </Reveal>

      <RevealGroup className="mt-7 grid gap-4 md:grid-cols-3">
        {reviews.map((review) => (
          <motion.figure
            key={review.author}
            variants={riseVariants}
            whileHover={{ y: -5 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            className="flex flex-col justify-between rounded-[22px] border border-ink/10 bg-clay-100/70 p-6"
          >
            <div>
              <span className="text-[0.9rem] tracking-[0.15em] text-terracotta">★★★★★</span>
              <blockquote className="mt-4 text-[0.96rem] leading-relaxed text-ink">
                “{review.quote}”
              </blockquote>
            </div>
            <figcaption className="mt-6 border-t border-ink/10 pt-4">
              <span className="block text-[0.9rem] font-bold text-ink">{review.author}</span>
              <span className="block text-[0.82rem] text-ink-soft">{review.meta}</span>
            </figcaption>
          </motion.figure>
        ))}
      </RevealGroup>
    </section>
  );
}
