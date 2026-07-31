"use client";

import Image from "next/image";
import { Reveal } from "./motion-primitives";
import { gallery } from "@/lib/site";

export function Gallery() {
  return (
    <section id="gallery" className="py-16 md:py-24">
      <div className="shell">
        <Reveal className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="eyebrow text-clay-600">Gallery</span>
            <h2 className="display mt-3 max-w-[16ch] text-[2.2rem] text-ink sm:text-[3rem]">
              Made by people on their first try
            </h2>
          </div>
          <a
            href="https://www.instagram.com/handeyedesignceramics/"
            className="flex h-12 items-center gap-2 rounded-full border border-ink/20 px-5 text-[0.86rem] font-semibold text-ink transition-colors hover:bg-clay-100"
          >
            <span className="relative h-4 w-4">
              <Image src="/images/icon-instagram.png" alt="" fill sizes="16px" />
            </span>
            @handeyedesignceramics
          </a>
        </Reveal>
      </div>

      {/* Edge-to-edge marquee. `overflow-hidden` on the rail keeps the page
          itself from ever scrolling sideways. */}
      <Reveal className="marquee-mask relative mt-10 overflow-hidden" delay={0.1}>
        <div className="marquee-track flex w-max [&:hover]:[animation-play-state:paused]">
          {/* two identical halves → the -50% loop is seamless */}
          {[0, 1].map((half) => (
            <div key={half} className="flex shrink-0 gap-4 pr-4" aria-hidden={half === 1}>
              {gallery.map((item) => (
                <figure
                  key={`${half}-${item.src}`}
                  className="relative h-[210px] w-[160px] shrink-0 overflow-hidden rounded-2xl sm:h-[300px] sm:w-[230px]"
                >
                  <Image
                    src={item.src}
                    alt={half === 0 ? item.alt : ""}
                    fill
                    sizes="230px"
                    className="object-cover transition-transform duration-700 hover:scale-105"
                  />
                </figure>
              ))}
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}
