import { getCMS } from "@/lib/cms/resolve";
import { site } from "@/lib/site";
import { EnquiryFormFields } from "./EnquiryFormFields";
import type { EnquiryType } from "./definitions";

export type { EnquiryType };

/**
 * The enquiry form of a page. `type` picks the questions (see `definitions.ts`);
 * the submission goes to POST /forms/enquiry and lands in the admin under
 * «Заявки». The phone and email shown when sending fails come from the site
 * settings.
 */
export async function EnquiryForm({ type, studio }: { type: EnquiryType; studio?: number | string }) {
  let phone: string = site.phoneDisplay;
  let email: string = site.email;
  try {
    const settings = await (await getCMS()).findGlobal({ slug: "settings", depth: 0 });
    phone = settings.phone || phone;
    email = settings.email || email;
  } catch {
    /* settings unavailable: the contacts from the code stand in */
  }
  return <EnquiryFormFields type={type} studio={studio} phone={phone} email={email} />;
}
