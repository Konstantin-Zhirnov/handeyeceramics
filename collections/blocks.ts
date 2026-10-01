import type { Block } from "payload";

/** Content blocks for `pages.blocks` (spec §7). Rendering lives in the site module. */
export const pageBlocks: Block[] = [
  {
    slug: "text",
    labels: { singular: "Текст", plural: "Текст" },
    fields: [
      { name: "heading", type: "text" },
      { name: "body", type: "richText" },
    ],
  },
  {
    slug: "image",
    labels: { singular: "Картинка", plural: "Картинки" },
    fields: [
      { name: "image", type: "upload", relationTo: "media", required: true },
      { name: "caption", type: "text" },
    ],
  },
  {
    slug: "gallery",
    labels: { singular: "Галерея", plural: "Галереи" },
    fields: [
      { name: "heading", type: "text" },
      { name: "images", type: "upload", relationTo: "media", hasMany: true, required: true },
    ],
  },
  {
    slug: "video",
    labels: { singular: "Видео", plural: "Видео" },
    fields: [
      { name: "video", type: "relationship", relationTo: "videos", required: true },
      { name: "caption", type: "text" },
    ],
  },
  {
    slug: "cta",
    labels: { singular: "Призыв с кнопкой", plural: "Призывы с кнопкой" },
    fields: [
      { name: "heading", type: "text", required: true },
      { name: "body", type: "textarea" },
      { name: "buttonLabel", type: "text", required: true },
      { name: "buttonHref", type: "text", required: true },
    ],
  },
  {
    slug: "form",
    labels: { singular: "Форма", plural: "Формы" },
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
    labels: { singular: "Список занятий", plural: "Списки занятий" },
    fields: [
      { name: "heading", type: "text" },
      { name: "studio", type: "relationship", relationTo: "studios", admin: { description: "Пусто — все студии" } },
    ],
  },
  {
    slug: "productList",
    labels: { singular: "Список товаров", plural: "Списки товаров" },
    fields: [
      { name: "heading", type: "text" },
      { name: "category", type: "text", admin: { description: "Товары этой категории. Пусто — список пуст" } },
      { name: "all", type: "checkbox", label: "Все товары магазина, по категориям" },
    ],
  },
  {
    slug: "planList",
    labels: { singular: "Список тарифов", plural: "Списки тарифов" },
    fields: [
      { name: "heading", type: "text" },
      { name: "group", type: "text", admin: { description: "Тарифы этой группы. Пусто — все тарифы, по группам" } },
    ],
  },
];
