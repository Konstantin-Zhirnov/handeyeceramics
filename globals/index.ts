import type { GlobalConfig } from "payload";

const linkFields = [
  { name: "label", type: "text" as const, required: true },
  { name: "href", type: "text" as const, required: true },
];

export const Settings: GlobalConfig = {
  slug: "settings",
  label: "Настройки сайта",
  access: { read: () => true },
  fields: [
    { name: "phone", type: "text" },
    { name: "email", type: "email" },
    { name: "instagram", type: "text", admin: { description: "Ссылка на профиль" } },
    { name: "nav", type: "array", label: "Меню", fields: linkFields },
    {
      name: "footer",
      type: "group",
      label: "Подвал",
      fields: [
        { name: "text", type: "textarea" },
        { name: "links", type: "array", fields: linkFields },
      ],
    },
  ],
};

export const Home: GlobalConfig = {
  slug: "home",
  label: "Главная",
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
      label: "Тексты секций",
      fields: [
        { name: "key", type: "text", required: true, admin: { description: "например classes, gallery, membership" } },
        { name: "eyebrow", type: "text" },
        { name: "heading", type: "text" },
        { name: "body", type: "textarea" },
      ],
    },
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
