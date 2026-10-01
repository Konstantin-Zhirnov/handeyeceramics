import type { ReactNode } from "react";
import { Header } from "@/components/Header";
import { Footer, MobileCallBar } from "@/components/Footer";
import { getSiteData } from "@/lib/cms/site";
import { SiteDataProvider } from "./SiteData";

/**
 * The prototype's header and footer around any CMS page, fed from the site
 * settings and the published studios. `currentLocation` is the path of the
 * studio the page belongs to; `flush` drops the content padding for templates
 * that bring their own hero.
 */
export async function SiteShell({
  children,
  currentLocation,
  flush = false,
}: {
  children: ReactNode;
  currentLocation?: string;
  flush?: boolean;
}) {
  const data = await getSiteData();
  return (
    <SiteDataProvider value={data}>
      <Header currentLocation={currentLocation} />
      <main className={flush ? undefined : "bg-clay-50 pb-20 pt-[104px] lg:pt-[128px]"}>{children}</main>
      <Footer />
      <MobileCallBar />
    </SiteDataProvider>
  );
}

/** Title band shared by the content templates: the page's one H1. */
export function PageHeading({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: ReactNode }) {
  return (
    <header className="mx-auto max-w-[62rem] px-5 sm:px-8">
      {eyebrow && <p className="eyebrow text-clay-600">{eyebrow}</p>}
      <h1 className="display mt-3 text-[2rem] leading-[1.08] text-ink sm:text-[3rem] [overflow-wrap:anywhere]">{title}</h1>
      {children}
    </header>
  );
}
