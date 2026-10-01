import type { Page, Studio } from "@/payload-types";
import { Blocks } from "@/components/blocks/Blocks";
import { ClassesSection } from "@/components/ClassesSection";
import { Reviews } from "@/components/Reviews";
import { LocationHero } from "@/components/location/LocationHero";
import { LocationSchedule } from "@/components/location/LocationSchedule";
import { OtherLocations } from "@/components/location/OtherLocations";
import { SiteShell } from "@/components/site/SiteShell";
import { classTabs, getHome, getSiteData, studioSchedule, studioView } from "@/lib/cms/site";
import { SITE_NAME, SITE_URL } from "@/lib/cms/text";

/**
 * Studio page, from the studio document: hero, timetable of its classes,
 * address, the other studios. `page` is the studio's own page on the old site
 * (same path): its H1 and text are kept as they were, below the timetable.
 *
 * An open studio is described to Google as its own LocalBusiness. A planned
 * one is a "coming soon" page: no phone, no timetable, no structured address.
 */
export async function renderStudio(doc: Studio, page?: Page) {
  const [data, home, rows, tabs] = await Promise.all([getSiteData(), getHome(), studioSchedule(doc), classTabs(doc.id)]);
  const studio = studioView(doc, data);
  const open = studio.status === "open";
  // A studio without a booking page of its own books on this page: at its text, if it has one.
  const book = (href: string) => (href === doc.path && page?.blocks?.length ? `${doc.path}#about` : href);
  const url = `${SITE_URL}${doc.path}`;

  const jsonLd = open && {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": `${url}#studio`,
    name: `${SITE_NAME} — ${studio.name}`,
    ...(doc.seo?.description ? { description: doc.seo.description } : {}),
    url,
    ...(studio.phoneHref ? { telephone: studio.phoneHref.replace("tel:", "") } : {}),
    ...(data.email ? { email: data.email } : {}),
    ...(studio.photo ? { image: new URL(studio.photo.src, SITE_URL).href } : {}),
    address: {
      "@type": "PostalAddress",
      streetAddress: studio.street,
      ...(studio.locality ? { addressLocality: studio.locality } : {}),
      ...(studio.regionCode ? { addressRegion: studio.regionCode } : {}),
      ...(studio.postalCode ? { postalCode: studio.postalCode } : {}),
      addressCountry: "CA",
    },
    ...(studio.geo ? { geo: { "@type": "GeoCoordinates", latitude: studio.geo.lat, longitude: studio.geo.lng } } : {}),
    ...(studio.hours.length ? { openingHours: studio.hours.map((h) => `${h.days} ${h.time}`) } : {}),
    ...(studio.region ? { areaServed: studio.region } : {}),
    ...(data.instagram ? { sameAs: [data.instagram] } : {}),
  };

  return (
    <SiteShell currentLocation={doc.path} flush>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
        />
      )}
      <LocationHero
        studio={studio}
        h1={page?.h1 || studio.h1 || studio.name}
        email={data.email}
        bookHref={book(studio.bookHref)}
      />
      <LocationSchedule studio={studio} rows={rows} />
      {!!page?.blocks?.length && (
        <section id="about" className="scroll-mt-24 pb-16 md:pb-24">
          <Blocks blocks={page.blocks} />
        </section>
      )}
      <OtherLocations current={doc.path} text={home.text("other-studios")} />
      {open && <ClassesSection text={home.text("classes")} tabs={tabs.map((t) => ({ ...t, bookHref: book(t.bookHref) }))} />}
      {open && <Reviews text={home.text("reviews")} review={home.list("review")[0]} />}
    </SiteShell>
  );
}
