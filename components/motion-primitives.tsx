"use client";

import { MotionConfig, motion, useInView, type Variants } from "framer-motion";
import { useLayoutEffect, useRef, useState, type ElementType, type ReactNode } from "react";

/** Long, soft ease-out: the move lands quickly and then settles, like clay
 *  finding its rest. Same curve as the CSS entrances in globals.css. */
export const ease = [0.16, 1, 0.3, 1] as const;

/** Reveals run slower than UI feedback, long enough to read as a movement
 *  rather than a pop. */
export const DUR_REVEAL = 0.9;

/** Kept modest on purpose: a long slide makes text re-rasterise every frame,
 *  which is exactly the jitter a reveal is meant to avoid. */
const REVEAL_DISTANCE = 26;

/** Cascade step between list rows, in seconds, capped so a long list doesn't
 *  make its last row wait for ages. */
const STAGGER = 0.07;
const STAGGER_CAP = 3;

/** Delay for the `index`-th `<Reveal>` in a list. `base` shifts the whole
 *  list, e.g. so rows follow the heading instead of racing it. */
export function revealDelay(index: number, base = 0): number {
  return base + Math.min(index, STAGGER_CAP) * STAGGER;
}

/**
 * Three states, not two. `rest` is fully visible: it's what the server renders
 * and what stays if JS never runs, the visitor asked for reduced motion, or
 * the element was already on screen at mount. `hidden` is only ever entered
 * off-screen, so it's a zero-duration cut nobody sees. `shown` is the actual
 * animation; `custom` carries the delay.
 */
const revealVariants: Variants = {
  rest: { opacity: 1, y: 0 },
  hidden: { opacity: 0, y: REVEAL_DISTANCE, transition: { duration: 0 } },
  shown: (delay: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: DUR_REVEAL, ease, delay },
  }),
};

// ElementType cast: JSX can't be checked against a union of motion tags
// whose ref types disagree.
const TAGS: Record<"div" | "section" | "article" | "li" | "figure" | "header", ElementType> = {
  div: motion.div,
  section: motion.section,
  article: motion.article,
  li: motion.li,
  figure: motion.figure,
  header: motion.header,
};

type RevealProps = {
  children: ReactNode;
  className?: string;
  /** Seconds. For lists use `revealDelay(i)`. */
  delay?: number;
  as?: keyof typeof TAGS;
};

/**
 * One-shot scroll reveal that never ships `opacity:0` in the server HTML.
 *
 * After mount it arms only what is still below the fold; anything already
 * painted stays put, so nothing blinks out at hydration and fades back in.
 * Lists are one `<Reveal>` per row with `delay={revealDelay(i)}` rather than a
 * staggered group: each row has its own observer, so rows further down wait
 * for their own turn instead of finishing unseen when the grid's top arrives.
 */
export function Reveal({ children, className, delay = 0, as = "div" }: RevealProps) {
  const Tag = TAGS[as];
  const ref = useRef<HTMLElement>(null);
  const [armed, setArmed] = useState(false);
  const inView = useInView(ref, { once: true, amount: 0.2 });

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (node.getBoundingClientRect().top < window.innerHeight) return;
    setArmed(true);
  }, []);

  return (
    <Tag
      ref={ref}
      className={className}
      initial={false}
      animate={!armed ? "rest" : inView ? "shown" : "hidden"}
      variants={revealVariants}
      custom={delay}
    >
      {children}
    </Tag>
  );
}

/** Turns every Framer transform/opacity animation into an instant cut when the
 *  OS asks for reduced motion. Mounted once in the root layout. */
export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
