/**
 * Invoices for private groups, corporate events, families and couples — what
 * the owner made in the Wix Invoices app. One link per invoice: the client
 * opens /invoice/<token>, sees the latest version, prints it, and pays the
 * balance by card through Checkout; an e-transfer is marked paid here by hand.
 * Editing the invoice after it was sent keeps the same link, so the client
 * never has to guess which of several invoices is the right one.
 */
import { randomBytes } from "node:crypto";
import type { CollectionBeforeChangeHook, CollectionConfig } from "payload";
import type { Studio } from "../payload-types";
import { formatPrice } from "../lib/cms/text";
import { relId } from "../lib/cms/relations";
import { INVOICE_DEFAULT_PROVINCE, INVOICE_STATUS_LABELS, invoiceNumber, invoiceTotals, type InvoiceStatus } from "../lib/invoices/totals";
import { studioProvince } from "../lib/payments/checkout";
import { signedIn } from "./fields/common";

const STATUSES = Object.entries(INVOICE_STATUS_LABELS).map(([value, label]) => ({ value, label }));

/** The token of the client's link, set once; the sums and the status, from the lines and the payments, on every save. */
const computeTotals: CollectionBeforeChangeHook = async ({ data, originalDoc, operation, req }) => {
  const doc = { ...(originalDoc || {}), ...data };
  if (operation === "create" || !doc.token) data.token = randomBytes(18).toString("base64url");
  const studioId = relId(doc.studio);
  const studio = studioId
    ? ((await req.payload.findByID({ collection: "studios", id: studioId, depth: 0, overrideAccess: true, req, disableErrors: true })) as Studio | null)
    : null;
  const t = invoiceTotals(doc.lines, studioProvince(studio) || INVOICE_DEFAULT_PROVINCE, doc.payments, Boolean(doc.voided));
  Object.assign(data, { subtotal: t.subtotal, tax: t.tax, total: t.total, paid: t.paid, due: t.due, status: t.status });
  const wasPaid = (originalDoc?.status as InvoiceStatus | undefined) === "paid";
  if (t.status === "paid" && !wasPaid) data.paidAt = new Date().toISOString();
  if (t.status !== "paid") data.paidAt = null;
  return data;
};

/** A sum in cents the hook sets; hidden — the admin shows the sums in the client-link block. */
const sum = (name: string, label: string) => ({ name, type: "number" as const, label, admin: { hidden: true, description: "In cents" } });

export const Invoices: CollectionConfig = {
  slug: "invoices",
  labels: { singular: "Invoice", plural: "Invoices" },
  // Nobody deletes an invoice that was sent: it is voided instead, and keeps its number.
  access: { create: signedIn, read: signedIn, update: signedIn, delete: () => false },
  admin: {
    useAsTitle: "number",
    group: "Sales",
    // Total and status next to the number: on a phone the first columns are the ones on screen.
    defaultColumns: ["number", "totalDisplay", "status", "customer.name", "createdAt"],
    listSearchableFields: ["number", "customer.name", "customer.company", "customer.email"],
    description:
      "Invoices for groups, corporate events and families. Save, then copy the client link: it always shows the latest version, the client pays it by card, and you mark an e-transfer as a payment below.",
  },
  defaultSort: "-createdAt",
  hooks: {
    beforeChange: [computeTotals],
    afterChange: [
      async ({ doc, operation, req, context }) => {
        if (operation !== "create" || doc.number || context.invoiceNumbered) return doc;
        const number = invoiceNumber(doc.id as number);
        await req.payload.update({ collection: "invoices", id: doc.id, data: { number }, req, overrideAccess: true, context: { invoiceNumbered: true } });
        return { ...doc, number };
      },
    ],
  },
  fields: [
    // First on the page: the link to send and what is still owed (the owner works from a phone).
    { name: "clientLink", type: "ui", label: "Client link", admin: { components: { Field: "/components/admin/InvoiceLink#InvoiceLink" } } },
    { name: "number", type: "text", unique: true, index: true, label: "Invoice number", admin: { readOnly: true, position: "sidebar" } },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "open",
      label: "Status",
      options: STATUSES,
      admin: { readOnly: true, position: "sidebar", description: "Set from the payments below" },
    },
    { name: "paidAt", type: "date", label: "Paid in full on", admin: { readOnly: true, position: "sidebar" } },
    {
      name: "voided",
      type: "checkbox",
      defaultValue: false,
      label: "Void this invoice",
      admin: { position: "sidebar", description: "The link then shows the invoice as void and it cannot be paid" },
    },
    {
      name: "customer",
      type: "group",
      label: "Bill to",
      fields: [
        { name: "name", type: "text", required: true, label: "Name" },
        { name: "company", type: "text", label: "Company" },
        { name: "email", type: "email", label: "Email" },
        { name: "phone", type: "text", label: "Phone" },
      ],
    },
    {
      type: "row",
      fields: [
        { name: "eventDate", type: "date", label: "Event date", admin: { date: { pickerAppearance: "dayAndTime" } } },
        { name: "studio", type: "relationship", relationTo: "studios", label: "Studio", admin: { description: "Shown on the invoice and sets the tax; empty — British Columbia" } },
      ],
    },
    {
      name: "lines",
      type: "array",
      label: "Lines",
      labels: { singular: "Line", plural: "Lines" },
      minRows: 1,
      required: true,
      fields: [
        { name: "description", type: "text", required: true, label: "Description", admin: { description: "e.g. Private wheel workshop, 12 guests" } },
        {
          type: "row",
          fields: [
            { name: "quantity", type: "number", required: true, defaultValue: 1, label: "Quantity" },
            { name: "unitPrice", type: "number", required: true, label: "Price each", admin: { description: "In dollars; negative for a discount" } },
          ],
        },
        {
          name: "taxGroup",
          type: "select",
          required: true,
          defaultValue: "service",
          label: "Tax",
          options: [
            { label: "Class or event (GST)", value: "service" },
            { label: "Goods: clay, tools (GST + PST)", value: "goods" },
            { label: "No tax", value: "exempt" },
          ],
        },
      ],
    },
    { name: "note", type: "textarea", label: "Note to the client", admin: { description: "Shown on the invoice, e.g. what is included or the deposit terms" } },
    {
      name: "payments",
      type: "array",
      label: "Payments",
      labels: { singular: "Payment", plural: "Payments" },
      admin: { description: "Card payments are added here by themselves. Add an e-transfer or cash payment when it arrives." },
      fields: [
        {
          type: "row",
          fields: [
            { name: "at", type: "date", required: true, label: "Date", defaultValue: () => new Date().toISOString() },
            { name: "amount", type: "number", required: true, label: "Amount", admin: { description: "In dollars; negative for a refund" } },
          ],
        },
        {
          name: "method",
          type: "select",
          required: true,
          defaultValue: "e-transfer",
          label: "Method",
          options: [
            { label: "Card (online)", value: "card" },
            { label: "E-transfer", value: "e-transfer" },
            { label: "Cash", value: "cash" },
            { label: "Other", value: "other" },
          ],
        },
        { name: "note", type: "text", label: "Note" },
        { name: "ref", type: "text", label: "Stripe payment", admin: { readOnly: true, condition: (_, sibling) => Boolean(sibling?.ref) } },
      ],
    },
    {
      name: "totalDisplay",
      type: "text",
      virtual: true,
      label: "Total",
      admin: { readOnly: true, position: "sidebar" },
      hooks: { afterRead: [({ data }) => (typeof data?.total === "number" ? formatPrice(data.total / 100) : null)] },
    },
    { name: "token", type: "text", unique: true, index: true, label: "Link token", access: { update: () => false }, admin: { hidden: true } },
    // The Checkout session whose payment is being written: one conditional UPDATE on it lets one caller (the webhook or the page) record a payment once.
    { name: "claimedSession", type: "text", label: "Payment being recorded", admin: { hidden: true } },
    sum("subtotal", "Subtotal"),
    sum("tax", "Tax"),
    sum("total", "Total"),
    sum("paid", "Paid"),
    sum("due", "Due"),
  ],
};
