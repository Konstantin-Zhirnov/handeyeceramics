import type { Class, Studio } from "@/payload-types";
import { getCMS } from "@/lib/cms/resolve";

/** `classList` block: classes of one studio, or of all studios — read as the visitor, so a hidden studio's classes stay hidden. */
export async function ClassListBlock({ heading, studio }: { heading?: string | null; studio?: number | Studio | null }) {
  const payload = await getCMS();
  const studioId = studio && typeof studio === "object" ? studio.id : studio;
  const { docs } = await payload.find({
    collection: "classes",
    overrideAccess: false,
    where: studioId ? { studio: { in: [studioId] } } : {},
    limit: 100,
    depth: 0,
    pagination: false,
  });
  if (!docs.length) return null;
  return (
    <section>
      {heading && <h2 className="display mb-4 text-2xl text-ink">{heading}</h2>}
      <ul className="flex flex-col gap-4">
        {(docs as Class[]).map((c) => (
          <li key={c.id} className="rounded-[20px] border border-clay-200 bg-clay-100 px-5 py-4">
            <h3 className="text-lg text-ink">{c.title}</h3>
            {c.price && <p className="text-ink-soft">{c.price}</p>}
            {c.description && <p className="mt-2 whitespace-pre-line text-ink-soft">{c.description}</p>}
            {!!c.sessions?.length && (
              <ul className="mt-2 text-sm text-ink-soft">
                {c.sessions.map((s, i) => (
                  <li key={s.id || i}>{[s.weekday, s.date?.slice(0, 10), s.time].filter(Boolean).join(" · ")}</li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
