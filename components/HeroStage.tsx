"use client";

import Image from "next/image";
import {
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { SequenceCanvas } from "./SequenceCanvas";
import {
  googleTotals,
  site,
  stageChapters,
  stageSequence,
  type StageChapter,
} from "@/lib/site";

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

export type StageState = { overStage: boolean; cardVisible: boolean };

/** Header and the mobile call bar listen for this to change tone / hide. */
export const STAGE_EVENT = "hec:stage";

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
export function HeroStage() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
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
            {stageSequence ? (
              <SequenceCanvas
                path={stageSequence.path}
                count={stageSequence.count}
                progress={seq}
                poster={stageSequence.poster}
              />
            ) : (
              stageChapters.map((c, i) => (
                <Slide key={c.image} index={i} progress={p} reduce={!!reduce} chapter={c} />
              ))
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
              Pottery classes · Vancouver &amp; Nanaimo
            </p>

            <h1
              className="rise display mt-3 text-[2.15rem] leading-[1.02] text-ink sm:text-[2.9rem] lg:mt-5 lg:text-[clamp(3rem,4.6vw,4.6rem)]"
              style={{ animationDelay: "0.18s" }}
            >
              Throw
              <span aria-hidden className="text-clay-400">
                {" "}/
              </span>{" "}
              <br />
              <em className="italic">your first pot</em>
            </h1>

            <p
              className="rise mt-3 max-w-[40ch] text-[0.95rem] leading-relaxed text-ink-soft lg:mt-6 lg:text-[1.02rem]"
              style={{ animationDelay: "0.26s" }}
            >
              Six-week wheel courses, one-night drop-ins and date nights across three studios. No
              experience needed, every tool provided.
            </p>

            <div
              className="rise mt-4 flex gap-2.5 lg:mt-8 lg:gap-3"
              style={{ animationDelay: "0.34s" }}
            >
              <a
                href="#classes"
                className="flex h-12 flex-1 items-center justify-center rounded-full bg-terracotta px-6 text-[0.9rem] font-semibold text-clay-50 transition-transform hover:-translate-y-0.5 sm:flex-none lg:h-13 lg:px-8"
              >
                See classes
              </a>
              {/* one tap to call — full number from sm up, short label on small phones */}
              <a
                href={site.phoneHref}
                className="flex h-12 flex-1 items-center justify-center rounded-full border border-ink/25 px-5 text-[0.9rem] font-semibold text-ink transition-colors hover:bg-clay-50 sm:flex-none lg:h-13 lg:px-7"
              >
                <span className="sm:hidden">Call us</span>
                <span className="hidden sm:inline">Call {site.phoneDisplay}</span>
              </a>
            </div>

            <p
              className="stage-proof rise mt-4 flex items-center gap-2 text-[0.8rem] text-ink-soft lg:mt-8"
              style={{ animationDelay: "0.42s" }}
            >
              <span className="tracking-[0.12em] text-terracotta">★★★★★</span>
              {googleTotals.count} Google reviews across {googleTotals.profiles} studios
            </p>
          </div>
        </div>
      </motion.div>
    </section>
  );
}

type ChapterData = StageChapter;

function Slide({
  index,
  progress,
  reduce,
  chapter,
}: {
  index: number;
  progress: MotionValue<number>;
  reduce: boolean;
  chapter: ChapterData;
}) {
  const [a, b] = WINDOWS[index];
  const first = index === 0;
  const lastSlide = index === WINDOWS.length - 1;

  // The first photo is already on screen inside the card; the others fade in.
  const opacity = useTransform(
    progress,
    first ? [0, b - 0.06, b] : lastSlide ? [a, a + 0.06] : [a, a + 0.06, b - 0.06, b],
    first ? [1, 1, 0] : lastSlide ? [0, 1] : [0, 1, 1, 0],
  );
  // Slow push-in on the first photo, a settle-from-zoom on the others.
  const scale = useTransform(
    progress,
    first ? [0, b] : [a, b],
    reduce ? [1, 1] : first ? [1, 1.16] : [1.14, 1],
  );

  return (
    <motion.div className="absolute inset-0 will-change-transform" style={{ opacity, scale }}>
      <Image
        src={chapter.image}
        alt={first ? chapter.alt : ""}
        fill
        priority={first}
        sizes="100vw"
        className="object-cover"
        style={{ objectPosition: chapter.position }}
      />
    </motion.div>
  );
}

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
