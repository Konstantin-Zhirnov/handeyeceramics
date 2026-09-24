"use client";

import { useMotionValueEvent, type MotionValue } from "framer-motion";
import { useEffect, useRef } from "react";

/**
 * Canvas image sequence scrubbed by scroll — the loader from the reference
 * skill's template, ported to React. Frames come from `build_media.py seq`:
 *   <path>/desktop/f000.webp … (1600 px) and <path>/mobile/f000.webp … (900 px)
 *
 * Loading: the first 24 frames eagerly, then every 4th, 2nd and 1st frame in
 * idle time. While a frame is still missing the nearest loaded one is drawn,
 * so scrubbing never shows a blank. The poster <img> covers the canvas until
 * the first frame lands, which keeps the server-rendered page complete.
 */
export function SequenceCanvas({
  path,
  count,
  progress,
  poster,
}: {
  path: string;
  count: number;
  progress: MotionValue<number>;
  poster: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const posterRef = useRef<HTMLImageElement>(null);
  const frames = useRef<(HTMLImageElement | undefined)[]>([]);
  const drawn = useRef(-1);

  const target = () => Math.round(progress.get() * (count - 1));
  const ready = (img?: HTMLImageElement) => Boolean(img && img.complete && img.naturalWidth > 0);

  const render = (force: boolean) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const t = target();
    if (!force && t === drawn.current) return;

    let index = -1;
    for (let d = 0; d < count && index === -1; d++) {
      if (ready(frames.current[t - d])) index = t - d;
      else if (ready(frames.current[t + d])) index = t + d;
    }
    if (index === -1) return;
    const img = frames.current[index]!;

    // object-fit: cover
    const cw = canvas.width;
    const ch = canvas.height;
    const s = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
    const w = img.naturalWidth * s;
    const h = img.naturalHeight * s;
    ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h);
    drawn.current = index;
    if (posterRef.current) posterRef.current.style.opacity = "0";
  };

  useEffect(() => {
    const set = window.matchMedia("(max-width: 767px)").matches ? "mobile" : "desktop";
    const src = (i: number) => `${path}/${set}/f${String(i).padStart(3, "0")}.webp`;
    frames.current = new Array(count);
    let cancelled = false;

    const load = (i: number) => {
      if (frames.current[i]) return;
      const img = new Image();
      img.decoding = "async";
      img.onload = () => {
        if (cancelled) return;
        const t = target();
        if (drawn.current === -1 || Math.abs(t - i) < Math.abs(t - drawn.current)) render(true);
      };
      img.src = src(i);
      frames.current[i] = img;
    };

    const size = () => {
      const c = canvasRef.current;
      if (!c) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      c.width = Math.round(c.clientWidth * dpr);
      c.height = Math.round(c.clientHeight * dpr);
      render(true);
    };

    for (let i = 0; i < Math.min(24, count); i++) load(i);
    const queue: number[] = [];
    for (const step of [4, 2, 1]) for (let i = 0; i < count; i += step) if (!queue.includes(i)) queue.push(i);
    let queued = 0;
    const later = (fn: () => void) =>
      "requestIdleCallback" in window ? requestIdleCallback(fn, { timeout: 300 }) : setTimeout(fn, 60);
    const pump = () => {
      if (cancelled) return;
      const until = queued + 12;
      for (; queued < queue.length && queued < until; queued++) load(queue[queued]);
      if (queued < queue.length) later(pump);
    };
    if (document.readyState === "complete") pump();
    else window.addEventListener("load", pump, { once: true });

    size();
    window.addEventListener("resize", size);
    return () => {
      cancelled = true;
      window.removeEventListener("resize", size);
      window.removeEventListener("load", pump);
    };
  }, [path, count]); // eslint-disable-line react-hooks/exhaustive-deps

  useMotionValueEvent(progress, "change", () => render(false));

  return (
    <>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={posterRef}
        src={poster}
        alt=""
        className="absolute inset-0 h-full w-full object-cover transition-opacity duration-300"
      />
    </>
  );
}
