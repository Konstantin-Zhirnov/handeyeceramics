"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * What the header, the footer and the studio switcher need on every page:
 * contacts and navigation from the site settings and the published studios.
 * Read once on the server (lib/cms/site.ts) and handed down through context,
 * so the client components carry no content of their own.
 */
export type NavLink = { label: string; href: string };
export type Photo = { src: string; alt: string };
/** One row of the home global's `sections`. */
export type SectionText = { eyebrow: string; heading: string; body: string };

export type StudioCard = {
  id: number;
  /** The studio's address on the site; also its identity in the switcher. */
  path: string;
  name: string;
  short: string;
  region: string;
  tag: string;
  status: "open" | "planned";
  street: string;
  locality: string;
  note: string;
  photo: Photo | null;
  /** Where this studio's "Book" buttons lead: its booking page, else its own page. */
  bookHref: string;
};

export type StudioView = StudioCard & {
  h1: string;
  intro: string;
  /** "Label: text" lines of the description — membership, access hours, opening. */
  notes: { label: string; text: string }[];
  access: string;
  highlights: string[];
  hours: { days: string; time: string }[];
  google: { rating: number; count: number; url: string } | null;
  regionCode: string;
  postalCode: string;
  /** Its own phone, else the business phone; empty for a studio that is not open yet. */
  phone: string;
  phoneHref: string;
  geo: { lat: number; lng: number } | null;
};

export type ScheduleRow = { label: string; times: string };

export type ClassTab = {
  id: string;
  label: string;
  title: string;
  badge: string;
  body: string;
  points: string[];
  photo: Photo | null;
  /** The booking page of the studio the class runs at. */
  bookHref: string;
};

export type SiteData = {
  phone: string;
  phoneHref: string;
  email: string;
  instagram: string;
  nav: NavLink[];
  footerText: string;
  footerLinks: NavLink[];
  studios: StudioCard[];
  googleReviews: { count: number; profiles: number };
};

const SiteDataContext = createContext<SiteData | null>(null);

export function SiteDataProvider({ value, children }: { value: SiteData; children: ReactNode }) {
  return <SiteDataContext.Provider value={value}>{children}</SiteDataContext.Provider>;
}

export function useSiteData(): SiteData {
  const value = useContext(SiteDataContext);
  if (!value) throw new Error("useSiteData: wrap the page in <SiteShell> (or <SiteDataProvider>)");
  return value;
}

/** A heading from the CMS: `*…*` marks the italic part. */
export function Emph({ text }: { text: string }) {
  return (
    <>
      {text.split("*").map((part, i) =>
        i % 2 ? (
          <em key={i} className="italic">
            {part}
          </em>
        ) : (
          part
        ),
      )}
    </>
  );
}
