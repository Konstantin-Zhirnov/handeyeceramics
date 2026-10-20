import type { GlobalConfig } from "payload";
import { photosField, signedIn } from "../collections/fields/common";

const linkFields = [
  { name: "label", type: "text" as const, required: true },
  { name: "href", type: "text" as const, required: true },
];

export const Settings: GlobalConfig = {
  slug: "settings",
  label: "Site settings",
  access: { read: () => true },
  fields: [
    { name: "phone", type: "text" },
    { name: "email", type: "email" },
    { name: "instagram", type: "text", admin: { description: "Link to the profile" } },
    {
      name: "stripePortalUrl",
      type: "text",
      label: "Subscription portal",
      admin: { description: "Customer portal link from Stripe; empty — no link" },
    },
    {
      name: "invoices",
      type: "group",
      label: "Invoices",
      fields: [
        { name: "gstNumber", type: "text", label: "GST number", admin: { description: "Printed on every invoice; empty — not printed" } },
        {
          name: "paymentNote",
          type: "textarea",
          label: "How to pay by e-transfer",
          admin: { description: "Printed on every invoice that is not paid, e.g. the address to send an e-transfer to" },
        },
      ],
    },
    { name: "nav", type: "array", label: "Menu", fields: linkFields },
    {
      name: "footer",
      type: "group",
      label: "Footer",
      fields: [
        { name: "text", type: "textarea" },
        { name: "links", type: "array", fields: linkFields },
      ],
    },
  ],
};

export const Home: GlobalConfig = {
  slug: "home",
  label: "Home page",
  access: { read: () => true },
  fields: [
    {
      name: "hero",
      type: "group",
      fields: [
        { name: "eyebrow", type: "text" },
        { name: "title", type: "text" },
        { name: "subtitle", type: "textarea" },
        { name: "primaryCta", type: "group", fields: linkFields.map((f) => ({ ...f, required: false })) },
        { name: "secondaryCta", type: "group", fields: linkFields.map((f) => ({ ...f, required: false })) },
      ],
    },
    {
      name: "sections",
      type: "array",
      label: "Section texts",
      fields: [
        {
          name: "key",
          type: "text",
          required: true,
          admin: {
            description:
              "classes, gallery, reviews, locations, other-studios, membership; series feature-1…, perk-1…, stage-1…, review-1…. In a heading, *italics* and “ / ” for a line break",
          },
        },
        { name: "eyebrow", type: "text" },
        { name: "heading", type: "text" },
        { name: "body", type: "textarea" },
      ],
    },
    photosField("gallery", "Gallery photos"),
    {
      name: "seo",
      type: "group",
      fields: [
        { name: "title", type: "text" },
        { name: "description", type: "textarea" },
      ],
    },
  ],
};

/**
 * The teacher contacts page (/teachers), closed by one password shared by all
 * students; the owner keeps it, and changes it only if it leaks. Only signed-in
 * editors read this global; the page reads
 * it on the server after checking the student's password.
 */
export const Teachers: GlobalConfig = {
  slug: "teachers",
  label: "Teacher contacts",
  access: { read: signedIn, update: signedIn },
  admin: {
    description:
      "The page /teachers. Students open it with the password from their confirmation email. One password for all students; change it only if it leaks — whoever had the old one has to enter the new one.",
  },
  fields: [
    {
      name: "password",
      type: "text",
      label: "Password",
      admin: { description: "One password for all students, kept as long as you like; letter case does not matter. Empty — the page is closed to everyone." },
    },
    { name: "intro", type: "textarea", label: "Text above the list", admin: { description: "For example, whom to call when the teacher does not answer" } },
    {
      name: "teachers",
      type: "array",
      label: "Teachers",
      labels: { singular: "Teacher", plural: "Teachers" },
      fields: [
        { name: "name", type: "text", required: true, label: "Name" },
        { name: "phone", type: "text", required: true, label: "Phone" },
        { name: "studio", type: "relationship", relationTo: "studios", label: "Studio" },
        { name: "classes", type: "text", label: "Classes", admin: { description: "What they teach, e.g. Mon & Wed wheel 6 PM; mark assistants here" } },
      ],
    },
    { name: "outro", type: "textarea", label: "Text below the list", admin: { description: "For example, the studio cell numbers and the head office" } },
  ],
};
