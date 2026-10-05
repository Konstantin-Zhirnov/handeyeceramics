"use client";

import Image from "next/image";
import { Reveal } from "./motion-primitives";
import { Emph, useSiteData, type Photo, type SectionText } from "./site/SiteData";

/** Photos: the home global's gallery. Without photos only the heading and the Instagram link stay. */
export function Gallery({ text, photos }: { text: SectionText; photos: Photo[] }) {
  const { instagram } = useSiteData();
  const handle = instagram.replace(/\/+$/, "").split("/").pop();
  return (
    <section id="gallery" className="py-16 md:py-24">
      <div className="shell">
        <Reveal className="flex flex-wrap items-end justify-between gap-4">
          <div>
            {text.eyebrow && <span className="eyebrow text-clay-600">{text.eyebrow}</span>}
            {text.heading && (
              <h2 className="display mt-3 max-w-[16ch] text-heading text-ink sm:text-display">
                <Emph text={text.heading} />
              </h2>
            )}
          </div>
          {instagram && handle && (
            <a
              href={instagram}
              className="flex h-12 items-center gap-2 rounded-full border border-ink/20 px-5 text-label font-semibold text-ink transition-colors hover:bg-clay-100"
            >
              <span className="relative h-4 w-4">
                <Image src="/images/icon-instagram.png" alt="" fill sizes="16px" />
              </span>
              @{handle}
            </a>
          )}
        </Reveal>
      </div>

      {/* Edge-to-edge marquee. `overflow-hidden` on the rail keeps the page
          itself from ever scrolling sideways. */}
      {photos.length > 0 && (
        <Reveal className="marquee-mask relative mt-10 overflow-hidden" delay={0.1}>
          <div className="marquee-track flex w-max [&:hover]:[animation-play-state:paused]">
            {/* two identical halves → the -50% loop is seamless */}
            {[0, 1].map((half) => (
              <div key={half} className="flex shrink-0 gap-4 pr-4" aria-hidden={half === 1}>
                {photos.map((item) => (
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
      )}
    </section>
  );
}
