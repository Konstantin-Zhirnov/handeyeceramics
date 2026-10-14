/**
 * Selling classes and goods: the dates of a class (sessions) with their seats,
 * the orders paid through the gateway, the students who took a seat
 * (registrations), the seats held while a checkout is open (holds), the
 * subscriptions of the membership plans and the owner's email templates.
 *
 * Orders, registrations, holds and subscriptions are written by the server
 * (checkout, webhook, booking) through the Local API with `overrideAccess`;
 * the API lets nobody create an order or a hold, and nobody deletes a sale.
 */
import type { Access, CollectionConfig, Field, FieldHook, Where } from "payload";
import { availability } from "../lib/booking/availability";
import { EMAIL_TEMPLATE_KEYS, EMAIL_TEMPLATE_LABELS } from "../lib/mail/keys";
import { signedIn } from "./fields/common";
import { piecesReadyMail } from "./hooks/piecesReady";

const GROUP = "Sales";

const weekdays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

/** A number the server sets; the admin shows it and nobody edits it. */
const serverSet = { read: () => true, create: () => false, update: () => false };
/** Set once by the server when the document is created; never edited afterwards. */
const fixedAfterCreate = { update: () => false };

/** Anonymous visitors see the open and closed dates of a visible product; editors see everything. */
const publicSession: Where = { and: [{ status: { not_equals: "hidden" } }, { "product.visible": { equals: true } }] };
const readPublicSession: Access = ({ req }) => (req.user ? true : publicSession);

/** The seats of a date, computed on read; availability() itself reads the date with the flag set, so the count does not recurse. */
const countHook =
  (key: "sold" | "left"): FieldHook =>
  async ({ data, req, context }) => {
    if (!data?.id || context?.skipAvailability || req.context?.skipAvailability) return null;
    return (await availability(data.id as number, req.payload))[key];
  };
const soldHook = countHook("sold");
const leftHook = countHook("left");

export const Sessions: CollectionConfig = {
  slug: "sessions",
  labels: { singular: "Class date", plural: "Class dates" },
  access: { read: readPublicSession, create: signedIn, update: signedIn, delete: signedIn },
  admin: {
    useAsTitle: "label",
    group: GROUP,
    defaultColumns: ["label", "product", "studio", "startsAt", "seats", "sold", "left", "status"],
    description: "The dates a class runs on. Each date has its own seats; the shop sells a seat on a date.",
  },
  defaultSort: "startsAt",
  hooks: { afterChange: [piecesReadyMail] },
  fields: [
    {
      name: "label",
      type: "text",
      required: true,
      label: "Label",
      admin: { description: "As shown to the student, e.g. Thurs 4pm-6:30pm Nov 5-Dec 10" },
    },
    { name: "product", type: "relationship", relationTo: "products", required: true, label: "Product (the class in the shop)" },
    { name: "class", type: "relationship", relationTo: "classes", label: "Class on the site (optional)" },
    { name: "studio", type: "relationship", relationTo: "studios", required: true, label: "Studio" },
    {
      type: "row",
      fields: [
        { name: "startsAt", type: "date", label: "First day", admin: { date: { pickerAppearance: "dayAndTime" } } },
        { name: "endsAt", type: "date", label: "Last day", admin: { date: { pickerAppearance: "dayAndTime" } } },
      ],
    },
    {
      type: "row",
      fields: [
        { name: "weekday", type: "select", options: weekdays, label: "Weekday" },
        { name: "time", type: "text", label: "Time", admin: { description: "e.g. 4pm-6:30pm" } },
      ],
    },
    {
      type: "row",
      fields: [
        { name: "seats", type: "number", required: true, min: 0, defaultValue: 10, label: "Seats" },
        { name: "sold", type: "number", virtual: true, label: "Sold", admin: { readOnly: true }, hooks: { afterRead: [soldHook] } },
        { name: "left", type: "number", virtual: true, label: "Left", admin: { readOnly: true }, hooks: { afterRead: [leftHook] } },
      ],
    },
    {
      type: "row",
      fields: [
        { name: "price", type: "number", min: 0, label: "Price", admin: { description: "In dollars. Empty — the product's current price" } },
        { name: "salePrice", type: "number", min: 0, label: "Sale price", admin: { description: "In dollars. Empty — no discount" } },
      ],
    },
    { name: "teacher", type: "text", label: "Teacher" },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "open",
      label: "Status",
      options: [
        { label: "Open for booking", value: "open" },
        { label: "Closed (shown, not sold)", value: "closed" },
        { label: "Hidden", value: "hidden" },
      ],
      admin: { position: "sidebar" },
    },
    {
      name: "seatsUnconfirmed",
      type: "checkbox",
      defaultValue: false,
      label: "Seats not confirmed by the owner",
      admin: { position: "sidebar" },
    },
    {
      name: "piecesReady",
      type: "checkbox",
      defaultValue: false,
      label: "Pieces are ready for pickup",
      admin: { position: "sidebar", description: "Tick it to email every confirmed student of this date that their pieces are ready. Each student gets it once; the time is recorded below. If some letters failed, untick and tick again: only the students who did not get it are emailed" },
    },
    {
      name: "piecesReadySentAt",
      type: "date",
      label: "“Pieces ready” email sent",
      admin: { position: "sidebar", readOnly: true },
    },
  ],
};

/** An amount in cents, set by the server when the order is created. */
const centsField = (name: string, label: string, readOnly = false): Field => ({
  name,
  type: "number",
  label,
  access: readOnly ? serverSet : fixedAfterCreate,
  admin: { description: "In cents", readOnly },
});

/** The sale is kept as it was paid: only the status and the notes change afterwards. */
const saleAccess = {
  create: () => false,
  read: signedIn,
  update: signedIn,
  delete: () => false,
};

export const Orders: CollectionConfig = {
  slug: "orders",
  labels: { singular: "Order", plural: "Orders" },
  access: saleAccess,
  admin: {
    useAsTitle: "number",
    group: GROUP,
    defaultColumns: ["number", "createdAt", "customer", "total", "status"],
    description: "What was bought and paid. The server writes orders; here you follow them and add notes.",
  },
  defaultSort: "-createdAt",
  hooks: {
    afterChange: [
      async ({ doc, operation, req, context }) => {
        // "HE-000123" from the id, set once the row exists.
        if (operation !== "create" || doc.number || context.orderNumbered) return doc;
        const number = orderNumber(doc.id as number);
        await req.payload.update({
          collection: "orders",
          id: doc.id,
          data: { number },
          req,
          overrideAccess: true,
          context: { orderNumbered: true },
        });
        return { ...doc, number };
      },
    ],
  },
  fields: [
    { name: "number", type: "text", unique: true, index: true, label: "Order number", access: serverSet, admin: { readOnly: true } },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "pending",
      label: "Status",
      options: [
        { label: "Pending payment", value: "pending" },
        { label: "Paid", value: "paid" },
        { label: "Expired (not paid)", value: "expired" },
        { label: "Canceled", value: "canceled" },
        { label: "Refunded", value: "refunded" },
        { label: "Partially refunded", value: "partially_refunded" },
      ],
      admin: { position: "sidebar" },
    },
    { name: "note", type: "textarea", label: "Internal note", admin: { position: "sidebar" } },
    { name: "paidAt", type: "date", label: "Paid at", access: fixedAfterCreate, admin: { readOnly: true, position: "sidebar" } },
    {
      name: "customer",
      type: "group",
      label: "Customer",
      access: fixedAfterCreate,
      fields: [
        { name: "name", type: "text", label: "Name" },
        { name: "email", type: "email", label: "Email" },
        { name: "phone", type: "text", label: "Phone" },
      ],
    },
    { name: "attendee", type: "text", label: "Who is attending", access: fixedAfterCreate },
    { name: "pickupStudio", type: "relationship", relationTo: "studios", label: "Pickup studio", access: fixedAfterCreate },
    {
      name: "lines",
      type: "array",
      label: "Lines",
      labels: { singular: "Line", plural: "Lines" },
      access: fixedAfterCreate,
      admin: { readOnly: true },
      fields: [
        {
          name: "kind",
          type: "select",
          required: true,
          label: "Kind",
          options: [
            { label: "Class date", value: "session" },
            { label: "Product", value: "product" },
            { label: "Plan", value: "plan" },
          ],
        },
        { name: "session", type: "relationship", relationTo: "sessions", label: "Class date" },
        { name: "product", type: "relationship", relationTo: "products", label: "Product" },
        { name: "plan", type: "relationship", relationTo: "plans", label: "Plan" },
        { name: "label", type: "text", required: true, label: "Label" },
        { name: "option", type: "text", label: "Option" },
        { name: "quantity", type: "number", required: true, min: 1, label: "Quantity" },
        { name: "unitAmount", type: "number", required: true, label: "Unit price", admin: { description: "In cents" } },
        {
          name: "taxGroup",
          type: "select",
          label: "Tax group",
          options: [
            { label: "Goods", value: "goods" },
            { label: "Service", value: "service" },
            { label: "Exempt", value: "exempt" },
          ],
        },
        { name: "taxAmount", type: "number", label: "Tax", admin: { description: "In cents" } },
        { name: "lineTotal", type: "number", label: "Line total", admin: { description: "In cents" } },
      ],
    },
    {
      type: "row",
      fields: [
        centsField("subtotal", "Subtotal"),
        centsField("tax", "Tax"),
        centsField("total", "Total"),
        centsField("refundedAmount", "Refunded", true),
      ],
    },
    { name: "currency", type: "text", defaultValue: "cad", label: "Currency", access: fixedAfterCreate, admin: { readOnly: true } },
    {
      name: "gateway",
      type: "text",
      label: "Payment gateway",
      access: fixedAfterCreate,
      admin: { position: "sidebar", readOnly: true },
    },
    { name: "stripeSessionId", type: "text", unique: true, index: true, label: "Stripe Checkout session", access: serverSet, admin: { readOnly: true } },
    { name: "stripePaymentIntentId", type: "text", label: "Stripe payment", access: serverSet, admin: { readOnly: true } },
    { name: "stripeCustomerId", type: "text", label: "Stripe customer", access: serverSet, admin: { readOnly: true } },
    {
      name: "events",
      type: "array",
      label: "History",
      labels: { singular: "Event", plural: "Events" },
      admin: { initCollapsed: true },
      fields: [
        { name: "at", type: "date", required: true, label: "When" },
        { name: "type", type: "text", required: true, label: "Event" },
        { name: "note", type: "textarea", label: "Note" },
      ],
    },
  ],
};

export function orderNumber(id: number): string {
  return `HE-${String(id).padStart(6, "0")}`;
}

export const Registrations: CollectionConfig = {
  slug: "registrations",
  labels: { singular: "Student", plural: "Students" },
  // Paid seats are written by the server; an editor may add a student by hand (imported).
  access: { ...saleAccess, create: signedIn },
  admin: {
    useAsTitle: "name",
    group: GROUP,
    defaultColumns: ["name", "email", "session", "studio", "status", "createdAt"],
    description: "Who took a seat on which date. Filter by class date to see the list of a class.",
    listSearchableFields: ["name", "email", "phone"],
  },
  defaultSort: "-createdAt",
  fields: [
    { name: "name", type: "text", label: "Name" },
    { name: "email", type: "email", label: "Email" },
    { name: "phone", type: "text", label: "Phone" },
    { name: "session", type: "relationship", relationTo: "sessions", required: true, index: true, label: "Class date" },
    { name: "product", type: "relationship", relationTo: "products", label: "Product" },
    { name: "studio", type: "relationship", relationTo: "studios", label: "Studio" },
    { name: "order", type: "relationship", relationTo: "orders", label: "Order", admin: { position: "sidebar" } },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "confirmed",
      label: "Status",
      options: [
        { label: "Confirmed", value: "confirmed" },
        { label: "Refunded", value: "refunded" },
        { label: "Added by hand", value: "imported" },
      ],
      admin: { position: "sidebar" },
    },
    { name: "reminderSentAt", type: "date", label: "Reminder sent", admin: { position: "sidebar", readOnly: true } },
    { name: "followupSentAt", type: "date", label: "Next-course email sent", admin: { position: "sidebar", readOnly: true } },
    { name: "piecesReadySentAt", type: "date", label: "“Pieces ready” email sent", admin: { position: "sidebar", readOnly: true } },
  ],
};

export const Holds: CollectionConfig = {
  slug: "holds",
  labels: { singular: "Seat hold", plural: "Seat holds" },
  // Written only by the booking code on the server; the API shows them to editors and to nobody else.
  access: { create: () => false, read: signedIn, update: () => false, delete: () => false },
  admin: { hidden: true, group: GROUP },
  fields: [
    { name: "session", type: "relationship", relationTo: "sessions", required: true, index: true, label: "Class date" },
    { name: "quantity", type: "number", required: true, min: 1, label: "Seats held" },
    { name: "ref", type: "text", required: true, index: true, label: "Order", admin: { description: "The id of the pending order" } },
    { name: "expiresAt", type: "date", required: true, index: true, label: "Expires at" },
  ],
};

export const Subscriptions: CollectionConfig = {
  slug: "subscriptions",
  labels: { singular: "Subscription", plural: "Subscriptions" },
  access: saleAccess,
  admin: {
    useAsTitle: "stripeSubscriptionId",
    group: GROUP,
    defaultColumns: ["customer", "plan", "status", "currentPeriodEnd"],
    description: "Memberships paid monthly through Stripe. Stripe keeps them up to date; you cannot edit them here.",
  },
  defaultSort: "-createdAt",
  fields: [
    { name: "plan", type: "relationship", relationTo: "plans", label: "Plan" },
    {
      name: "customer",
      type: "group",
      label: "Customer",
      fields: [
        { name: "name", type: "text", label: "Name" },
        { name: "email", type: "email", label: "Email" },
      ],
    },
    {
      name: "status",
      type: "select",
      required: true,
      label: "Status",
      options: [
        { label: "Active", value: "active" },
        { label: "Past due", value: "past_due" },
        { label: "Canceled", value: "canceled" },
        { label: "Incomplete", value: "incomplete" },
        { label: "Trialing", value: "trialing" },
        { label: "Unpaid", value: "unpaid" },
      ],
      admin: { position: "sidebar", readOnly: true },
    },
    { name: "currentPeriodEnd", type: "date", label: "Paid until", admin: { readOnly: true } },
    { name: "stripeSubscriptionId", type: "text", unique: true, index: true, label: "Stripe subscription", admin: { readOnly: true } },
    { name: "stripeCustomerId", type: "text", label: "Stripe customer", admin: { readOnly: true } },
  ],
};

export const EmailTemplates: CollectionConfig = {
  slug: "email-templates",
  labels: { singular: "Email template", plural: "Email templates" },
  access: { create: signedIn, read: signedIn, update: signedIn, delete: signedIn },
  admin: {
    useAsTitle: "key",
    group: GROUP,
    defaultColumns: ["key", "subject", "enabled"],
    description:
      "The emails the site sends. Placeholders: {{name}}, {{order_number}}, {{items}}, {{class}}, {{dates}}, {{studio_name}}, {{studio_address}}, {{door_code}}, {{site_url}}",
  },
  fields: [
    {
      name: "key",
      type: "select",
      required: true,
      unique: true,
      label: "Email",
      options: EMAIL_TEMPLATE_KEYS.map((value) => ({ label: EMAIL_TEMPLATE_LABELS[value], value })),
    },
    { name: "subject", type: "text", required: true, label: "Subject" },
    { name: "body", type: "textarea", required: true, label: "Text", admin: { rows: 14 } },
    { name: "enabled", type: "checkbox", defaultValue: true, label: "Enabled", admin: { position: "sidebar" } },
  ],
};
