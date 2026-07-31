"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { Reveal, RevealGroup, riseVariants } from "./motion-primitives";
import { site } from "@/lib/site";

const perks = [
  {
    title: "No time limits",
    body: "Flexible days, open shelves and a key to the door. Come in for twenty minutes or for the whole afternoon.",
  },
  {
    title: "Shared kilns and glazes",
    body: "Firing is included. So is our glaze library — the same colours you used in class, whenever you want them.",
  },
  {
    title: "A studio full of people",
    body: "Members, instructors and the odd film-prop commission. It's the part nobody expects and everybody stays for.",
  },
];

export function Membership() {
  return (
    <section id="membership" className="grain relative overflow-hidden bg-ink py-16 text-clay-50 md:py-24">
      <div className="shell relative z-10 grid gap-12 lg:grid-cols-[0.95fr_1fr] lg:items-center lg:gap-16">
        <Reveal>
          <div className="relative aspect-[4/5] w-full max-w-[440px] overflow-hidden rounded-[26px] lg:ml-auto">
            <Image
              src="/images/red-apron.png"
              alt="A studio member at the wheel on a weekday morning"
              fill
              sizes="(max-width: 1024px) 90vw, 42vw"
              className="object-cover"
            />
          </div>
        </Reveal>

        <div>
          <Reveal>
            <span className="eyebrow text-sky-brand">Membership & rentals</span>
            <h2 className="display mt-3 text-[2.3rem] sm:text-[3.2rem]">
              Studio access,
              <br />
              <span className="text-sky-brand">as low as $145 a month</span>
            </h2>
            <p className="mt-5 max-w-[44ch] text-[0.98rem] leading-relaxed text-clay-50/70">
              Taken a few classes and want somewhere to keep going? Our members practise on their
              own schedule in a studio that already knows their name.
            </p>
          </Reveal>

          <RevealGroup className="mt-9 flex flex-col">
            {perks.map((perk) => (
              <motion.div
                key={perk.title}
                variants={riseVariants}
                className="border-t border-clay-50/15 py-5"
              >
                <h3 className="text-[1.02rem] font-bold">{perk.title}</h3>
                <p className="mt-1.5 max-w-[52ch] text-[0.9rem] leading-relaxed text-clay-50/65">
                  {perk.body}
                </p>
              </motion.div>
            ))}
          </RevealGroup>

          <Reveal delay={0.1}>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href="#classes"
                className="flex h-14 items-center justify-center rounded-full bg-sky-brand px-8 text-[0.94rem] font-semibold text-sky-ink transition-transform hover:-translate-y-0.5"
              >
                Explore membership
              </a>
              <a
                href={site.phoneHref}
                className="flex h-14 items-center justify-center rounded-full border border-clay-50/30 px-8 text-[0.94rem] font-semibold text-clay-50 transition-colors hover:bg-clay-50/10"
              >
                Call {site.phoneDisplay}
              </a>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
