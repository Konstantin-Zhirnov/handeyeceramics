import Image from "next/image";
import Link from "next/link";
import { RichText } from "@payloadcms/richtext-lexical/react";
import type { Media, Page, Video } from "@/payload-types";
import { mediaSrc } from "@/lib/cms/media";
import { FormBlock } from "./FormBlock";
import { MuxVideo } from "./MuxVideo";
import { ClassListBlock } from "./ClassListBlock";
import { PlanListBlock } from "./PlanListBlock";
import { ProductListBlock } from "./ProductListBlock";

export type PageBlock = NonNullable<Page["blocks"]>[number];

const asMedia = (m: unknown) => (m && typeof m === "object" ? (m as Media) : null);

function Picture({ media, sizes = "(max-width: 768px) 100vw, 62rem" }: { media: Media | null; sizes?: string }) {
  if (!media?.url) return null;
  return (
    <Image
      src={mediaSrc(media.url)}
      alt={media.alt}
      width={media.width || 1600}
      height={media.height || 1200}
      sizes={sizes}
      className="h-auto w-full rounded-card object-cover"
    />
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
        <Picture media={poster} />
      ) : (
        <div className="grid aspect-video place-items-center rounded-card bg-clay-100 text-ink-soft">{v?.title || "Video"}</div>
      )}
      {caption && <figcaption className="mt-2 text-sm text-ink-soft">{caption}</figcaption>}
    </figure>
  );
}

/** Renders the content blocks of a page, in order (spec §7). */
export function Blocks({ blocks }: { blocks: PageBlock[] | null | undefined }) {
  if (!blocks?.length) return null;
  return (
    <div className="mx-auto mt-10 flex max-w-[62rem] flex-col gap-10 px-5 sm:px-8">
      {blocks.map((b, i) => {
        switch (b.blockType) {
          case "text":
            return (
              <section key={b.id || i} className="max-w-[68ch] text-lede leading-relaxed text-ink-soft [overflow-wrap:anywhere] [&_a]:py-1.5 [&_a]:text-sky-deep [&_a]:underline [&_a]:underline-offset-2 [&_h2]:display [&_h2]:mt-8 [&_h2]:text-title [&_h2]:text-ink [&_h3]:mt-6 [&_h3]:text-xl [&_h3]:text-ink [&_h4]:mt-4 [&_h4]:text-ink [&_li]:ml-5 [&_li]:list-disc [&_p]:mt-3 [&_ul]:mt-3">
                {b.heading && <h2>{b.heading}</h2>}
                {b.body && <RichText data={b.body} />}
              </section>
            );
          case "image":
            return (
              <figure key={b.id || i}>
                <Picture media={asMedia(b.image)} />
                {b.caption && <figcaption className="mt-2 text-sm text-ink-soft">{b.caption}</figcaption>}
              </figure>
            );
          case "gallery":
            return (
              <section key={b.id || i}>
                {b.heading && <h2 className="display mb-4 text-2xl text-ink">{b.heading}</h2>}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {(b.images || []).map((m, j) => (
                    <Picture key={j} media={asMedia(m)} sizes="(max-width: 768px) 50vw, 20rem" />
                  ))}
                </div>
              </section>
            );
          case "video":
            return <VideoBlock key={b.id || i} video={b.video} caption={b.caption} />;
          case "cta":
            return (
              <section key={b.id || i} className="rounded-panel border border-clay-200 bg-clay-100 px-6 py-8">
                <h2 className="display text-2xl text-ink">{b.heading}</h2>
                {b.body && <p className="mt-3 text-ink-soft">{b.body}</p>}
                <Link href={b.buttonHref} className="mt-5 inline-flex rounded-full bg-ink px-6 py-3 text-clay-50">
                  {b.buttonLabel}
                </Link>
              </section>
            );
          case "form":
            return <FormBlock key={b.id || i} heading={b.heading} formType={b.formType} />;
          case "classList":
            return <ClassListBlock key={b.id || i} heading={b.heading} studio={b.studio} />;
          case "productList":
            return <ProductListBlock key={b.id || i} heading={b.heading} category={b.category} all={b.all} />;
          case "planList":
            return <PlanListBlock key={b.id || i} heading={b.heading} group={b.group} />;
          default:
            return null;
        }
      })}
    </div>
  );
}
