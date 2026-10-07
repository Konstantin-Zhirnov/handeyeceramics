"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

/** Long, soft ease-out: the move lands quickly and then settles, like clay
 *  finding its rest. Same curve as the CSS entrances in globals.css. */
export const ease = [0.16, 1, 0.3, 1] as const;

/** Reveals run slower than UI feedback, long enough to read as a movement
 *  rather than a pop. The CSS in globals.css (`[data-reveal]`) carries the
 *  same figure, the same curve and the 26px travel. */
export const DUR_REVEAL = 0.9;

/** Cascade step between list rows, in seconds, capped so a long list doesn't
 *  make its last row wait for ages. */
const STAGGER = 0.07;
const STAGGER_CAP = 3;

/** Delay for the `index`-th `<Reveal>` in a list. `base` shifts the whole
 *  list, e.g. so rows follow the heading instead of racing it. */
export function revealDelay(index: number, base = 0): number {
  return base + Math.min(index, STAGGER_CAP) * STAGGER;
}

type RevealProps = {
  children: ReactNode;
  className?: string;
  /** Seconds. For lists use `revealDelay(i)`. */
  delay?: number;
  as?: "div" | "section" | "article" | "li" | "figure" | "header";
};

/**
 * One-shot scroll reveal that never ships `opacity:0` in the server HTML.
 *
 * Three states, not two. With no `data-reveal` the element is fully visible:
 * it's what the server renders and what stays if JS never runs, the visitor
 * asked for reduced motion, or the element was already on screen at mount.
 * `hidden` is only ever entered off-screen, so it's a cut nobody sees.
 * `shown` is the actual animation — a CSS transition, so no animation library
 * is loaded for it and nothing re-renders.
 *
 * Lists are one `<Reveal>` per row with `delay={revealDelay(i)}` rather than a
 * staggered group: each row has its own observer, so rows further down wait
 * for their own turn instead of finishing unseen when the grid's top arrives.
 */
export function Reveal({ children, className, delay = 0, as: Tag = "div" }: RevealProps) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let armed = false;
    // The observer's first report says where the element is without forcing a layout.
    const io = new IntersectionObserver(
      ([entry]) => {
        const viewport = entry.rootBounds?.height ?? window.innerHeight;
        if (!armed) {
          if (entry.isIntersecting || entry.boundingClientRect.top < viewport) return io.disconnect();
          armed = true;
          node.dataset.reveal = "hidden";
          return;
        }
        // A fifth of the element in view — or half a screen of it, for blocks taller than the screen.
        if (entry.intersectionRatio >= 0.2 || entry.intersectionRect.height >= viewport / 2) {
          node.dataset.reveal = "shown";
          io.disconnect();
        }
      },
      { threshold: [0, 0.05, 0.1, 0.2] },
    );
    io.observe(node);
    return () => {
      io.disconnect();
      delete node.dataset.reveal;
    };
  }, []);

  return (
    <Tag
      // One ref type for six tags: they are all plain HTML elements.
      ref={ref as never}
      className={className}
      style={delay ? ({ "--reveal-delay": `${delay}s` } as CSSProperties) : undefined}
    >
      {children}
    </Tag>
  );
}

type ParallaxProps = {
  children: ReactNode;
  className?: string;
  /** Total vertical travel in pixels while the element crosses the viewport. */
  distance?: number;
};

/**
 * Scroll parallax for a framed image: the child is scaled up just enough to
 * cover the frame at both ends of the travel and drifts up as the frame
 * scrolls through the viewport. Content renders in place on the server; the
 * motion value only touches `transform`, so nothing re-renders on scroll.
 * Reduced motion: no scale, no drift.
 */
export function Parallax({ children, className, distance = 56 }: ParallaxProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const travel = reduced ? 0 : distance;
  const y = useTransform(scrollYProgress, [0, 1], [travel / 2, -travel / 2]);

  return (
    <div ref={ref} className={className}>
      <motion.div
        className="absolute inset-0 will-change-transform"
        style={{ y, scale: reduced ? 1 : 1.12 }}
      >
        {children}
      </motion.div>
    </div>
  );
}

type SpinProps = {
  children: ReactNode;
  className?: string;
  /** Total rotation in degrees while the element crosses the viewport. */
  degrees?: number;
};

/**
 * Scroll-driven turn for a picture shot from above a wheel: the child is
 * scaled up to keep the frame's corners covered and turns a few degrees as
 * the frame scrolls through the viewport, so the wheel seems to creep round.
 * Only `transform` moves; reduced motion leaves the picture still.
 */
export function Spin({ children, className, degrees = 10 }: SpinProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const turn = reduced ? 0 : degrees;
  const rotate = useTransform(scrollYProgress, [0, 1], [-turn / 2, turn / 2]);

  return (
    <div ref={ref} className={className}>
      <motion.div className="will-change-transform" style={{ rotate, scale: reduced ? 1 : 1.16 }}>
        {children}
      </motion.div>
    </div>
  );
}
