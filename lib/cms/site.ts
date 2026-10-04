import "server-only";
import { cache } from "react";
import type { Class, Media, Studio } from "@/payload-types";
import type {
  ClassTab,
  Photo,
  ScheduleRow,
  SectionText,
  SiteData,
  StudioCard,
  StudioView,
} from "@/components/site/SiteData";
import { mediaSrc } from "./media";
import { getCMS, resolvePath } from "./resolve";

export const MEMBERSHIP_PATH = "/membership-rentals";

/** "(778) 898-3414" or "778-898-3414" → "tel:+17788983414". */
export function phoneHref(display: string | null | undefined): string {
  const digits = (display || "").replace(/\D/g, "");
  if (!digits) return "";
  return `tel:+${digits.length === 10 ? `1${digits}` : digits}`;
}

const photo = (m: unknown): Photo | null => {
  const media = m && typeof m === "object" ? (m as Media) : null;
  return media?.url ? { src: mediaSrc(media.url), alt: media.alt } : null;
};

/** The address field: street lines, then "City, BC V6A 2Z9". */
export function addressParts(address: string | null | undefined) {
  const lines = (address || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const last = lines.length > 1 ? lines[lines.length - 1] : "";
  const m = last.match(/^(.+?),\s*([A-Z]{2})(?:\s+(\S.*))?$/);
  if (!m) return { street: lines.join(", "), locality: "", regionCode: "", postalCode: "" };
  return { street: lines.slice(0, -1).join(", "), locality: m[1], regionCode: m[2], postalCode: m[3] || "" };
}

/** Published studios only: an unpublished studio is nowhere on the site. */
const publishedStudios = cache(async (): Promise<Studio[]> => {
  const payload = await getCMS();
  const res = await payload.find({
    collection: "studios",
    overrideAccess: false, // the access rule of studios: a visitor reads only published ones
    sort: "id",
    depth: 1,
    limit: 100,
    pagination: false,
  });
  return res.docs;
});

function card(doc: Studio): StudioCard {
  const a = addressParts(doc.address);
  return {
    id: doc.id,
    path: doc.path,
    name: doc.name,
    short: doc.short || doc.name,
    region: doc.region || [a.locality, a.regionCode].filter(Boolean).join(", "),
    tag: doc.tag || "",
    status: doc.status === "planned" ? "planned" : "open",
    street: a.street,
    locality: a.locality,
    note: doc.note || "",
    photo: photo(doc.photos?.[0]),
    bookHref: doc.bookingPath || doc.path,
  };
}

export const getSiteData = cache(async (): Promise<SiteData> => {
  const payload = await getCMS();
  const [settings, studios] = await Promise.all([payload.findGlobal({ slug: "settings", overrideAccess: false }), publishedStudios()]);
  const link = (l: { label: string; href: string }) => ({ label: l.label, href: l.href });
  const rated = studios.filter((s) => s.status !== "planned" && (s.google?.count || 0) > 0);
  return {
    phone: settings.phone || "",
    phoneHref: phoneHref(settings.phone),
    email: settings.email || "",
    instagram: settings.instagram || "",
    nav: (settings.nav || []).map(link),
    footerText: settings.footer?.text || "",
    footerLinks: (settings.footer?.links || []).map(link),
    studios: studios.map(card),
    googleReviews: { count: rated.reduce((n, s) => n + (s.google?.count || 0), 0), profiles: rated.length },
  };
});

/** Everything the studio template shows. A planned studio has no phone: it is a "coming soon" page. */
export function studioView(doc: Studio, site: SiteData): StudioView {
  const a = addressParts(doc.address);
  const planned = doc.status === "planned";
  const intro: string[] = [];
  const notes: StudioView["notes"] = [];
  for (const line of (doc.description || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean)) {
    const m = line.match(/^([A-Z][^:.]{1,40}):\s+(\S.*)$/);
    if (m) notes.push({ label: m[1], text: m[2] });
    else intro.push(line);
  }
  const phone = planned ? "" : doc.phone || site.phone;
  const g = doc.google;
  return {
    ...card(doc),
    h1: doc.h1 || "",
    intro: intro.join("\n"),
    notes,
    access: doc.access || "",
    highlights: (doc.highlights || []).map((h) => h.text),
    hours: (doc.hours || []).map((h) => ({ days: h.days, time: h.time })),
    google: g?.url && typeof g.rating === "number" && typeof g.count === "number" ? { rating: g.rating, count: g.count, url: g.url } : null,
    regionCode: a.regionCode,
    postalCode: a.postalCode,
    phone,
    phoneHref: phoneHref(phone),
    geo: typeof doc.geo?.lat === "number" && typeof doc.geo?.lng === "number" ? { lat: doc.geo.lat, lng: doc.geo.lng } : null,
  };
}

/** Open studios with their address and phone, as the contact page lists them; planned ones are left out. */
export async function openStudios(): Promise<StudioView[]> {
  const [studios, site] = await Promise.all([publishedStudios(), getSiteData()]);
  return studios.filter((s) => s.status !== "planned").map((s) => studioView(s, site));
}

const studioIds = (c: Class): number[] => (c.studio || []).map((s) => (typeof s === "object" ? s.id : s));

/**
 * Classes the site may show: a class tied to studios is shown only while at
 * least one of them is published (the access rule of classes).
 */
const visibleClasses = cache(async (): Promise<Class[]> => {
  const payload = await getCMS();
  // the access rule of classes: a visitor does not get a class whose every studio is unpublished
  const res = await payload.find({ collection: "classes", overrideAccess: false, sort: "id", depth: 1, limit: 500, pagination: false });
  return res.docs;
});

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** The timetable of one studio: its classes that have sessions or a price. Nothing for a planned studio. */
export async function studioSchedule(doc: Studio): Promise<ScheduleRow[]> {
  if (doc.status === "planned") return [];
  const suffixes = [doc.short, doc.name].filter(Boolean).map((s) => ` — ${s}`);
  return (await visibleClasses())
    .filter((c) => (c.sessions?.length || c.price) && studioIds(c).includes(doc.id))
    .map((c) => {
      const suffix = suffixes.find((s) => c.title.endsWith(s));
      return {
        label: suffix ? c.title.slice(0, -suffix.length) : c.title,
        price: c.price || "",
        times: (c.sessions || [])
          .map((s) => [s.weekday ? capital(s.weekday) : "", s.date ? s.date.slice(0, 10) : "", s.time].filter(Boolean).join(" "))
          .join(" · "),
      };
    });
}

/** Classes shown as tabs: those with a tab name; of one studio, or of every published studio. */
export async function classTabs(studioId?: number): Promise<ClassTab[]> {
  const studios = await publishedStudios();
  /** "Book" leads to the page of the studio in view, else of the first studio the class runs at. */
  const bookHref = (c: Class) => {
    const ids = studioId === undefined ? studioIds(c) : [studioId];
    const studio = studios.find((s) => ids.includes(s.id));
    return studio ? studio.bookingPath || studio.path : "/#locations";
  };
  return (await visibleClasses())
    .filter((c) => c.tab && (studioId === undefined || studioIds(c).includes(studioId)))
    .map((c) => {
      const lines = (c.description || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      return {
        id: String(c.id),
        label: c.tab!,
        title: c.title,
        badge: [c.price, c.duration].filter(Boolean).join(" · "),
        body: lines.filter((l) => !l.startsWith("•")).join(" "),
        points: lines.filter((l) => l.startsWith("•")).map((l) => l.replace(/^•\s*/, "")),
        photo: photo(c.photos?.[0]),
        bookHref: bookHref(c),
      };
    });
}

type SectionRow = { key: string; eyebrow?: string | null; heading?: string | null; body?: string | null };
const sectionText = (s?: SectionRow): SectionText => ({ eyebrow: s?.eyebrow || "", heading: s?.heading || "", body: s?.body || "" });

/** The home global: hero, SEO, gallery photos and section texts by key. */
export const getHome = cache(async () => {
  const payload = await getCMS();
  const home = await payload.findGlobal({ slug: "home", depth: 1, overrideAccess: false });
  const rows: SectionRow[] = home.sections || [];
  return {
    hero: {
      eyebrow: home.hero?.eyebrow || "",
      title: home.hero?.title || "",
      subtitle: home.hero?.subtitle || "",
      cta: { label: home.hero?.primaryCta?.label || "", href: home.hero?.primaryCta?.href || "" },
    },
    seo: { title: home.seo?.title || "", description: home.seo?.description || "" },
    gallery: (home.gallery || []).map(photo).filter((p): p is Photo => Boolean(p)),
    /** One section's texts, e.g. `classes`. */
    text: (key: string) => sectionText(rows.find((s) => s.key === key)),
    /** A numbered series, e.g. `feature` → feature-1, feature-2… in admin order. */
    list: (prefix: string) => rows.filter((s) => s.key.startsWith(`${prefix}-`)).map(sectionText),
  };
});

/**
 * Every address the site answers with a page: published pages and studios,
 * visible products. An address that redirects elsewhere is not listed.
 */
export async function sitePaths(): Promise<string[]> {
  const payload = await getCMS();
  const all = { depth: 0, limit: 2000, pagination: false, select: { path: true } } as const;
  const [pages, studios, products, redirects] = await Promise.all([
    payload.find({ collection: "pages", sort: "path", overrideAccess: false, ...all }),
    payload.find({ collection: "studios", sort: "id", overrideAccess: false, ...all }),
    payload.find({ collection: "products", sort: "path", overrideAccess: false, ...all }),
    payload.find({ collection: "redirects", depth: 0, limit: 2000, pagination: false, overrideAccess: false, select: { from: true } }),
  ]);
  const moved = new Set(redirects.docs.map((r) => r.from));
  const paths = ["/", ...studios.docs.map((d) => d.path), ...pages.docs.map((d) => d.path), ...products.docs.map((d) => d.path)];
  return [...new Set(paths)].filter((p) => p && !moved.has(p));
}

/** The home page's own document of the old site (path "/"): its H1, SEO and text blocks. */
export async function homePage() {
  const r = await resolvePath("/");
  return r && "doc" in r && r.kind !== "studio" && r.kind !== "product" ? r.doc : null;
}
