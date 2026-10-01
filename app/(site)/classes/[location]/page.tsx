import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Header } from "@/components/Header";
import { Footer, MobileCallBar } from "@/components/Footer";
import { LocationHero } from "@/components/location/LocationHero";
import { LocationSchedule } from "@/components/location/LocationSchedule";
import { OtherLocations } from "@/components/location/OtherLocations";
import { ClassesSection } from "@/components/ClassesSection";
import { Reviews } from "@/components/Reviews";
import { findLocation, locations, site } from "@/lib/site";

type Props = { params: Promise<{ location: string }> };

/** One static page per studio, built at compile time. */
export function generateStaticParams() {
  return locations.map((l) => ({ location: l.slug }));
}

/** Each studio owns its own title, description and canonical URL. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { location } = await params;
  const loc = findLocation(location);
  if (!loc) return {};

  return {
    title: loc.metaTitle,
    description: loc.metaDescription,
    alternates: { canonical: `${site.url}/classes/${loc.slug}` },
    openGraph: {
      title: loc.metaTitle,
      description: loc.metaDescription,
      url: `${site.url}/classes/${loc.slug}`,
      images: [loc.image],
      type: "website",
    },
  };
}

export default async function LocationPage({ params }: Props) {
  const { location } = await params;
  const loc = findLocation(location);
  if (!loc) notFound();

  // LocalBusiness structured data, one entity per studio. This is what lets
  // Google treat Nanaimo and Chinatown as separate places rather than one
  // business with a confusing address.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": `${site.url}/classes/${loc.slug}#studio`,
    name: `${site.name} — ${loc.name}`,
    description: loc.metaDescription,
    url: `${site.url}/classes/${loc.slug}`,
    telephone: site.phoneHref.replace("tel:", ""),
    email: site.email,
    image: `${site.url}${loc.image}`,
    priceRange: "$$",
    address: {
      "@type": "PostalAddress",
      streetAddress: loc.street,
      addressLocality: loc.locality,
      addressRegion: loc.regionCode,
      ...(loc.postalCode ? { postalCode: loc.postalCode } : {}),
      addressCountry: loc.country,
    },
    areaServed: loc.region,
    sameAs: [site.instagram],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Header currentLocation={loc.slug} />
      <main>
        <LocationHero location={loc} />
        <LocationSchedule location={loc} />
        <OtherLocations current={loc.slug} />
        {loc.status === "open" && (
          <>
            <ClassesSection />
            <Reviews />
          </>
        )}
      </main>
      <Footer />
      <MobileCallBar />
    </>
  );
}
