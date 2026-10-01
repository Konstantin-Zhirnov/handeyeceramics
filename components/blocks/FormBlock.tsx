import { EnquiryForm, type EnquiryType } from "@/components/forms/EnquiryForm";

/** The `form` page block. The form itself belongs to the forms module (task 06). */
export function FormBlock({ heading, formType }: { heading?: string | null; formType: EnquiryType }) {
  return (
    <section>
      {heading && <h2 className="display mb-4 text-2xl text-ink">{heading}</h2>}
      <EnquiryForm type={formType} />
    </section>
  );
}
