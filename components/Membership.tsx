"use client";

import Image from "next/image";
import Link from "next/link";
import { Reveal, revealDelay } from "./motion-primitives";
import { useSiteData, type SectionText } from "./site/SiteData";

/** Texts: home global, `membership` and `perk-N`. In the heading ` / ` starts the highlighted line. */
export function Membership({ text, perks, href }: { text: SectionText; perks: SectionText[]; href: string }) {
  const { phone, phoneHref } = useSiteData();
  const [first, ...rest] = text.heading.split(" / ");
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
            {text.eyebrow && <span className="eyebrow text-sky-brand">{text.eyebrow}</span>}
            {text.heading && (
              <h2 className="display mt-3 text-[2.3rem] sm:text-[3.2rem]">
                {first}
                {rest.length > 0 && (
                  <>
                    <br />
                    <span className="text-sky-brand">{rest.join(" / ")}</span>
                  </>
                )}
              </h2>
            )}
            {text.body && (
              <p className="mt-5 max-w-[44ch] text-[0.98rem] leading-relaxed text-clay-50/70">{text.body}</p>
            )}
          </Reveal>

          <div className="mt-9 flex flex-col">
            {perks.map((perk, i) => (
              <Reveal key={perk.heading} delay={revealDelay(i)} className="border-t border-clay-50/15 py-5">
                <h3 className="text-[1.02rem] font-bold">{perk.heading}</h3>
                <p className="mt-1.5 max-w-[52ch] text-[0.9rem] leading-relaxed text-clay-50/65">{perk.body}</p>
              </Reveal>
            ))}
          </div>

          <Reveal delay={0.1}>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href={href}
                className="flex h-14 items-center justify-center rounded-full bg-sky-brand px-8 text-[0.94rem] font-semibold text-sky-ink transition-transform hover:-translate-y-0.5"
              >
                Explore membership
              </Link>
              {phoneHref && (
                <a
                  href={phoneHref}
                  className="flex h-14 items-center justify-center rounded-full border border-clay-50/30 px-8 text-[0.94rem] font-semibold text-clay-50 transition-colors hover:bg-clay-50/10"
                >
                  Call {phone}
                </a>
              )}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
