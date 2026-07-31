"use client";

import Image from "next/image";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { Reveal, ease } from "./motion-primitives";

export function StatBlock() {
  return (
    <section className="shell pb-16 pt-4 text-center md:pb-24">
      <Reveal>
        <motion.p
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-15%" }}
          transition={{ duration: 0.9, ease }}
          className="display whitespace-nowrap text-[4.2rem] leading-[0.85] text-ink sm:text-[6.4rem] lg:text-[8rem]"
        >
          6 weeks
        </motion.p>
      </Reveal>

      <Reveal delay={0.12}>
        <p className="display mx-auto mt-4 max-w-[16ch] text-[1.9rem] text-ink sm:text-[2.6rem]">
          from wet clay to{" "}
          <span className="text-terracotta">a mug you actually drink from</span>
        </p>
      </Reveal>

      <Reveal delay={0.2}>
        <p className="mx-auto mt-5 max-w-[46ch] text-[0.95rem] leading-relaxed text-ink-soft">
          One evening a week, six weeks in a row. You centre, throw, trim, glaze — and we fire
          everything in house.
        </p>
        <a
          href="#classes"
          className="mt-8 inline-flex h-14 items-center rounded-full bg-terracotta px-9 text-[0.95rem] font-semibold text-clay-50 transition-transform hover:-translate-y-0.5"
        >
          See the schedule
        </a>
      </Reveal>
    </section>
  );
}

/** Full-bleed studio panorama with a gentle parallax lift. */
export function ImageBand() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["-6%", "6%"]);

  return (
    <div ref={ref} className="relative h-[46vw] max-h-[520px] min-h-[240px] overflow-hidden">
      <motion.div style={{ y }} className="absolute inset-[-8%]">
        <Image
          src="/images/studio-panorama.jpg"
          alt="The Gore Avenue studio: brick walls, big windows, shelves of finished pots"
          fill
          sizes="100vw"
          className="object-cover"
        />
      </motion.div>
      <div className="absolute inset-0 bg-gradient-to-t from-ink/25 to-transparent" />
    </div>
  );
}
