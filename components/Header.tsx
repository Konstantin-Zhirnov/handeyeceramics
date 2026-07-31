"use client";

import { AnimatePresence, motion, useScroll, useMotionValueEvent } from "framer-motion";
import { useState } from "react";
import { Logo } from "./Logo";
import { ease } from "./motion-primitives";
import { nav, site } from "@/lib/site";

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

export function Header() {
  const [open, setOpen] = useState(false);
  const [stuck, setStuck] = useState(false);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (v) => setStuck(v > 40));

  return (
    <>
      <motion.header
        initial={{ y: -70, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.7, ease, delay: 0.1 }}
        className="fixed inset-x-0 top-0 z-50"
      >
        <div
          className={`transition-colors duration-300 ${
            stuck ? "bg-clay-50/92 backdrop-blur-md shadow-[0_1px_0_rgba(28,21,18,0.08)]" : "bg-transparent"
          }`}
        >
          <div className="shell flex h-[68px] items-center justify-between gap-4 md:h-[80px] pt-[0.7rem] pb-[0.7rem]">
            <a href="#top" className="flex h-11 shrink-0 items-center w-[76px] h-[76px]" aria-label={`${site.name} — home`}>
              <Logo />
            </a>

            <nav className="hidden items-center gap-7 lg:flex">
              {nav.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="relative py-2 text-[0.86rem] font-medium text-ink-soft transition-colors hover:text-ink"
                >
                  {item.label}
                </a>
              ))}
            </nav>

            <div className="flex items-center gap-2">
              {/* Tappable phone number — one tap to call, on every screen size. */}
              <a
                href={site.phoneHref}
                className="flex h-11 items-center gap-2 rounded-full border border-ink/15 px-3.5 text-[0.84rem] font-semibold text-ink transition-colors hover:border-ink/40 hover:bg-white/60 sm:px-4"
              >
                <PhoneIcon className="h-4 w-4" />
                <span className="hidden sm:inline">{site.phoneDisplay}</span>
                <span className="sr-only sm:hidden">Call {site.phoneDisplay}</span>
              </a>

              <a
                href="#classes"
                className="hidden h-11 items-center rounded-full bg-ink px-5 text-[0.84rem] font-semibold text-clay-50 transition-transform hover:-translate-y-0.5 md:inline-flex"
              >
                Book a class
              </a>

              <button
                type="button"
                onClick={() => setOpen(true)}
                aria-label="Open menu"
                className="flex h-11 w-11 items-center justify-center rounded-full border border-ink/15 lg:hidden"
              >
                <span className="flex flex-col gap-[5px]">
                  <span className="block h-[1.5px] w-[18px] bg-ink" />
                  <span className="block h-[1.5px] w-[18px] bg-ink" />
                </span>
              </button>
            </div>
          </div>
        </div>
      </motion.header>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[60] bg-ink/45 backdrop-blur-sm lg:hidden"
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

                <div className="mt-7 flex flex-col gap-3">
                  <a
                    href="#classes"
                    onClick={() => setOpen(false)}
                    className="flex h-14 items-center justify-center rounded-full bg-ink text-[0.95rem] font-semibold text-clay-50"
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
