import { site } from "@/lib/site";

export type EnquiryType = "contact" | "commission" | "event" | "other";

/**
 * Slot for the enquiry form (task 06 builds it: fields, validation, bot trap,
 * POST to /api/enquiries). Until then it shows how to reach the studio.
 */
export function EnquiryForm({ type }: { type: EnquiryType; studio?: number | string }) {
  return (
    <div data-enquiry-form={type} className="rounded-[20px] border border-dashed border-clay-400 bg-clay-100 px-5 py-6 text-ink-soft">
      [TBD] Form coming soon. Email <a className="underline" href={`mailto:${site.email}`}>{site.email}</a> or call{" "}
      <a className="underline" href={site.phoneHref}>{site.phoneDisplay}</a>.
    </div>
  );
}
