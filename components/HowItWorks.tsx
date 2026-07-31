"use client";

import Image from "next/image";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { Reveal, RevealGroup, riseVariants } from "./motion-primitives";
import { steps } from "@/lib/site";

export function HowItWorks() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  // The wheel image turns as you scroll past it — the whole section is
  // literally built around a spinning wheel.
  const rotate = useTransform(scrollYProgress, [0, 1], [-25, 60]);
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [0.9, 1, 0.95]);

  return (
    <section id="how" className="shell py-16 md:py-24" ref={ref}>
      <div className="grid gap-12 lg:grid-cols-[1fr_0.9fr] lg:items-center lg:gap-16">
        <div>
          <Reveal>
            <span className="eyebrow text-clay-600">How it works</span>
            <h2 className="display mt-3 text-[2.2rem] text-ink sm:text-[3rem]">
              Three steps, and
              <br />
              none of them is talent
            </h2>
          </Reveal>

          <RevealGroup className="mt-9 flex flex-col">
            {steps.map((step, i) => (
              <motion.div
                key={step.title}
                variants={riseVariants}
                className="flex gap-5 border-t border-ink/12 py-6"
              >
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-ink/25 text-[0.85rem] font-bold text-ink">
                  {i + 1}
                </span>
                <div>
                  <h3 className="display text-[1.36rem] text-ink">{step.title}</h3>
                  <p className="mt-1.5 text-[0.94rem] leading-relaxed text-ink-soft">{step.body}</p>
                </div>
              </motion.div>
            ))}
          </RevealGroup>
        </div>

        <motion.div style={{ rotate, scale }} className="relative mx-auto w-full max-w-[440px]">
          <div className="relative aspect-square overflow-hidden rounded-full shadow-[0_30px_60px_rgba(28,21,18,0.18)]">
            <Image
              src="/images/wheel-spin.jpg"
              alt="Clay spinning on a potter's wheel, seen from directly above"
              fill
              sizes="(max-width: 1024px) 80vw, 40vw"
              className="scale-[1.15] object-cover object-[center_58%]"
            />
          </div>
          <span className="pointer-events-none absolute inset-6 rounded-full border border-clay-50/45" />
          <span className="pointer-events-none absolute inset-16 rounded-full border border-clay-50/30" />
        </motion.div>
      </div>
    </section>
  );
}
