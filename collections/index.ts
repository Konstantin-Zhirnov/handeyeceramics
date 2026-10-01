import type { CollectionConfig } from "payload";
import { pageBlocks } from "./blocks";
import { contentAccess, flaggedContentAccess, photosField, publishedField, seoField, signedIn } from "./fields/common";
import { pathField } from "./fields/path";

export const Users: CollectionConfig = {
  slug: "users",
  auth: true,
  admin: { useAsTitle: "email" },
  fields: [{ name: "name", type: "text" }],
};

export const Media: CollectionConfig = {
  slug: "media",
  labels: { singular: "Фото", plural: "Фото" },
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
      label: "Описание картинки (alt)",
      admin: { description: "Что изображено — для незрячих посетителей и Google" },
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
    labels: { singular: "Видео", plural: "Видео" },
    access: contentAccess,
    admin: {
      useAsTitle: "title",
      description: muxEnabled
        ? "Видео загружаются в Mux."
        : "Видеохостинг не подключён: файл сохраняется как заглушка. Добавьте MUX_TOKEN_ID и MUX_TOKEN_SECRET, чтобы включить Mux.",
    },
    // Mux brings its own `title` and generated poster URL; ours is an optional custom poster.
    fields: [{ name: "poster", type: "upload", relationTo: "media", label: "Постер" }],
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
        label: "Видеохостинг не подключён",
        admin: {
          readOnly: true,
          description: "Видеохостинг не подключён — файл хранится локально как заглушка.",
        },
        hooks: { afterRead: [() => "Видеохостинг не подключён"] },
      },
    ],
  };
}

export const Studios: CollectionConfig = {
  slug: "studios",
  labels: { singular: "Студия", plural: "Студии" },
  access: flaggedContentAccess("published"),
  admin: { useAsTitle: "name", defaultColumns: ["name", "path", "published"] },
  fields: [
    { name: "name", type: "text", required: true },
    pathField(),
    { name: "address", type: "textarea" },
    { name: "phone", type: "text" },
    {
      name: "hours",
      type: "array",
      label: "Часы работы",
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
    { name: "description", type: "textarea" },
    photosField(),
    seoField,
    publishedField,
  ],
};

const weekdays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

export const Classes: CollectionConfig = {
  slug: "classes",
  labels: { singular: "Занятие", plural: "Занятия" },
  access: contentAccess,
  admin: { useAsTitle: "title", defaultColumns: ["title", "studio", "price", "unconfirmed"] },
  fields: [
    { name: "title", type: "text", required: true },
    { name: "studio", type: "relationship", relationTo: "studios", hasMany: true, label: "Студии" },
    { name: "description", type: "textarea" },
    { name: "price", type: "text", admin: { description: "Как на сайте, например $395" } },
    { name: "level", type: "text" },
    { name: "duration", type: "text" },
    {
      name: "sessions",
      type: "array",
      label: "Расписание",
      fields: [
        { name: "date", type: "date", admin: { description: "Для разовых занятий" } },
        { name: "weekday", type: "select", options: weekdays, admin: { description: "Для еженедельных" } },
        { name: "time", type: "text", required: true },
      ],
    },
    photosField(),
    { name: "bookingNote", type: "textarea", label: "Как записаться" },
    {
      name: "unconfirmed",
      type: "checkbox",
      defaultValue: true,
      label: "Расписание не подтверждено владельцем",
      admin: { position: "sidebar" },
    },
  ],
};

export const Pages: CollectionConfig = {
  slug: "pages",
  labels: { singular: "Страница", plural: "Страницы" },
  access: flaggedContentAccess("published"),
  admin: { useAsTitle: "title", defaultColumns: ["title", "path", "published"] },
  fields: [
    { name: "title", type: "text", required: true },
    pathField(),
    { name: "h1", type: "text", label: "Заголовок H1" },
    seoField,
    { name: "blocks", type: "blocks", blocks: pageBlocks },
    publishedField,
  ],
};

export const Products: CollectionConfig = {
  slug: "products",
  labels: { singular: "Товар", plural: "Товары" },
  access: flaggedContentAccess("visible"),
  admin: { useAsTitle: "name", defaultColumns: ["name", "price", "category", "visible"] },
  fields: [
    { name: "name", type: "text", required: true },
    pathField(),
    { name: "price", type: "number", min: 0 },
    { name: "images", type: "upload", relationTo: "media", hasMany: true },
    { name: "description", type: "textarea" },
    { name: "category", type: "text" },
    seoField,
    { name: "visible", type: "checkbox", defaultValue: true, admin: { position: "sidebar" } },
  ],
};

export const Plans: CollectionConfig = {
  slug: "plans",
  labels: { singular: "Тариф", plural: "Тарифы" },
  access: contentAccess,
  admin: { useAsTitle: "name", defaultColumns: ["name", "price", "period", "order"] },
  defaultSort: "order",
  fields: [
    { name: "name", type: "text", required: true },
    { name: "price", type: "number", min: 0 },
    { name: "period", type: "text", admin: { description: "например month" } },
    { name: "description", type: "textarea" },
    { name: "order", type: "number", defaultValue: 0 },
  ],
};

/** Enquiry fields are set once, on create, and never edited afterwards. */
const readOnlyAfterCreate = { update: () => false };

/**
 * Enquiries: the public may create; in the admin they are read-only except
 * `status`. Nobody deletes them through the API. A public create always starts
 * as status "new", whatever the request sends.
 */
export const Enquiries: CollectionConfig = {
  slug: "enquiries",
  labels: { singular: "Заявка", plural: "Заявки" },
  access: {
    create: () => true,
    read: signedIn,
    update: signedIn,
    delete: () => false,
  },
  admin: { useAsTitle: "name", defaultColumns: ["createdAt", "type", "name", "status"] },
  defaultSort: "-createdAt",
  fields: [
    {
      name: "type",
      type: "select",
      required: true,
      defaultValue: "contact",
      options: ["contact", "commission", "event", "other"],
      access: readOnlyAfterCreate,
    },
    { name: "name", type: "text", required: true, access: readOnlyAfterCreate },
    { name: "email", type: "email", required: true, access: readOnlyAfterCreate },
    { name: "phone", type: "text", access: readOnlyAfterCreate },
    { name: "message", type: "textarea", required: true, access: readOnlyAfterCreate },
    { name: "studio", type: "relationship", relationTo: "studios", access: readOnlyAfterCreate },
    { name: "page", type: "text", label: "Страница, с которой отправлено", access: readOnlyAfterCreate },
    {
      name: "status",
      type: "select",
      defaultValue: "new",
      options: ["new", "in-progress", "done"],
      admin: { position: "sidebar" },
      // Only signed-in editors may set it; on an anonymous create the default "new" applies.
      access: { create: ({ req }) => Boolean(req.user) },
    },
  ],
};
