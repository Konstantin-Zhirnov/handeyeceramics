/**
 * The emails the site sends, as the seed writes them into the
 * email-templates collection. The owner edits them in the admin; the seed
 * only fills in what is missing or resets a template to this text.
 * Placeholders are replaced by lib/mail: {{name}}, {{order_number}}, {{items}},
 * {{class}}, {{dates}}, {{studio_name}}, {{studio_address}}, {{door_code}}, {{site_url}},
 * {{teachers_url}}, {{teachers_password}}; in the gift card email {{gift_codes}} and {{gift_total}}.
 */
import type { TemplateKey } from "../../lib/mail/keys";

export type EmailTemplateSeed = { key: TemplateKey; subject: string; body: string };

export const EMAIL_TEMPLATES: EmailTemplateSeed[] = [
  {
    key: "order-confirmation",
    subject: "Your Hand Eye Ceramics order {{order_number}}",
    body: [
      "Hi {{name}},",
      "",
      "Thank you for your order {{order_number}}. Here is what you bought:",
      "",
      "{{items}}",
      "",
      "Class: {{class}}",
      "Dates: {{dates}}",
      "Studio: {{studio_name}}, {{studio_address}}",
      "Door code: {{door_code}}",
      "Your teachers' phone numbers: {{teachers_url}} (password: {{teachers_password}})",
      "",
      "Pieces and clay are picked up at the same studio. If anything looks wrong, reply to this email and we will sort it out.",
      "",
      "See you at the wheel,",
      "Hand Eye Ceramics",
      "{{site_url}}",
    ].join("\n"),
  },
  {
    key: "class-reminder",
    subject: "Your class {{class}} starts in two days",
    body: [
      "Hi {{name}},",
      "",
      "A quick reminder: {{class}} ({{dates}}) starts in two days at {{studio_name}}, {{studio_address}}.",
      "",
      "The door code is {{door_code}}.",
      "",
      "Before you come: [TBD]",
      "",
      "See you soon,",
      "Hand Eye Ceramics",
      "{{site_url}}",
    ].join("\n"),
  },
  {
    key: "pieces-ready",
    subject: "Your pieces from {{class}} are ready",
    body: [
      "Hi {{name}},",
      "",
      "The pieces you made in {{class}} ({{dates}}) are glazed, fired and ready for pickup at {{studio_name}}, {{studio_address}}.",
      "",
      "Pickup hours: [TBD]. Pieces are kept for [TBD] after the course ends.",
      "",
      "Hand Eye Ceramics",
      "{{site_url}}",
    ].join("\n"),
  },
  {
    key: "next-course",
    subject: "Ready for the next step after {{class}}?",
    body: [
      "Hi {{name}},",
      "",
      "We hope you enjoyed {{class}} at {{studio_name}}. The next courses are open for booking, and seats go quickly.",
      "",
      "Book your next course here: {{site_url}}",
      "",
      "Hand Eye Ceramics",
    ].join("\n"),
  },
  {
    key: "gift-card",
    subject: "Your Hand Eye Ceramics gift card",
    body: [
      "Hi {{name}},",
      "",
      "Thank you for your order {{order_number}}. Here is your gift card:",
      "",
      "{{gift_codes}}",
      "",
      "To use it, enter the code in the cart at {{site_url}} before paying. It can be spent on classes, drop-ins, clay and tools, in one go or over several orders, and it does not expire.",
      "",
      "Giving it to someone? Forward this email, or copy the code into your own card.",
      "",
      "Hand Eye Ceramics",
      "{{site_url}}",
    ].join("\n"),
  },
];
