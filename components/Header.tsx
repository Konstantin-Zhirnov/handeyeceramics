"use client";

import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import Link from "next/link";
import { Logo } from "./Logo";
import { LocationSwitcher } from "./LocationSwitcher";
import { STAGE_EVENT, type StageState } from "./stage-event";
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
  const opener = useRef<HTMLAnchorElement>(null);
  const closer = useRef<HTMLAnchorElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  // A page opened at #site-menu shows the menu by :target; take it over, so the keyboard works there too.
  useEffect(() => {
    if (window.location.hash === `#${MENU_ID}`) setOpen(true);
  }, []);

  // While the menu is open: focus moves into it and stays there, Escape closes it,
  // and closing hands focus back to the button that opened it.
  useEffect(() => {
    if (!open) return;
    const back = opener.current;
    // The panel turns visible on the first frame of its transition; an invisible element cannot take focus.
    const entering = window.setTimeout(() => closer.current?.focus(), 60);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return close();
      if (e.key !== "Tab") return;
      const stops = panel.current?.querySelectorAll<HTMLElement>("a[href], button");
      if (!stops?.length) return;
      const first = stops[0];
      const last = stops[stops.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(entering);
      document.removeEventListener("keydown", onKey);
      back?.focus();
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  /** The two menu buttons are links, so the menu opens without scripts; a link ignores Space, a button must not. */
  const onSpace = (act: () => void) => (e: ReactKeyboardEvent) => {
    if (e.key !== " ") return;
    e.preventDefault();
    act();
  };

  useEffect(() => {
    const on = () => setStuck(window.scrollY > 40);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  // The home page's hero stage tells us when the nav sits on top of a photo.
  useEffect(() => {
    const on = (e: Event) => setOverStage((e as CustomEvent<StageState>).detail.overStage);
    window.addEventListener(STAGE_EVENT, on);
    return () => window.removeEventListener(STAGE_EVENT, on);
  }, []);

  const light = overStage && !open;
  const ink = light ? "text-clay-50" : "text-ink";
  const line = light ? "border-clay-50/40 hover:bg-clay-50/15" : "border-ink/20 hover:bg-clay-100";
  // Over the hero photo the blue ring is lost; cream reads there.
  const ring = light ? "focus-visible:outline-clay-50" : "";

  return (
    <>
      {/* First stop for the keyboard: past the header, straight to the page. Off-screen until focused. */}
      <a
        href="#main"
        className="fixed left-4 top-3 z-[70] -translate-y-24 rounded-full bg-ink px-5 py-3 text-ui font-semibold text-clay-50 transition-transform focus-visible:translate-y-0"
      >
        Skip to content
      </a>

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
              <a href="/#top" className={`flex shrink-0 items-center ${ring}`} aria-label="Hand Eye Ceramics — home">
                <Logo tone={light ? "cream" : "ink"} />
              </a>
              <nav aria-label="Primary" className="hidden items-center gap-6 xl:flex">
                {(many ? [] : nav).map((item) => (
                  <a
                    key={item.label}
                    href={item.href}
                    className={`py-2 text-label font-medium transition-colors ${
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
                className={`hidden h-11 items-center gap-2 rounded-full px-3.5 text-label font-semibold transition-colors sm:flex xl:px-5 ${ring} ${
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
                ref={opener}
                href={`#${MENU_ID}`}
                role="button"
                onClick={(e) => {
                  e.preventDefault();
                  setOpen(true);
                }}
                onKeyDown={onSpace(() => setOpen(true))}
                aria-label="Open menu"
                aria-expanded={open}
                aria-controls={MENU_ID}
                className={`flex h-11 w-11 items-center justify-center rounded-full border transition-colors ${many ? "" : "xl:hidden"} ${line} ${ring}`}
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
          ref={panel}
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          onClick={(e) => e.stopPropagation()}
          className={`grain relative max-h-[100svh] overflow-x-hidden overflow-y-auto overscroll-contain rounded-b-stage bg-clay-50 px-5 pt-5 pb-9 transition-transform duration-[420ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-target:translate-y-0 ${
            open ? "translate-y-0" : "-translate-y-full"
          }`}
        >
          <div className={`relative z-10 ${many ? "mx-auto max-w-[78rem]" : ""}`}>
            <div className="flex items-center justify-between">
              <Logo />
              <a
                ref={closer}
                href="#"
                role="button"
                onClick={(e) => {
                  e.preventDefault();
                  close();
                }}
                onKeyDown={onSpace(close)}
                aria-label="Close menu"
                className="flex h-11 w-11 items-center justify-center rounded-full border border-ink/15 text-ink"
              >
                <svg viewBox="0 0 24 24" fill="none" aria-hidden className="h-4 w-4">
                  <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
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
                      className={`display border-b border-ink/10 text-ink transition-colors hover:text-terracotta ${many ? "py-3 text-title-sm" : "py-4 text-heading-sm"}`}
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
                        <span className="flex items-center gap-2 text-copy font-bold text-ink">
                          {loc.name}
                          {loc.status === "planned" && (
                            <span className="rounded-full bg-clay-200 px-2 py-0.5 text-micro font-bold uppercase tracking-[0.1em] text-ink">
                              Soon
                            </span>
                          )}
                        </span>
                        <span className="text-caption text-ink-soft">{loc.region}</span>
                      </Link>
                    ))}
                  </div>
                </div>

                <div className={many ? "mt-7 flex flex-col gap-3 sm:flex-row sm:[&>a]:flex-1" : "mt-7 flex flex-col gap-3"}>
                  <a
                    href="/#classes"
                    onClick={close}
                    className="flex h-14 items-center justify-center rounded-full bg-terracotta text-copy font-semibold text-clay-50"
                  >
                    Book a class
                  </a>
                  <a
                    href={phoneHref}
                    className="flex h-14 items-center justify-center gap-2 rounded-full bg-sky-brand text-copy font-semibold text-sky-ink"
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
