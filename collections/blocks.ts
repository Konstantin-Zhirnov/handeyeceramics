import type { Block } from "payload";

/** Content blocks for `pages.blocks` (spec §7). Rendering lives in the site module. */
export const pageBlocks: Block[] = [
  {
    slug: "text",
    labels: { singular: "Text", plural: "Text" },
    fields: [
      { name: "heading", type: "text" },
      { name: "body", type: "richText" },
    ],
  },
  {
    slug: "image",
    labels: { singular: "Picture", plural: "Pictures" },
    fields: [
      { name: "image", type: "upload", relationTo: "media", required: true },
      { name: "caption", type: "text" },
    ],
  },
  {
    slug: "gallery",
    labels: { singular: "Gallery", plural: "Galleries" },
    fields: [
      { name: "heading", type: "text" },
      { name: "images", type: "upload", relationTo: "media", hasMany: true, required: true },
    ],
  },
  {
    slug: "video",
    labels: { singular: "Video", plural: "Videos" },
    fields: [
      { name: "video", type: "relationship", relationTo: "videos", required: true },
      { name: "caption", type: "text" },
    ],
  },
  {
    slug: "cta",
    labels: { singular: "Call to action", plural: "Calls to action" },
    fields: [
      { name: "heading", type: "text", required: true },
      { name: "body", type: "textarea" },
      { name: "buttonLabel", type: "text", required: true },
      { name: "buttonHref", type: "text", required: true },
    ],
  },
  {
    slug: "form",
    labels: { singular: "Form", plural: "Forms" },
    fields: [
      { name: "heading", type: "text" },
      {
        name: "formType",
        type: "select",
        required: true,
        defaultValue: "contact",
        options: ["contact", "commission", "event", "other"],
      },
    ],
  },
  {
    slug: "classList",
    labels: { singular: "Class list", plural: "Class lists" },
    fields: [
      { name: "heading", type: "text" },
      { name: "studio", type: "relationship", relationTo: "studios", admin: { description: "Empty — all studios" } },
    ],
  },
  {
    slug: "productList",
    labels: { singular: "Product list", plural: "Product lists" },
    fields: [
      { name: "heading", type: "text" },
      { name: "category", type: "text", admin: { description: "Products of this category. Empty — the list is empty" } },
      { name: "all", type: "checkbox", label: "All products of the shop, by category" },
    ],
  },
  {
    slug: "planList",
    labels: { singular: "Plan list", plural: "Plan lists" },
    fields: [
      { name: "heading", type: "text" },
      { name: "group", type: "text", admin: { description: "Plans of this group. Empty — all plans, by group" } },
    ],
  },
];
