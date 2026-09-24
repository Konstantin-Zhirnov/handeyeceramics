"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { Logo } from "./Logo";
import { Reveal } from "./motion-primitives";
import { STAGE_EVENT, type StageState } from "./HeroStage";
import { site } from "@/lib/site";

const columns = [
  {
    heading: "Classes",
    links: [
      "Adult beginner & intermediate",
      "Youth pottery classes",
      "Nanaimo classes",
      "Friday night drop-in",
      "Private lessons",
    ],
  },
  {
    heading: "Book us",
    links: [
      "Group workshops",
      "Pottery date night",
      "Team building & events",
      "Commissions & film props",
      "Gift cards",
    ],
  },
  {
    heading: "Studio",
    links: ["Membership & rentals", "Open studio", "Student resources", "Shop", "About us"],
  },
];

export function Footer() {
  return (
    <footer className="grain relative overflow-hidden bg-clay-100 pt-14 pb-28 md:pb-14">
      <div className="shell relative z-10">
        <Reveal className="grid gap-10 lg:grid-cols-[1.1fr_2fr]">
          <div>
            <Logo />
            <p className="mt-5 max-w-[34ch] text-[0.9rem] leading-relaxed text-ink-soft">
              Hands-on pottery classes in Vancouver and Nanaimo. Come learn to throw, hand build
              and glaze — and rediscover what your hands can do.
            </p>

            <div className="mt-6 flex flex-col gap-2.5">
              <a
                href={site.phoneHref}
                className="display flex h-12 items-center text-[1.5rem] text-ink transition-colors hover:text-terracotta"
              >
                {site.phoneDisplay}
              </a>
              <a
                href={`mailto:${site.email}`}
                className="flex h-11 items-center text-[0.92rem] font-medium text-ink-soft transition-colors hover:text-ink"
              >
                {site.email}
              </a>
              <a
                href={site.instagram}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-ink/20 transition-colors hover:bg-clay-50"
                aria-label="Instagram"
              >
                <span className="relative h-4.5 w-4.5">
                  <Image src="/images/icon-instagram.png" alt="" fill sizes="18px" />
                </span>
              </a>
            </div>
          </div>

          <div className="grid gap-8 sm:grid-cols-3">
            {columns.map((col) => (
              <div key={col.heading}>
                <h3 className="eyebrow text-clay-600">{col.heading}</h3>
                <ul className="mt-4 flex flex-col gap-0.5">
                  {col.links.map((link) => (
                    <li key={link}>
                      <a
                        href="/#classes"
                        className="flex min-h-[40px] items-center text-[0.88rem] leading-snug text-ink-soft transition-colors hover:text-ink"
                      >
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Reveal>

        <div className="mt-12 flex flex-col gap-3 border-t border-ink/12 pt-6 text-[0.78rem] text-ink-soft sm:flex-row sm:items-center sm:justify-between">
          <p>© 2023 Hand Eye Design Ceramics Inc.</p>
          <p className="max-w-[54ch]">
            Redesign prototype · Next.js + Framer Motion. Photography and copy from
            handeyeceramics.com.
          </p>
        </div>
      </div>
    </footer>
  );
}

/**
 * Sticky call bar for phones. The original site left its phone number as plain
 * text; here it is always one thumb away.
 */
export function MobileCallBar({ hideDuringHero = false }: { hideDuringHero?: boolean }) {
  // On the home page the hero card already carries both buttons, and the bar
  // would sit on top of them — it slides in once the card has scrolled away.
  const [shown, setShown] = useState(!hideDuringHero);

  useEffect(() => {
    if (!hideDuringHero) return;
    const on = (e: Event) => setShown(!(e as CustomEvent<StageState>).detail.cardVisible);
    window.addEventListener(STAGE_EVENT, on);
    return () => window.removeEventListener(STAGE_EVENT, on);
  }, [hideDuringHero]);

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-ink/10 bg-clay-50/95 px-4 py-3 backdrop-blur-md transition-transform duration-500 md:hidden ${
        shown ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <div className="flex gap-2.5">
        <a
          href="/#classes"
          className="flex h-13 flex-1 items-center justify-center rounded-full bg-terracotta text-[0.9rem] font-semibold text-clay-50"
        >
          Book a class
        </a>
        <a
          href={site.phoneHref}
          className="flex h-13 flex-1 items-center justify-center gap-2 rounded-full bg-sky-brand text-[0.9rem] font-semibold text-sky-ink"
        >
          <svg viewBox="0 0 24 24" fill="none" aria-hidden className="h-4 w-4">
            <path
              d="M6.6 3.5h2.2l1.5 4-1.9 1.4a12.5 12.5 0 0 0 6.7 6.7l1.4-1.9 4 1.5v2.2a2 2 0 0 1-2.2 2A16.8 16.8 0 0 1 4.6 5.7a2 2 0 0 1 2-2.2Z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
          </svg>
          Call us
        </a>
      </div>
    </div>
  );
}
