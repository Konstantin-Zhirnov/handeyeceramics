"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { ease } from "./motion-primitives";
import { locations } from "@/lib/site";

function PinIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <path
        d="M12 21s6.5-5.6 6.5-10a6.5 6.5 0 1 0-13 0c0 4.4 6.5 10 6.5 10Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <circle cx="12" cy="11" r="2.3" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

/**
 * The answer to "people in Vancouver think we're only in Nanaimo": every page
 * carries the full list of studios, and the current one is always named.
 */
export function LocationSwitcher({
  current,
  tone = "ink",
}: {
  current?: string;
  tone?: "ink" | "sky" | "glass";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = locations.find((l) => l.slug === current);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const trigger =
    tone === "glass"
      ? "border-clay-50/40 text-clay-50 hover:bg-clay-50/15"
      : tone === "sky"
      ? "border-sky-ink/25 text-sky-ink hover:bg-white/55"
      : "border-ink/15 text-ink hover:bg-clay-100";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={`flex h-11 items-center gap-2 rounded-full border px-4 text-[0.84rem] font-semibold transition-colors ${trigger}`}
      >
        <PinIcon className="h-4 w-4" />
        {active ? active.short : "All studios"}
        <svg viewBox="0 0 12 8" fill="none" aria-hidden className="h-2 w-3">
          <path d="M1 1.5 6 6.5l5-5" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease }}
            className="absolute right-0 z-50 mt-2 w-[17rem] overflow-hidden rounded-2xl border border-ink/10 bg-clay-50 p-1.5 shadow-[0_20px_44px_rgba(28,21,18,0.16)]"
          >
            {locations.map((loc) => (
              <Link
                key={loc.slug}
                href={`/classes/${loc.slug}`}
                onClick={() => setOpen(false)}
                role="menuitem"
                className={`flex flex-col rounded-xl px-3.5 py-3 transition-colors ${
                  loc.slug === current ? "bg-sky-brand/45" : "hover:bg-clay-100"
                }`}
              >
                <span className="flex items-center gap-2 text-[0.9rem] font-bold text-ink">
                  {loc.name}
                  {loc.status === "planned" && (
                    <span className="rounded-full bg-clay-200 px-2 py-0.5 text-[0.62rem] font-bold uppercase tracking-[0.1em] text-clay-600">
                      Soon
                    </span>
                  )}
                </span>
                <span className="mt-0.5 text-[0.78rem] text-ink-soft">{loc.region}</span>
              </Link>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
