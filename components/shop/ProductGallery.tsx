"use client";

import Image from "next/image";
import { useState } from "react";

export type GalleryPhoto = { id: number | string; url: string; alt: string; width?: number | null; height?: number | null };

/** The photos of a product: one large, and a row of thumbnails that put their photo in the large place. */
export function ProductGallery({ photos }: { photos: GalleryPhoto[] }) {
  const [shown, setShown] = useState(0);
  const big = photos[shown];
  if (!big) return <div aria-hidden className="aspect-square w-full rounded-card bg-clay-100" />;
  return (
    <div data-gallery>
      <Image
        key={big.id}
        src={big.url}
        alt={big.alt}
        width={big.width || 1200}
        height={big.height || 1200}
        sizes="(max-width: 768px) 100vw, 30rem"
        priority={shown === 0}
        className="h-auto max-h-[70svh] w-full md:max-h-[calc(100svh-18rem)] rounded-card bg-clay-100 object-contain"
      />
      {photos.length > 1 && (
        <ul className="mt-3 grid grid-cols-4 gap-3">
          {photos.map((m, i) => (
            <li key={m.id}>
              <button
                type="button"
                aria-label={`Show photo ${i + 1} of ${photos.length}`}
                aria-pressed={i === shown}
                onClick={() => setShown(i)}
                className={`block w-full overflow-hidden rounded-inset ring-offset-2 ring-offset-clay-50 transition-opacity ${
                  i === shown ? "ring-2 ring-terracotta" : "opacity-70 hover:opacity-100"
                }`}
              >
                <Image
                  src={m.url}
                  alt=""
                  width={320}
                  height={320}
                  sizes="(max-width: 768px) 25vw, 8rem"
                  className="aspect-square w-full bg-clay-100 object-cover"
                />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
