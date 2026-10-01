"use client";

import { useScroll, useMotionValueEvent } from "framer-motion";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Logo } from "./Logo";
import { LocationSwitcher } from "./LocationSwitcher";
import { STAGE_EVENT, type StageState } from "./HeroStage";
import { useSiteData } from "./site/SiteData";

/** The menu's anchor: `#site-menu` opens it where scripts do not run. */
const MENU_ID = "site-menu";

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
  const { nav, studios, phone, phoneHref } = useSiteData();
  // A long menu (the old site had seventeen links) does not fit beside the
  // wordmark: it lives in the drawer, which then opens at every width.
  const many = nav.length > 3;
  const [open, setOpen] = useState(false);
  const close = () => {
    setOpen(false);
    if (window.location.hash === `#${MENU_ID}`) window.location.hash = "";
  };
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
      <header className="fixed inset-x-0 top-0 z-50 [animation:header-in_0.9s_cubic-bezier(0.16,1,0.3,1)_both]">
        <div
          className={`transition-[background-color,box-shadow] duration-500 ${
            stuck && !light
              ? "bg-clay-50/90 shadow-[0_1px_0_rgba(42,29,21,0.08)] backdrop-blur-md"
              : "bg-transparent"
          }`}
        >
          <div className="shell relative flex h-[72px] items-center justify-between gap-3 md:h-[84px]">
            <div className="flex items-center gap-7">
              <a href="/#top" className="flex shrink-0 items-center" aria-label="Hand Eye Ceramics — home">
                <Logo tone={light ? "cream" : "ink"} />
              </a>
              <nav className="hidden items-center gap-6 xl:flex">
                {(many ? [] : nav).map((item) => (
                  <a
                    key={item.label}
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
                href={phoneHref}
                className={`hidden h-11 items-center gap-2 rounded-full px-3.5 text-[0.84rem] font-semibold transition-colors sm:flex xl:px-5 ${
                  light
                    ? "border border-clay-50/40 text-clay-50 hover:bg-clay-50/15"
                    : "bg-terracotta text-clay-50 hover:bg-ink"
                }`}
              >
                <PhoneIcon className="h-4 w-4" />
                <span className="hidden xl:inline">{phone}</span>
                <span className="sr-only xl:hidden">Call {phone}</span>
              </a>

              {/* A link to the menu's anchor: without JavaScript the menu opens by :target. */}
              <a
                href={`#${MENU_ID}`}
                role="button"
                onClick={(e) => {
                  e.preventDefault();
                  setOpen(true);
                }}
                aria-label="Open menu"
                aria-expanded={open}
                aria-controls={MENU_ID}
                className={`flex h-11 w-11 items-center justify-center rounded-full border transition-colors ${many ? "" : "xl:hidden"} ${line}`}
              >
                <span className="flex flex-col gap-[5px]">
                  <span className={`block h-[1.5px] w-[18px] ${light ? "bg-clay-50" : "bg-ink"}`} />
                  <span className={`block h-[1.5px] w-[18px] ${light ? "bg-clay-50" : "bg-ink"}`} />
                </span>
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* The menu is always in the page — search engines and browsers without
          JavaScript get every link — and is only hidden until it is opened. */}
      <div
        id={MENU_ID}
        className={`group fixed inset-0 z-[60] bg-ink/45 backdrop-blur-sm transition-[opacity,visibility] duration-300 target:visible target:opacity-100 ${
          open ? "visible opacity-100" : "invisible opacity-0"
        } ${many ? "" : "xl:hidden"}`}
        onClick={close}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className={`grain relative max-h-[100svh] overflow-x-hidden overflow-y-auto rounded-b-[28px] bg-clay-50 px-5 pt-5 pb-9 transition-transform duration-[420ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-target:translate-y-0 ${
            open ? "translate-y-0" : "-translate-y-full"
          }`}
        >
          <div className={`relative z-10 ${many ? "mx-auto max-w-[78rem]" : ""}`}>
            <div className="flex items-center justify-between">
              <Logo />
              <a
                href="#"
                role="button"
                onClick={(e) => {
                  e.preventDefault();
                  close();
                }}
                aria-label="Close menu"
                className="flex h-11 w-11 items-center justify-center rounded-full border border-ink/15 text-lg"
              >
                ✕
              </a>
            </div>

                <nav
                  aria-label="Site menu"
                  className={many ? "mt-7 grid gap-x-10 sm:grid-cols-2 lg:grid-cols-3" : "mt-7 flex flex-col"}
                >
                  {nav.map((item) => (
                    <a
                      key={item.label}
                      href={item.href}
                      onClick={close}
                      className={`display border-b border-ink/10 text-ink transition-colors hover:text-terracotta ${many ? "py-3 text-[1.2rem]" : "py-4 text-[1.9rem]"}`}
                    >
                      {item.label}
                    </a>
                  ))}
                </nav>

                {/* Studios listed in full, so nobody leaves thinking we only
                    teach in the city they happen to be reading from. */}
                <div className="mt-7">
                  <span className="eyebrow text-clay-600">Our studios</span>
                  <div className={many ? "mt-3 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4" : "mt-3 flex flex-col gap-1.5"}>
                    {studios.map((loc) => (
                      <Link
                        key={loc.path}
                        href={loc.path}
                        onClick={close}
                        className={`flex min-h-14 flex-col justify-center rounded-2xl px-4 ${
                          loc.path === currentLocation ? "bg-sky-brand/45" : "bg-clay-100"
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

                <div className={many ? "mt-7 flex flex-col gap-3 sm:flex-row sm:[&>a]:flex-1" : "mt-7 flex flex-col gap-3"}>
                  <a
                    href="/#classes"
                    onClick={close}
                    className="flex h-14 items-center justify-center rounded-full bg-terracotta text-[0.95rem] font-semibold text-clay-50"
                  >
                    Book a class
                  </a>
                  <a
                    href={phoneHref}
                    className="flex h-14 items-center justify-center gap-2 rounded-full bg-sky-brand text-[0.95rem] font-semibold text-sky-ink"
                  >
                    <PhoneIcon className="h-4.5 w-4.5" />
                    {phone}
                  </a>
                </div>
          </div>
        </div>
      </div>
    </>
  );
}
