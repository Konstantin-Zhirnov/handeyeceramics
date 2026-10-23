/**
 * The emails the site sends, named once: the select of the email-templates
 * collection, the seed and the TemplateKey type all derive from this list.
 * No Payload import here, so the admin bundle can read it too.
 */
export const EMAIL_TEMPLATE_KEYS = ["order-confirmation", "class-reminder", "pieces-ready", "next-course", "gift-card"] as const;

export type TemplateKey = (typeof EMAIL_TEMPLATE_KEYS)[number];

/** What the editor sees in the admin for each key. */
export const EMAIL_TEMPLATE_LABELS: Record<TemplateKey, string> = {
  "order-confirmation": "Order confirmation",
  "class-reminder": "Class reminder (two days before)",
  "pieces-ready": "Pieces are ready",
  "next-course": "Next course invitation",
  "gift-card": "Gift card codes",
};
