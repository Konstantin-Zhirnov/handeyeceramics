"use client";

import {
  motion,
  useMotionValueEvent,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { Fragment, useEffect, useRef, useState } from "react";
import { SequenceCanvas } from "./SequenceCanvas";
import { STAGE_EVENT, type StageState } from "./stage-event";
import { stageSequence } from "@/lib/site";
import { Emph, useSiteData, type SectionText } from "./site/SiteData";

/** The hero card's copy, from the home global. In the title ` / ` breaks the line and `*…*` is italic. */
export type HeroText = { eyebrow: string; title: string; subtitle: string; cta: { label: string; href: string } };

/** Share of the pinned scroll spent turning the card into the full stage. */
const EXPAND_END = 0.16;

/** Chapter windows on the stage's scroll progress, [fade-in start, fade-out end]. */
const WINDOWS: [number, number][] = stageSequence?.windows ?? [
  [0.1, 0.46],
  [0.42, 0.74],
  [0.7, 1.01],
];

/** Dot / chapter boundaries: the midpoint of each overlap between windows. */
const BOUNDS = WINDOWS.slice(1).map(([a], i) => (a + WINDOWS[i][1]) / 2);

function emit(state: StageState) {
  window.dispatchEvent(new CustomEvent<StageState>(STAGE_EVENT, { detail: state }));
}

/**
 * The reference reel's hero, rebuilt for a pottery studio: a split card
 * (copy left, photo right) whose photo grows into a full-bleed pinned stage,
 * then three chapters play out as you scroll: a lump of clay throws itself
 * into a vase on the wheel, then takes its glaze.
 *
 * Everything in the first screen is server-rendered and visible before any
 * JavaScript runs; scroll only moves --p and the chapter layers.
 */
export function HeroStage({ hero, chapters, h1 }: { hero: HeroText; chapters: SectionText[]; h1?: string }) {
  const { phone, phoneHref, googleReviews } = useSiteData();
  // Chapter copy: the home global's stage-1…stage-3 (eyebrow — label, heading, body).
  const stageChapters: ChapterData[] = chapters.slice(0, WINDOWS.length).map((c, i) => ({
    n: String(i + 1).padStart(2, "0"),
    label: c.eyebrow,
    title: c.heading,
    body: c.body,
  }));
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const p = useSpring(scrollYProgress, { stiffness: 140, damping: 32, mass: 0.35 });
  const expand = useTransform(p, [0, EXPAND_END], [0, 1], { clamp: true });
  const seq = useTransform(p, [EXPAND_END, 1], [0, 1], { clamp: true });

  const [active, setActive] = useState(0);
  const last = useRef<StageState>({ overStage: false, cardVisible: true });

  const sync = (v: number) => {
    setActive(BOUNDS.filter((b) => v >= b).length);
    const el = ref.current;
    if (!el) return;
    const bottom = el.getBoundingClientRect().bottom;
    const next = { overStage: expand.get() > 0.55 && bottom > 84, cardVisible: expand.get() < 0.6 };
    if (next.overStage !== last.current.overStage || next.cardVisible !== last.current.cardVisible) {
      last.current = next;
      emit(next);
    }
  };

  useMotionValueEvent(p, "change", sync);
  // Progress stops at 1 once the stage bottom meets the viewport, but the
  // stage keeps scrolling away after that — re-check the tone on page scroll
  // too, or the nav stays cream-on-cream over the next section.
  const { scrollY } = useScroll();
  useMotionValueEvent(scrollY, "change", () => sync(p.get()));
  // Browsers restore the scroll position on reload; settle the tone once on mount.
  useEffect(() => sync(p.get()), []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section
      ref={ref}
      id="top"
      aria-label="Hand Eye Ceramics — from clay to a finished pot"
      className="relative h-[340vh] lg:h-[400vh]"
    >
      <motion.div
        className="stage sticky top-0 h-[100svh] overflow-hidden"
        style={{ "--p": expand } as Record<string, MotionValue<number>>}
      >
        {/* ---- Stage: photo inside the card, then full bleed ---- */}
        <div className="stage-media absolute inset-0 bg-clay-200">
          <div className="stage-frame">
            {stageSequence && (
              <SequenceCanvas
                path={stageSequence.path}
                count={stageSequence.count}
                progress={seq}
                poster={stageSequence.poster}
                posterSmall={stageSequence.posterSmall}
              />
            )}
          </div>

          {/* legibility: nav on top, chapter copy at the bottom */}
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-ink/55 to-transparent"
            style={{ opacity: "var(--p)" }}
          />
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-[42%] bg-gradient-to-t from-ink/80 via-ink/35 to-transparent sm:h-[55%] sm:from-ink/75 sm:via-ink/25"
            style={{ opacity: "var(--p)" }}
          />

          <div className="stage-overlay">
            <div className="absolute bottom-[96px] left-[var(--edge)] right-[var(--edge)] md:bottom-16">
              <div className="relative min-h-[5.5rem] max-w-[34rem] sm:min-h-[9.5rem] lg:max-w-[23rem]">
                {stageChapters.map((c, i) => (
                  <Chapter key={c.n} chapter={c} window={WINDOWS[i]} progress={p} />
                ))}
              </div>
            </div>

            <ol
              aria-label="Chapters"
              className="absolute bottom-7 left-1/2 hidden -translate-x-1/2 gap-2 md:flex"
            >
              {stageChapters.map((c, i) => (
                <li key={c.n}>
                  <span className="sr-only">{c.label}</span>
                  <span
                    className={`block h-1.5 rounded-full bg-clay-50 transition-all duration-500 ${
                      i === active ? "w-7 opacity-100" : "w-1.5 opacity-50"
                    }`}
                  />
                </li>
              ))}
            </ol>
          </div>
        </div>

        {/* ---- Card: the copy panel, server-rendered, visible pre-hydration ---- */}
        <div className="stage-text grain z-10 flex flex-col justify-center overflow-hidden border border-clay-200 bg-clay-100 px-5 py-5 sm:px-8 lg:px-12 lg:py-10">
          <div className="relative z-10">
            <p className="rise eyebrow text-clay-600" style={{ animationDelay: "0.1s" }}>
              {hero.eyebrow}
            </p>

            {/* The page's H1, word for word from the old site: a line above the prototype's large one. */}
            {h1 && (
              <h1 className="rise eyebrow mt-1.5 text-ink" style={{ animationDelay: "0.14s" }}>
                {h1}
              </h1>
            )}

            {/* The prototype's line, kept as decoration. */}
            <p
              className="rise display mt-3 text-[2.15rem] leading-[1.02] text-ink sm:text-[2.9rem] lg:mt-5 lg:text-[clamp(3rem,4.6vw,4.6rem)]"
              style={{ animationDelay: "0.18s" }}
            >
              {hero.title.split(" / ").map((line, i) => (
                <Fragment key={i}>
                  {i > 0 && (
                    <>
                      <span aria-hidden className="text-clay-400">
                        {" "}/
                      </span>{" "}
                      <br />
                    </>
                  )}
                  <Emph text={line} />
                </Fragment>
              ))}
            </p>

            <p
              className="rise mt-3 max-w-[40ch] text-[0.95rem] leading-relaxed text-ink-soft lg:mt-6 lg:text-[1.02rem]"
              style={{ animationDelay: "0.26s" }}
            >
              {hero.subtitle}
            </p>

            <div
              className="rise mt-4 flex gap-2.5 lg:mt-8 lg:gap-3"
              style={{ animationDelay: "0.34s" }}
            >
              <a
                href={hero.cta.href || "#classes"}
                className="flex h-12 flex-1 items-center justify-center rounded-full bg-terracotta px-6 text-[0.9rem] font-semibold text-clay-50 transition-transform hover:-translate-y-0.5 sm:flex-none lg:h-13 lg:px-8"
              >
                {hero.cta.label}
              </a>
              {/* one tap to call — full number from sm up, short label on small phones */}
              <a
                href={phoneHref}
                className="flex h-12 flex-1 items-center justify-center rounded-full border border-ink/25 px-5 text-[0.9rem] font-semibold text-ink transition-colors hover:bg-clay-50 sm:flex-none lg:h-13 lg:px-7"
              >
                <span className="sm:hidden">Call us</span>
                <span className="hidden sm:inline">Call {phone}</span>
              </a>
            </div>

            <p
              className="stage-proof rise mt-4 flex items-center gap-2 text-[0.8rem] text-ink-soft lg:mt-8"
              style={{ animationDelay: "0.42s" }}
            >
              <span className="tracking-[0.12em] text-terracotta">★★★★★</span>
              {googleReviews.count} Google reviews across {googleReviews.profiles} studios
            </p>
          </div>
        </div>
      </motion.div>
    </section>
  );
}

type ChapterData = { n: string; label: string; title: string; body: string };

function Chapter({
  chapter,
  window: [a, b],
  progress,
}: {
  chapter: ChapterData;
  window: [number, number];
  progress: MotionValue<number>;
}) {
  const lastChapter = b > 1;
  const opacity = useTransform(
    progress,
    lastChapter ? [a, a + 0.06] : [a, a + 0.06, b - 0.06, b],
    lastChapter ? [0, 1] : [0, 1, 1, 0],
  );
  const y = useTransform(progress, [a, a + 0.08], [22, 0]);

  return (
    <motion.div className="absolute inset-x-0 bottom-0 text-clay-50" style={{ opacity, y }}>
      <p className="eyebrow text-sky-brand">
        {chapter.n} — {chapter.label}
      </p>
      <p className="display mt-2 text-[1.6rem] leading-[1.08] sm:mt-3 sm:text-[2.6rem] lg:text-[2.5rem]">
        {chapter.title}
      </p>
      {/* phones: eyebrow + title only, so the copy sits below the object */}
      <p className="mt-3 hidden max-w-[40ch] text-[0.95rem] leading-relaxed text-clay-50/80 sm:block">
        {chapter.body}
      </p>
    </motion.div>
  );
}
