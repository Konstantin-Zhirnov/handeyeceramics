import type { ReactNode } from "react";
import { Header } from "@/components/Header";
import { Footer, MobileCallBar } from "@/components/Footer";

/** The prototype's header and footer around any CMS page. */
export function SiteShell({ children, currentLocation }: { children: ReactNode; currentLocation?: string }) {
  return (
    <>
      <Header currentLocation={currentLocation} />
      <main className="bg-clay-50 pb-20 pt-[104px] lg:pt-[128px]">{children}</main>
      <Footer />
      <MobileCallBar />
    </>
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
