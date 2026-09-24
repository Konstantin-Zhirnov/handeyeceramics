"use client";

import { AnimatePresence, motion, useScroll, useMotionValueEvent } from "framer-motion";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Logo } from "./Logo";
import { LocationSwitcher } from "./LocationSwitcher";
import { ease } from "./motion-primitives";
import { STAGE_EVENT, type StageState } from "./HeroStage";
import { locations, nav, site } from "@/lib/site";

function PhoneIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <path
        d="M6.6 3.5h2.2l1.5 4-1.9 1.4a12.5 12.5 0 0 0 6.7 6.7l1.4-1.9 4 1.5v2.2a2 2 0 0 1-2.2 2A16.8 16.8 0 0 1 4.6 5.7a2 2 0 0 1 2-2.2Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Header({ currentLocation }: { currentLocation?: string } = {}) {
  const [open, setOpen] = useState(false);
  const [stuck, setStuck] = useState(false);
  const [overStage, setOverStage] = useState(false);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (v) => setStuck(v > 40));

  // The home page's hero stage tells us when the nav sits on top of a photo.
  useEffect(() => {
    const on = (e: Event) => setOverStage((e as CustomEvent<StageState>).detail.overStage);
    window.addEventListener(STAGE_EVENT, on);
    return () => window.removeEventListener(STAGE_EVENT, on);
  }, []);

  const light = overStage && !open;
  const ink = light ? "text-clay-50" : "text-ink";
  const line = light ? "border-clay-50/40 hover:bg-clay-50/15" : "border-ink/20 hover:bg-clay-100";

  return (
    <>
      {/* No JS-driven entrance here on purpose: the header used to start at
          opacity 0 and only appear once Framer Motion had hydrated, so on a
          slow phone the logo was missing for the first moments. The slide-in
          is now a pure CSS animation that runs from first paint. */}
      <header className="fixed inset-x-0 top-0 z-50 [animation:header-in_0.7s_cubic-bezier(0.22,0.61,0.36,1)_both]">
        <div
          className={`transition-[background-color,box-shadow] duration-500 ${
            stuck && !light
              ? "bg-clay-50/90 shadow-[0_1px_0_rgba(42,29,21,0.08)] backdrop-blur-md"
              : "bg-transparent"
          }`}
        >
          <div className="shell relative flex h-[72px] items-center justify-between gap-3 md:h-[84px]">
            <div className="flex items-center gap-7">
              <a href="/#top" className="flex shrink-0 items-center" aria-label={`${site.name} — home`}>
                <Logo tone={light ? "cream" : "ink"} />
              </a>
              <nav className="hidden items-center gap-6 xl:flex">
                {nav.map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    className={`py-2 text-[0.84rem] font-medium transition-colors ${
                      light ? "text-clay-50/85 hover:text-clay-50" : "text-ink-soft hover:text-ink"
                    }`}
                  >
                    {item.label}
                  </a>
                ))}
              </nav>
            </div>

            {/* The reference's centred Didone wordmark. */}
            <a
              href="/#top"
              aria-hidden
              tabIndex={-1}
              className={`wordmark absolute left-1/2 -translate-x-1/2 text-[0.8rem] transition-colors duration-500 sm:text-[1rem] lg:text-[1.05rem] xl:text-[1.4rem] ${ink}`}
            >
              Hand Eye <span className="opacity-60">/</span> Ceramics
            </a>

            <div className="flex items-center gap-2">
              <span className="hidden md:block">
                <LocationSwitcher current={currentLocation} tone={light ? "glass" : "ink"} />
              </span>

              {/* Tappable phone number. Small phones get it from the sticky
                  bottom bar and the hero; from sm up it lives here too. */}
              <a
                href={site.phoneHref}
                className={`hidden h-11 items-center gap-2 rounded-full px-3.5 text-[0.84rem] font-semibold transition-colors sm:flex xl:px-5 ${
                  light
                    ? "border border-clay-50/40 text-clay-50 hover:bg-clay-50/15"
                    : "bg-terracotta text-clay-50 hover:bg-ink"
                }`}
              >
                <PhoneIcon className="h-4 w-4" />
                <span className="hidden xl:inline">{site.phoneDisplay}</span>
                <span className="sr-only xl:hidden">Call {site.phoneDisplay}</span>
              </a>

              <button
                type="button"
                onClick={() => setOpen(true)}
                aria-label="Open menu"
                className={`flex h-11 w-11 items-center justify-center rounded-full border transition-colors xl:hidden ${line}`}
              >
                <span className="flex flex-col gap-[5px]">
                  <span className={`block h-[1.5px] w-[18px] ${light ? "bg-clay-50" : "bg-ink"}`} />
                  <span className={`block h-[1.5px] w-[18px] ${light ? "bg-clay-50" : "bg-ink"}`} />
                </span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[60] bg-ink/45 backdrop-blur-sm xl:hidden"
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ y: "-100%" }}
              animate={{ y: 0 }}
              exit={{ y: "-100%" }}
              transition={{ duration: 0.42, ease }}
              onClick={(e) => e.stopPropagation()}
              className="grain relative overflow-hidden rounded-b-[28px] bg-clay-50 px-5 pt-5 pb-9"
            >
              <div className="relative z-10">
                <div className="flex items-center justify-between">
                  <Logo />
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="Close menu"
                    className="flex h-11 w-11 items-center justify-center rounded-full border border-ink/15 text-lg"
                  >
                    ✕
                  </button>
                </div>

                <nav className="mt-7 flex flex-col">
                  {nav.map((item, i) => (
                    <motion.a
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.12 + i * 0.05, duration: 0.4, ease }}
                      className="display border-b border-ink/10 py-4 text-[1.9rem] text-ink"
                    >
                      {item.label}
                    </motion.a>
                  ))}
                </nav>

                {/* Studios listed in full, so nobody leaves thinking we only
                    teach in the city they happen to be reading from. */}
                <div className="mt-7">
                  <span className="eyebrow text-clay-600">Our studios</span>
                  <div className="mt-3 flex flex-col gap-1.5">
                    {locations.map((loc) => (
                      <Link
                        key={loc.slug}
                        href={`/classes/${loc.slug}`}
                        onClick={() => setOpen(false)}
                        className={`flex min-h-14 flex-col justify-center rounded-2xl px-4 ${
                          loc.slug === currentLocation ? "bg-sky-brand/45" : "bg-clay-100"
                        }`}
                      >
                        <span className="flex items-center gap-2 text-[0.94rem] font-bold text-ink">
                          {loc.name}
                          {loc.status === "planned" && (
                            <span className="rounded-full bg-clay-200 px-2 py-0.5 text-[0.62rem] font-bold uppercase tracking-[0.1em] text-clay-600">
                              Soon
                            </span>
                          )}
                        </span>
                        <span className="text-[0.8rem] text-ink-soft">{loc.region}</span>
                      </Link>
                    ))}
                  </div>
                </div>

                <div className="mt-7 flex flex-col gap-3">
                  <a
                    href="#classes"
                    onClick={() => setOpen(false)}
                    className="flex h-14 items-center justify-center rounded-full bg-terracotta text-[0.95rem] font-semibold text-clay-50"
                  >
                    Book a class
                  </a>
                  <a
                    href={site.phoneHref}
                    className="flex h-14 items-center justify-center gap-2 rounded-full bg-sky-brand text-[0.95rem] font-semibold text-sky-ink"
                  >
                    <PhoneIcon className="h-4.5 w-4.5" />
                    {site.phoneDisplay}
                  </a>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
