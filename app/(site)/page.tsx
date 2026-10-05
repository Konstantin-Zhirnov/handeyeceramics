import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { HeroStage } from "@/components/HeroStage";
import { FeatureStrip } from "@/components/FeatureStrip";
import { ClassesSection } from "@/components/ClassesSection";
import { Gallery } from "@/components/Gallery";
import { Reviews } from "@/components/Reviews";
import { LocationsSection } from "@/components/LocationsSection";
import { Membership } from "@/components/Membership";
import { Footer, MobileCallBar } from "@/components/Footer";
import { SiteDataProvider } from "@/components/site/SiteData";
import { Blocks } from "@/components/blocks/Blocks";
import { metadataFor } from "@/lib/cms/seo";
import { MEMBERSHIP_PATH, classTabs, getHome, getSiteData, homePage } from "@/lib/cms/site";
import { SITE_NAME, SITE_URL } from "@/lib/cms/text";

/** Rendered on every request: an edit in the admin shows up on the next load. */
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  // The title and description of the old site's home page; the home global's SEO fields override them.
  const [{ seo }, page] = await Promise.all([getHome(), homePage()]);
  const meta = page ? await metadataFor({ kind: "page", doc: page }) : {};
  return {
    ...meta,
    ...(seo.title ? { title: seo.title } : {}),
    ...(seo.description ? { description: seo.description } : {}),
    alternates: { canonical: SITE_URL },
  };
}

/**
 * The prototype's home page; every text, class, studio and contact comes from
 * the CMS. The page's H1 is the old site's (the `pages` document with path
 * "/") and stands in the hero, on the first screen. The text of the old home
 * page is a section of its own below the prototype's sections: it is long, and
 * above them it would push the classes and the studios out of reach.
 */
export default async function Home() {
  const [data, home, tabs, page] = await Promise.all([getSiteData(), getHome(), classTabs(), homePage()]);
  return (
    <SiteDataProvider value={data}>
      <Header />
      <main id="main">
        <HeroStage hero={home.hero} chapters={home.list("stage")} h1={page ? page.h1 || page.title : undefined} />
        <FeatureStrip items={home.list("feature")} />
        <ClassesSection text={home.text("classes")} tabs={tabs} />
        <Gallery text={home.text("gallery")} photos={home.gallery} />
        <Reviews text={home.text("reviews")} review={home.list("review")[0]} />
        <LocationsSection text={home.text("locations")} />
        <Membership text={home.text("membership")} perks={home.list("perk")} href={MEMBERSHIP_PATH} />
        {page && (
          <section id="about" className="scroll-mt-24 bg-clay-50 py-16 md:py-24">
            <Blocks blocks={page.blocks} />
          </section>
        )}
      </main>
      <Footer />
      <MobileCallBar hideDuringHero />
    </SiteDataProvider>
  );
}
