import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { resolvePath } from "@/lib/cms/resolve";
import { metadataFor } from "@/lib/cms/seo";
import { renderPage } from "./renderPage";
import { renderPlans } from "./renderPlans";
import { renderProduct } from "./renderProduct";
import { renderShop } from "./renderShop";
import { renderStudio } from "./renderStudio";

/**
 * One route for every CMS address (spec §8): resolves the path and hands the
 * document to the renderer of its kind. Dispatch only — templates live in the
 * render* modules. 301s are answered earlier by proxy.ts; the redirect here is
 * a fallback for rules added in the last few seconds.
 */
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ path: string[] }> };

/** The decoded path; a segment that does not decode stays as it came (and resolves to nothing — a 404). */
const decode = (s: string) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};
const toPath = async (params: Props["params"]) => "/" + (await params).path.map(decode).join("/");

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const r = await resolvePath(await toPath(params));
  return r && !("redirect" in r) ? metadataFor(r) : {};
}

export default async function CatchAll({ params }: Props) {
  const r = await resolvePath(await toPath(params));
  if (!r) notFound();
  if ("redirect" in r) permanentRedirect(r.redirect);
  switch (r.kind) {
    case "studio":
      return renderStudio(r.doc, r.page);
    case "product":
      return renderProduct(r.doc);
    case "shop":
      return renderShop(r.doc);
    case "plans":
      return renderPlans(r.doc);
    default:
      return renderPage(r.doc);
  }
}
