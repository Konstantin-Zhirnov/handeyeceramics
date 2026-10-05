"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { useSiteData } from "./site/SiteData";

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
 * `current` is the path of the studio whose page this is.
 */
export function LocationSwitcher({
  current,
  tone = "ink",
}: {
  current?: string;
  tone?: "ink" | "sky" | "glass";
}) {
  const { studios } = useSiteData();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const listId = useId();
  const active = studios.find((l) => l.path === current);

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

  if (!studios.length) return null;

  const trigger =
    tone === "glass"
      ? "border-clay-50/40 text-clay-50 hover:bg-clay-50/15 focus-visible:outline-clay-50"
      : tone === "sky"
      ? "border-sky-ink/25 text-sky-ink hover:bg-white/55"
      : "border-ink/15 text-ink hover:bg-clay-100";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={listId}
        className={`flex h-11 items-center gap-2 rounded-full border px-4 text-label font-semibold transition-colors ${trigger}`}
      >
        <PinIcon className="h-4 w-4" />
        {active ? active.short : "All studios"}
        <svg viewBox="0 0 12 8" fill="none" aria-hidden className="h-2 w-3">
          <path d="M1 1.5 6 6.5l5-5" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      </button>

      {/* Always in the page and only hidden: the fade and the 8px drop are a CSS transition, both ways.
          A plain list of links, reached with Tab: no menu roles, which would promise arrow keys. */}
      <div
        id={listId}
        aria-hidden={!open}
        className={`absolute right-0 z-50 mt-2 w-[17rem] overflow-hidden rounded-2xl border border-ink/10 bg-clay-50 p-1.5 shadow-[0_20px_44px_rgba(28,21,18,0.16)] transition-[opacity,transform,visibility] duration-[220ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
          open ? "visible translate-y-0 opacity-100" : "invisible -translate-y-2 opacity-0"
        }`}
      >
            {studios.map((loc) => (
              <Link
                key={loc.path}
                href={loc.path}
                onClick={() => setOpen(false)}
                className={`flex flex-col rounded-xl px-3.5 py-3 transition-colors ${
                  loc.path === current ? "bg-sky-brand/45" : "hover:bg-clay-100"
                }`}
              >
                <span className="flex items-center gap-2 text-ui font-bold text-ink">
                  {loc.name}
                  {loc.status === "planned" && (
                    <span className="rounded-full bg-clay-200 px-2 py-0.5 text-micro font-bold uppercase tracking-[0.1em] text-ink">
                      Soon
                    </span>
                  )}
                </span>
                <span className="mt-0.5 text-caption text-ink-soft">{loc.region}</span>
              </Link>
            ))}
      </div>
    </div>
  );
}
