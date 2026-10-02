import type { CollectionConfig } from "payload";
import { pageBlocks } from "./blocks";
import {
  contentAccess,
  flaggedContentAccess,
  photosField,
  publishedField,
  readClassOfPublishedStudio,
  seoField,
  signedIn,
} from "./fields/common";
import { pathField } from "./fields/path";
import { notifyOwner } from "./hooks/notifyOwner";

export const Users: CollectionConfig = {
  slug: "users",
  auth: true,
  admin: { useAsTitle: "email" },
  fields: [{ name: "name", type: "text" }],
};

export const Media: CollectionConfig = {
  slug: "media",
  labels: { singular: "Photo", plural: "Photos" },
  access: contentAccess,
  upload: {
    staticDir: "media",
    mimeTypes: ["image/*"],
    imageSizes: [
      { name: "thumb", width: 480 },
      { name: "large", width: 1600 },
    ],
  },
  fields: [
    {
      name: "alt",
      type: "text",
      required: true,
      label: "Picture description (alt text)",
      admin: { description: "What the picture shows — for visitors who use a screen reader, and for Google" },
    },
  ],
};

/**
 * Videos. With Mux configured, the Mux plugin extends this collection with its
 * uploader and asset fields. Without Mux, it is a plain local upload used as a
 * placeholder, and the admin says so.
 */
export function videosCollection(muxEnabled: boolean): CollectionConfig {
  const base: CollectionConfig = {
    slug: "videos",
    labels: { singular: "Video", plural: "Videos" },
    access: contentAccess,
    admin: {
      useAsTitle: "title",
      description: muxEnabled
        ? "Videos are uploaded to Mux."
        : "Video hosting is not connected: the file is kept as a placeholder. Add MUX_TOKEN_ID and MUX_TOKEN_SECRET to switch Mux on.",
    },
    // Mux brings its own `title` and generated poster URL; ours is an optional custom poster.
    fields: [{ name: "poster", type: "upload", relationTo: "media", label: "Poster" }],
  };
  if (muxEnabled) return base;
  return {
    ...base,
    upload: { staticDir: "media/videos", mimeTypes: ["video/*"] },
    fields: [
      { name: "title", type: "text", required: true },
      ...base.fields,
      {
        name: "placeholderNote",
        type: "text",
        virtual: true,
        label: "Video hosting is not connected",
        admin: {
          readOnly: true,
          description: "Video hosting is not connected — the file is stored locally as a placeholder.",
        },
        hooks: { afterRead: [() => "Video hosting is not connected"] },
      },
    ],
  };
}

export const Studios: CollectionConfig = {
  slug: "studios",
  labels: { singular: "Studio", plural: "Studios" },
  access: flaggedContentAccess("published"),
  admin: { useAsTitle: "name", defaultColumns: ["name", "path", "published"] },
  fields: [
    { name: "name", type: "text", required: true },
    pathField(),
    {
      name: "short",
      type: "text",
      label: "Short name",
      admin: { description: "For the studio switcher and buttons, e.g. Chinatown" },
    },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "open",
      label: "Status",
      options: [
        { label: "Open", value: "open" },
        { label: "Opening soon", value: "planned" },
      ],
      admin: {
        position: "sidebar",
        description: "“Opening soon” is a placeholder page: no phone, no schedule and no address for Google",
      },
    },
    { name: "tag", type: "text", label: "Tag on the card", admin: { description: "e.g. Main studio" } },
    { name: "region", type: "text", label: "City and province", admin: { description: "e.g. Vancouver, BC" } },
    { name: "h1", type: "text", label: "Heading (H1)" },
    {
      name: "bookingPath",
      type: "text",
      label: "Booking page",
      admin: {
        description:
          "Where this studio's Book buttons lead, e.g. /adult-beginner-pottery-classes-in-vancouver. Empty — the studio's own page",
      },
    },
    {
      name: "address",
      type: "textarea",
      admin: { description: "First line — street address; second line — “City, BC V6A 2Z9”" },
    },
    { name: "phone", type: "text" },
    {
      name: "hours",
      type: "array",
      label: "Opening hours",
      fields: [
        { name: "days", type: "text", required: true },
        { name: "time", type: "text", required: true },
      ],
    },
    {
      name: "geo",
      type: "group",
      fields: [
        { name: "lat", type: "number" },
        { name: "lng", type: "number" },
      ],
    },
    {
      name: "description",
      type: "textarea",
      admin: { description: "Introduction. Lines written as “Label: text” are shown next to the schedule" },
    },
    { name: "note", type: "textarea", label: "Text on the studio card" },
    { name: "access", type: "textarea", label: "How to get in" },
    {
      name: "highlights",
      type: "array",
      label: "Studio highlights",
      fields: [{ name: "text", type: "text", required: true }],
    },
    {
      name: "google",
      type: "group",
      label: "Google rating",
      fields: [
        { name: "rating", type: "number", min: 0, max: 5 },
        { name: "count", type: "number", min: 0, label: "Number of reviews" },
        { name: "url", type: "text", label: "Link to the profile" },
      ],
    },
    photosField(),
    seoField,
    publishedField,
  ],
};

const weekdays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

export const Classes: CollectionConfig = {
  slug: "classes",
  labels: { singular: "Class", plural: "Classes" },
  access: { ...contentAccess, read: readClassOfPublishedStudio },
  admin: { useAsTitle: "title", defaultColumns: ["title", "studio", "price", "unconfirmed"] },
  fields: [
    { name: "title", type: "text", required: true },
    {
      name: "tab",
      type: "text",
      label: "Tab on the home page",
      admin: { description: "A short name, e.g. Wheel throwing. With it, the class is shown on the home page and on the studio page" },
    },
    { name: "studio", type: "relationship", relationTo: "studios", hasMany: true, label: "Studios" },
    { name: "description", type: "textarea" },
    { name: "price", type: "text", admin: { description: "As shown on the site, e.g. $395" } },
    { name: "level", type: "text" },
    { name: "duration", type: "text" },
    {
      name: "sessions",
      type: "array",
      label: "Schedule",
      fields: [
        { name: "date", type: "date", admin: { description: "For one-off classes" } },
        { name: "weekday", type: "select", options: weekdays, admin: { description: "For weekly classes" } },
        { name: "time", type: "text", required: true },
      ],
    },
    photosField(),
    { name: "bookingNote", type: "textarea", label: "How to book" },
    {
      name: "unconfirmed",
      type: "checkbox",
      defaultValue: true,
      label: "Schedule not confirmed by the owner",
      admin: { position: "sidebar" },
    },
  ],
};

export const Pages: CollectionConfig = {
  slug: "pages",
  labels: { singular: "Page", plural: "Pages" },
  access: flaggedContentAccess("published"),
  admin: { useAsTitle: "title", defaultColumns: ["title", "path", "published"] },
  fields: [
    { name: "title", type: "text", required: true },
    pathField(),
    { name: "h1", type: "text", label: "Heading (H1)" },
    seoField,
    { name: "blocks", type: "blocks", blocks: pageBlocks },
    publishedField,
  ],
};

export const Products: CollectionConfig = {
  slug: "products",
  labels: { singular: "Product", plural: "Products" },
  access: flaggedContentAccess("visible"),
  admin: { useAsTitle: "name", defaultColumns: ["name", "price", "category", "visible"] },
  fields: [
    { name: "name", type: "text", required: true },
    pathField(),
    { name: "price", type: "number", min: 0 },
    { name: "salePrice", type: "number", min: 0, admin: { description: "Sale price. Empty — no discount" } },
    { name: "images", type: "upload", relationTo: "media", hasMany: true },
    { name: "description", type: "textarea" },
    {
      name: "options",
      type: "array",
      labels: { singular: "Option", plural: "Options" },
      admin: { description: "Product options (date, colour, size): a title and its values, one per line" },
      fields: [
        { name: "title", type: "text", required: true },
        { name: "choices", type: "textarea", required: true },
      ],
    },
    {
      name: "category",
      type: "text",
      admin: { description: "Categories, separated by commas. The product is shown on the shop pages that list one of them" },
    },
    seoField,
    { name: "visible", type: "checkbox", defaultValue: true, admin: { position: "sidebar" } },
  ],
};

export const Plans: CollectionConfig = {
  slug: "plans",
  labels: { singular: "Plan", plural: "Plans" },
  access: contentAccess,
  admin: { useAsTitle: "name", defaultColumns: ["name", "price", "period", "order"] },
  defaultSort: "order",
  fields: [
    { name: "name", type: "text", required: true },
    { name: "price", type: "number", min: 0 },
    { name: "period", type: "text", admin: { description: "e.g. per month. Empty — only the price is shown" } },
    { name: "description", type: "textarea" },
    {
      name: "group",
      type: "text",
      admin: { description: "Group: the heading on the plans page; the “Plan list” block picks plans by it" },
    },
    { name: "order", type: "number", defaultValue: 0 },
  ],
};

/** Enquiry fields are set once, on create, and never edited afterwards. */
const readOnlyAfterCreate = { update: () => false };

/**
 * Enquiries: only signed-in editors reach them through the API. Visitors'
 * enquiries come in through the form route (POST /forms/enquiry), which checks
 * them and writes with the Local API, always as status "new". In the admin they
 * are read-only except `status`; nobody deletes them through the API. The
 * answers to the form's questions are kept as question → answer rows; the
 * owner is told by email.
 */
export const Enquiries: CollectionConfig = {
  slug: "enquiries",
  labels: { singular: "Enquiry", plural: "Enquiries" },
  access: {
    create: signedIn,
    read: signedIn,
    update: signedIn,
    delete: () => false,
  },
  admin: { useAsTitle: "email", defaultColumns: ["createdAt", "type", "email", "message", "status"] },
  defaultSort: "-createdAt",
  hooks: { afterChange: [notifyOwner] },
  fields: [
    {
      name: "type",
      type: "select",
      required: true,
      defaultValue: "contact",
      label: "Form",
      options: [
        { label: "Contact and booking", value: "contact" },
        { label: "Commission", value: "commission" },
        { label: "Event", value: "event" },
        { label: "Other", value: "other" },
      ],
      access: readOnlyAfterCreate,
    },
    { name: "email", type: "email", required: true, label: "Email", access: readOnlyAfterCreate },
    // The forms carried over from the old site ask for neither a name nor a phone.
    { name: "name", type: "text", label: "Name", access: readOnlyAfterCreate },
    { name: "phone", type: "text", label: "Phone", access: readOnlyAfterCreate },
    {
      name: "answers",
      type: "array",
      label: "Answers to the form's questions",
      labels: { singular: "Answer", plural: "Answers" },
      access: readOnlyAfterCreate,
      maxRows: 30,
      admin: { initCollapsed: false },
      fields: [
        { name: "question", type: "text", required: true, label: "Question", maxLength: 300 },
        { name: "answer", type: "textarea", required: true, label: "Answer", maxLength: 5000 },
      ],
    },
    { name: "message", type: "textarea", label: "Message", maxLength: 5000, access: readOnlyAfterCreate },
    { name: "studio", type: "relationship", relationTo: "studios", label: "Studio", access: readOnlyAfterCreate },
    { name: "page", type: "text", label: "Page it was sent from", access: readOnlyAfterCreate },
    {
      name: "status",
      type: "select",
      defaultValue: "new",
      label: "Status",
      options: [
        { label: "New", value: "new" },
        { label: "In progress", value: "in-progress" },
        { label: "Answered", value: "done" },
      ],
      admin: { position: "sidebar" },
      // Only signed-in editors may set it through the API; the form route writes "new".
      access: { create: ({ req }) => Boolean(req.user) },
    },
  ],
};
