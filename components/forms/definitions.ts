/**
 * The enquiry forms: their questions, and the one validation both the browser
 * and the server run. Labels, placeholders and options of the contact and
 * commission forms are the ones on the old site's /contact-us and
 * /commissions-form pages, captured in content/forms-live.json;
 * tests/unit/forms-live.test.ts keeps the two in step.
 */
export type EnquiryType = "contact" | "commission" | "event" | "other";

export type FieldDef = {
  name: string;
  label: string;
  kind: "email" | "text" | "tel" | "number" | "date" | "select" | "textarea";
  required?: boolean;
  placeholder?: string;
  options?: string[];
  /** Shown only while the named field holds one of these values. */
  showWhen?: { field: string; in: string[] };
  /** Hidden while the named field holds one of these values. */
  hideWhen?: { field: string; in: string[] };
  /** The enquiry column this answer also fills (besides the answers list). */
  column?: "name" | "email" | "phone" | "message";
  /** Half-width on wide screens (pairs with the next half-width field). */
  half?: boolean;
};

export type Values = Record<string, string>;

/** The button, and the empty first choice of every select. */
export const SUBMIT = "Send";
export const SELECT_PLACEHOLDER = "Choose an option";
export type Errors = Record<string, string>;

/** Every half hour of the day, "12:00 AM" … "11:30 PM". */
const TIMES = Array.from({ length: 48 }, (_, i) => {
  const hour = Math.floor(i / 2);
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${String(h12).padStart(2, "0")}:${i % 2 ? "30" : "00"} ${hour < 12 ? "AM" : "PM"}`;
});

const email: FieldDef = {
  name: "email",
  label: "Email",
  kind: "email",
  required: true,
  placeholder: "e.g., ilove@pottery.com",
  column: "email",
};
const comments: FieldDef = {
  name: "comments",
  label: "Comments",
  kind: "textarea",
  placeholder: "Anything else to add?",
  column: "message",
};

/** Bookings that need no date and time. */
const NO_DATE = ["Studio Membership", "Wheel Rental", "General Question"];

export const FORMS: Record<EnquiryType, FieldDef[]> = {
  contact: [
    email,
    {
      name: "booking",
      label: "What would you like to book?",
      kind: "select",
      required: true,
      options: ["Group Workshop", "Date Night", "Studio Membership", "Wheel Rental", "General Question"],
    },
    {
      name: "access",
      label: "What level of studio access?",
      kind: "select",
      options: ["24/7 Access", "Midnight to Noon Access"],
      showWhen: { field: "booking", in: ["Studio Membership"] },
    },
    {
      name: "wheel",
      label: "Which type of wheel?",
      kind: "select",
      options: ["Floor model", "Table top model"],
      showWhen: { field: "booking", in: ["Wheel Rental"] },
    },
    {
      name: "groupSize",
      label: "How many in your group?",
      kind: "number",
      placeholder: "Enter a number",
      showWhen: { field: "booking", in: ["Group Workshop"] },
    },
    {
      name: "date",
      label: "Select a date",
      kind: "date",
      required: true,
      placeholder: "Select a date",
      hideWhen: { field: "booking", in: NO_DATE },
      half: true,
    },
    {
      name: "time",
      label: "Preferred Time",
      kind: "select",
      required: true,
      options: TIMES,
      hideWhen: { field: "booking", in: NO_DATE },
      half: true,
    },
    comments,
  ],
  commission: [
    email,
    {
      name: "interest",
      label: "What are you interested in?",
      kind: "select",
      required: true,
      options: ["Coffee mug", "Cremation urn", "Hanging plant pot", "Film prop work", "Hand-painted vase", "Other"],
    },
    {
      name: "dimensions",
      label: "Object Dimensions",
      kind: "text",
      required: true,
      placeholder: "Height, width and volume (inches)",
    },
    { name: "neededBy", label: "When do you need it by?", kind: "date", required: true, placeholder: "Select a date" },
    comments,
  ],
  event: generic(),
  other: generic(),
};

/** Pages that had no form of their own on the old site get the plain one. */
function generic(): FieldDef[] {
  return [
    { name: "name", label: "Name", kind: "text", required: true, column: "name" },
    { ...email, placeholder: undefined },
    { name: "phone", label: "Phone", kind: "tel", column: "phone" },
    { name: "message", label: "Message", kind: "textarea", required: true, column: "message" },
  ];
}

/**
 * Shown once the enquiry is saved. The old site's own words for its two forms;
 * a plain statement for the others — no promise about how or when the studio
 * replies.
 */
export const CONFIRMATION: Record<EnquiryType, string> = {
  contact: "Thanks for submitting!",
  commission: "Thanks for submitting! We'll be in touch soon.",
  event: "Thanks — your message has been sent.",
  other: "Thanks — your message has been sent.",
};

export const isEnquiryType = (v: unknown): v is EnquiryType =>
  typeof v === "string" && Object.prototype.hasOwnProperty.call(FORMS, v);

export function isVisible(field: FieldDef, values: Values): boolean {
  if (field.showWhen && !field.showWhen.in.includes(values[field.showWhen.field] || "")) return false;
  if (field.hideWhen && field.hideWhen.in.includes(values[field.hideWhen.field] || "")) return false;
  return true;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX = { text: 300, textarea: 5000 };

function check(field: FieldDef, value: string): string | undefined {
  if (!value) {
    if (!field.required) return undefined;
    if (field.kind === "email") return "Enter your email address.";
    if (field.kind === "select") return "Choose an option.";
    if (field.kind === "date") return "Choose a date.";
    return "This field is required.";
  }
  if (value.length > (field.kind === "textarea" ? MAX.textarea : MAX.text)) return "This is too long.";
  switch (field.kind) {
    case "email":
      return EMAIL.test(value) ? undefined : "Enter a valid email address, like name@example.com.";
    case "select":
      return field.options!.includes(value) ? undefined : "Choose one of the options.";
    case "number":
      return /^\d{1,4}$/.test(value) && Number(value) > 0 ? undefined : "Enter a number.";
    case "date":
      return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) ? undefined : "Choose a date.";
    default:
      return undefined;
  }
}

/**
 * Checks what the visitor typed against the form's questions. Returns the
 * errors by field name and the cleaned values of the questions that were shown
 * (answers to hidden questions and unknown keys are dropped).
 */
export function validate(type: EnquiryType, input: unknown): { errors: Errors; values: Values } {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const text = (v: unknown) => (typeof v === "string" || typeof v === "number" ? String(v).trim() : "");
  // visibility depends on the raw answers of the fields it refers to
  const all: Values = Object.fromEntries(FORMS[type].map((f) => [f.name, text(raw[f.name])]));
  const errors: Errors = {};
  const values: Values = {};
  for (const field of FORMS[type]) {
    if (!isVisible(field, all)) continue;
    const error = check(field, all[field.name]);
    if (error) errors[field.name] = error;
    else if (all[field.name]) values[field.name] = all[field.name];
  }
  return { errors, values };
}

/**
 * Question → answer pairs, in form order, for the questions that were answered.
 * The sender's contacts (email, name, phone) are not questions: they have
 * columns of their own on the enquiry.
 */
export function answersOf(type: EnquiryType, values: Values): { question: string; answer: string }[] {
  return FORMS[type]
    .filter((f) => values[f.name] && (!f.column || f.column === "message"))
    .map((f) => ({ question: f.label, answer: values[f.name] }));
}
