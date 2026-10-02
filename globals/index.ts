import type { GlobalConfig } from "payload";
import { photosField } from "../collections/fields/common";

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
