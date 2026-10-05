import { Fragment, type CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { RichText, type JSXConvertersFunction } from "@payloadcms/richtext-lexical/react";
import type { Media, Video } from "@/payload-types";
import { mediaSrc } from "@/lib/cms/media";
import { Reveal } from "@/components/motion-primitives";
import { FormBlock } from "./FormBlock";
import { MuxVideo } from "./MuxVideo";
import { ClassListBlock } from "./ClassListBlock";
import { PlanListBlock } from "./PlanListBlock";
import { ProductListBlock } from "./ProductListBlock";
import { FEW_WORDS, chapters, hasLeadIn, lengthOf, linkOnly, type Chapter, type LexNode, type OtherBlock, type PageBlock, type Passage, type PictureBlock } from "./chapters";

export type { PageBlock };

const asMedia = (m: unknown) => (m && typeof m === "object" ? (m as Media) : null);

/** The cascade step between neighbours in a grid, in seconds; the fourth and later wait no longer than the third. */
const cascade = (index: number) => Math.min(index, 3) * 0.07;

/** Under this many characters a text is too short to hold a tall picture in place beside it. */
const SHORT_COLUMN = 500;
/** From this width-to-height ratio a picture is a panorama: it takes the width of the page. */
const PANORAMA = 1.9;

type FrameProps = {
  media: Media | null;
  sizes: string;
  /** Cropped to the upright shape every cell of a grid shares. */
  tile?: boolean;
  /** Opens the frame and eases the picture into place as it scrolls into view (`.frame-settle` in globals.css). */
  settle?: boolean;
  /** A CSS length the frame never grows wider than. */
  cap?: string;
  /** Kept to the far edge of its column, where the column is wider than the picture. */
  end?: boolean;
  /** Lower: a picture beside a short text. */
  low?: boolean;
};

/**
 * A picture in its frame. On its own it keeps its proportions, is shown
 * whole, is never stretched past its own pixels (the old site's photos are
 * small) and never grows taller than a share of the screen.
 */
function Frame({ media, sizes, tile = false, settle = false, cap, end = false, low = false }: FrameProps) {
  if (!media?.url) return null;
  const width = media.width || 1600;
  const height = media.height || 1200;
  const picture = { src: mediaSrc(media.url), alt: media.alt, width, height, sizes };
  if (tile) {
    return (
      <div className="overflow-hidden rounded-card bg-clay-100">
        <Image {...picture} className="aspect-[4/5] w-full object-cover" />
      </div>
    );
  }
  // The whole picture, always: a frame that would be too tall is made narrower, never cropped (`.frame` in globals.css).
  const shape = { "--frame-natural": `${width}px`, "--frame-ratio": (width / height).toFixed(4), ...(cap ? { "--frame-cap": cap } : {}) } as CSSProperties;
  return (
    <div className={`frame overflow-hidden rounded-panel bg-clay-100 ${low ? "frame-low" : ""} ${settle ? "frame-settle" : ""} ${end ? "lg:ml-auto" : ""}`} style={shape}>
      <Image {...picture} className="h-auto w-full" />
    </div>
  );
}

function VideoBlock({ video, caption }: { video: Video | number | null | undefined; caption?: string | null }) {
  const v = video && typeof video === "object" ? (video as Video & { playbackOptions?: { playbackId?: string }[] }) : null;
  const playbackId = v?.playbackOptions?.[0]?.playbackId;
  const poster = asMedia(v?.poster);
  return (
    <figure>
      {playbackId ? (
        // Mux Player is loaded only when a Mux asset exists (story 11).
        <MuxVideo playbackId={playbackId} />
      ) : poster ? (
        <Frame media={poster} sizes="(max-width: 768px) 100vw, 62rem" />
      ) : (
        <div className="grid aspect-video place-items-center rounded-card bg-clay-100 text-ink-soft">{v?.title || "Video"}</div>
      )}
      {caption && <figcaption className="mt-2 text-sm text-ink-soft">{caption}</figcaption>}
    </figure>
  );
}

/** The picture or the video that opens a chapter. */
function Plate({ block, ...frame }: { block: PictureBlock } & Omit<FrameProps, "media" | "tile">) {
  if (block.blockType === "video") return <VideoBlock video={block.video} caption={block.caption} />;
  return (
    <figure>
      <Frame media={asMedia(block.image)} {...frame} />
      {block.caption && <figcaption className="mt-2 text-sm text-ink-soft">{block.caption}</figcaption>}
    </figure>
  );
}

const shapeOf = (b: PictureBlock) => {
  const m = b.blockType === "image" ? asMedia(b.image) : null;
  return m?.width && m.height ? m.width / m.height : 1;
};

/** A paragraph that is only a link is a call to action: its own line, an arrow, a full-size target (`.rich .cta`). */
const converters: JSXConvertersFunction = ({ defaultConverters }) => ({
  ...defaultConverters,
  paragraph: (args) => {
    if (linkOnly(args.node as LexNode)) return <p className="cta">{args.nodesToJSX({ nodes: args.node.children })}</p>;
    const fallback = defaultConverters.paragraph;
    return typeof fallback === "function" ? fallback(args) : fallback;
  },
});

type Voice = "column" | "reading" | "display" | "plate" | "lead";

/**
 * The words of a chapter, in one of five voices (`.rich-*` in globals.css):
 * `column` beside a picture, `reading` on its own, `display` for a few words
 * set large (`quiet` — a size down, after another display), `plate` under a
 * card, `lead` over the picture it introduces.
 */
function Copy({ texts, voice = "column", wide = false, quiet = false }: { texts: Passage[]; voice?: Voice; wide?: boolean; quiet?: boolean }) {
  if (!texts.length) return null;
  const leadIn = (voice === "column" || voice === "reading") && hasLeadIn(texts);
  return (
    <div className={`rich rich-${voice} ${leadIn ? "rich-lede" : ""} ${wide ? "rich-wide" : ""} ${quiet ? "rich-quiet" : ""}`}>
      {texts.map((t) => (
        <Fragment key={t.key}>
          {t.heading && <h2>{t.heading}</h2>}
          {t.body && <RichText data={t.body} converters={converters} disableContainer />}
        </Fragment>
      ))}
    </div>
  );
}

/** What introduces a picture, over it. */
const Lead = ({ texts, wide }: { texts: Passage[]; wide: boolean }) =>
  texts.length ? (
    <div className="mb-5">
      <Copy texts={texts} voice="lead" wide={wide} />
    </div>
  ) : null;

function Other({ block: b }: { block: OtherBlock }) {
  switch (b.blockType) {
    case "cta":
      return (
        <section className="rounded-panel border border-clay-200 bg-clay-100 px-6 py-8">
          <h2 className="display text-2xl text-ink">{b.heading}</h2>
          {b.body && <p className="mt-3 text-ink-soft">{b.body}</p>}
          <Link href={b.buttonHref} className="mt-5 inline-flex rounded-full bg-ink px-6 py-3 text-clay-50">
            {b.buttonLabel}
          </Link>
        </section>
      );
    case "form":
      return <FormBlock heading={b.heading} formType={b.formType} />;
    case "classList":
      return <ClassListBlock heading={b.heading} studio={b.studio} />;
    case "productList":
      return <ProductListBlock heading={b.heading} category={b.category} all={b.all} />;
    case "planList":
      return <PlanListBlock heading={b.heading} group={b.group} />;
    default:
      return null;
  }
}

type View = {
  chapter: Chapter;
  /** Mirrors the two-column forms, so pictures alternate sides down the page. */
  flip: boolean;
  /** A display chapter right after a loud one speaks a size down. */
  quiet: boolean;
  /** The page's first poster stands on a card. */
  card: boolean;
  wide: boolean;
};

function ChapterView({ chapter: c, flip, quiet, card, wide }: View) {
  switch (c.kind) {
    case "block":
      return <Other block={c.block} />;

    case "text":
      return (
        <Reveal as="section" className="max-w-[68ch]">
          <Copy texts={c.texts} voice="reading" wide={wide} />
        </Reveal>
      );

    case "figure":
      return (
        <section>
          <Lead texts={c.lead} wide={wide} />
          <Plate block={c.media} sizes="(max-width: 768px) 100vw, 62rem" settle cap={shapeOf(c.media) < 0.95 ? "30rem" : undefined} />
        </section>
      );

    case "spread": {
      // A panorama squeezed into a column is a sliver: it takes the page's width, its text under it.
      if (shapeOf(c.media) >= PANORAMA) {
        return (
          <section className="flex flex-col gap-7">
            <div>
              <Lead texts={c.lead} wide={wide} />
              <Plate block={c.media} sizes="(max-width: 768px) 100vw, 78rem" settle />
            </div>
            <Reveal className="max-w-[68ch]">
              <Copy texts={c.texts} wide={wide} />
            </Reveal>
          </section>
        );
      }
      // Beside a long text the picture holds its place while the column scrolls past it;
      // beside a short one it is smaller, and the two are centred on each other.
      const short = lengthOf(c.texts) < SHORT_COLUMN;
      const mediaAt = short ? (flip ? "lg:col-span-4 lg:col-start-9" : "lg:col-span-4 lg:col-start-1") : flip ? "lg:col-span-5 lg:col-start-8" : "lg:col-span-5 lg:col-start-1";
      const textAt = flip ? "lg:col-start-1" : short ? "lg:col-start-6" : "lg:col-start-7";
      return (
        <section className={`grid gap-x-10 gap-y-7 lg:grid-cols-12 ${short ? "items-center" : "items-start"}`}>
          <div className={`lg:row-start-1 ${mediaAt} ${short ? "" : "lg:sticky lg:top-28"}`}>
            <Lead texts={c.lead} wide={wide} />
            <Plate block={c.media} sizes="(max-width: 1024px) 100vw, 32rem" settle end={flip} low={short} />
          </div>
          <Reveal className={`lg:col-span-6 lg:row-start-1 ${textAt}`}>
            <Copy texts={c.texts} wide={wide} />
          </Reveal>
        </section>
      );
    }

    // The words stand on the picture's foot. The first poster of a page is its one
    // change of surface: a clay card, like the hero's.
    case "poster":
      return (
        <section
          className={`grid items-end gap-x-10 gap-y-7 lg:grid-cols-12 ${
            card ? "grain relative overflow-hidden rounded-stage border border-clay-200 bg-clay-100 px-5 py-8 sm:px-8 sm:py-10 lg:px-12 lg:py-12" : ""
          }`}
        >
          <div className={`relative z-10 max-w-[26rem] lg:col-span-4 lg:row-start-1 lg:max-w-none ${flip ? "lg:col-start-1" : "lg:col-start-9"}`}>
            <Lead texts={c.lead} wide={wide} />
            <Plate block={c.media} sizes="(max-width: 1024px) 100vw, 26rem" settle end={!flip} low />
          </div>
          <Reveal className={`@container relative z-10 lg:col-span-8 lg:row-start-1 ${flip ? "lg:col-start-5" : "lg:col-start-1"}`}>
            <Copy texts={c.texts} voice="display" quiet={quiet} />
          </Reveal>
        </section>
      );

    // A row of pictures, each with a name or a line under it.
    case "plates":
      return (
        <section>
          <Lead texts={c.lead} wide={wide} />
          <div className="grid grid-cols-2 gap-x-4 gap-y-9 sm:grid-cols-3 sm:gap-x-6 lg:grid-cols-4">
            {c.items.map((item, i) => (
              <Reveal as="figure" key={item.media.id || i} delay={cascade(i % 4)}>
                {item.media.blockType === "video" ? (
                  <VideoBlock video={item.media.video} />
                ) : (
                  <Frame media={asMedia(item.media.image)} sizes="(max-width: 640px) 50vw, 16rem" tile />
                )}
                <figcaption className="mt-3">
                  <Copy texts={item.texts} voice="plate" />
                </figcaption>
              </Reveal>
            ))}
          </div>
        </section>
      );

    case "gallery": {
      const images = (c.media.images || []).map(asMedia).filter((m): m is Media => !!m?.url);
      // Up to three pictures share a row with their text; more than that take the full width.
      const beside = images.length <= 3 && c.texts.length > 0;
      const fewWords = lengthOf(c.texts) <= FEW_WORDS;
      const headed = c.lead.length > 0 || !!c.media.heading;
      return (
        <section className={beside ? `grid gap-x-10 gap-y-8 lg:grid-cols-12 ${fewWords ? "items-end" : "items-start"}` : "flex flex-col gap-8"}>
          {/* What introduces the gallery runs across the row, over the pictures and their text alike. */}
          {headed && (
            <div className="lg:col-span-12">
              <Copy texts={c.lead} voice="lead" wide={wide} />
              {c.media.heading && <h2 className="display text-title-lg text-ink">{c.media.heading}</h2>}
            </div>
          )}
          <div className={beside ? `lg:col-span-7 ${flip ? "lg:col-start-6" : "lg:col-start-1"} ${fewWords ? "" : "lg:sticky lg:top-28"}` : ""}>
            <div className={`tiles grid grid-cols-2 items-start gap-3 sm:gap-5 ${images.length >= 3 ? "tiles-3 sm:grid-cols-3" : ""}`}>
              {images.map((m, i) => (
                <Reveal as="figure" key={m.id || i} delay={cascade(i % 3)}>
                  <Frame media={m} sizes="(max-width: 640px) 50vw, 20rem" tile />
                </Reveal>
              ))}
            </div>
          </div>
          {c.texts.length > 0 && (
            <Reveal className={`@container ${beside ? `lg:col-span-4 ${flip ? `lg:col-start-1 ${headed ? "lg:row-start-2" : "lg:row-start-1"}` : "lg:col-start-9"}` : "max-w-[68ch]"}`}>
              <Copy texts={c.texts} voice={fewWords ? "display" : "column"} wide={wide} quiet={fewWords && quiet} />
            </Reveal>
          )}
        </section>
      );
    }
  }
}

/** A chapter whose words are set at poster size. */
const speaksLarge = (c: Chapter) => c.kind === "poster" || (c.kind === "gallery" && c.texts.length > 0 && lengthOf(c.texts) <= FEW_WORDS);

/**
 * Renders the content blocks of a page, in order (spec §7), as chapters: see
 * `chapters.ts` for how blocks are grouped. `wide` — the home page's column,
 * as wide as its other sections.
 */
export function Blocks({ blocks, wide = false }: { blocks: PageBlock[] | null | undefined; wide?: boolean }) {
  if (!blocks?.length) return null;
  let sided = 0;
  let loudBefore = false;
  let carded = false;
  return (
    <div className={`mt-10 flex flex-col gap-y-[clamp(4.5rem,8vw,7rem)] ${wide ? "shell" : "mx-auto max-w-[62rem] px-5 sm:px-8"}`}>
      {chapters(blocks).map((c, i) => {
        const twoColumn = c.kind === "spread" || c.kind === "poster" || c.kind === "gallery";
        const flip = twoColumn && sided++ % 2 === 1;
        // Large words back to back cancel each other: after a loud chapter the next one is quiet.
        const quiet = speaksLarge(c) && loudBefore;
        loudBefore = speaksLarge(c) && !quiet;
        const card = c.kind === "poster" && !quiet && !carded;
        carded ||= card;
        return <ChapterView key={i} chapter={c} flip={flip} quiet={quiet} card={card} wide={wide} />;
      })}
    </div>
  );
}
