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
    {
      name: "short",
      type: "text",
      label: "Короткое название",
      admin: { description: "Для переключателя студий и кнопок, например Chinatown" },
    },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "open",
      label: "Статус",
      options: [
        { label: "Открыта", value: "open" },
        { label: "Скоро откроется", value: "planned" },
      ],
      admin: {
        position: "sidebar",
        description: "«Скоро откроется» — страница-заглушка: без телефона, расписания и адреса для Google",
      },
    },
    { name: "tag", type: "text", label: "Метка на карточке", admin: { description: "например Main studio" } },
    { name: "region", type: "text", label: "Город и провинция", admin: { description: "например Vancouver, BC" } },
    { name: "h1", type: "text", label: "Заголовок H1" },
    {
      name: "bookingPath",
      type: "text",
      label: "Страница записи",
      admin: {
        description:
          "Куда ведут кнопки Book этой студии, например /adult-beginner-pottery-classes-in-vancouver. Пусто — страница самой студии",
      },
    },
    {
      name: "address",
      type: "textarea",
      admin: { description: "Первая строка — улица и дом, вторая — «Город, BC V6A 2Z9»" },
    },
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
    {
      name: "description",
      type: "textarea",
      admin: { description: "Вступление. Строки вида «Название: текст» показываются рядом с расписанием" },
    },
    { name: "note", type: "textarea", label: "Текст карточки студии" },
    { name: "access", type: "textarea", label: "Как войти" },
    {
      name: "highlights",
      type: "array",
      label: "Особенности студии",
      fields: [{ name: "text", type: "text", required: true }],
    },
    {
      name: "google",
      type: "group",
      label: "Рейтинг Google",
      fields: [
        { name: "rating", type: "number", min: 0, max: 5 },
        { name: "count", type: "number", min: 0, label: "Число отзывов" },
        { name: "url", type: "text", label: "Ссылка на профиль" },
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
  labels: { singular: "Занятие", plural: "Занятия" },
  access: { ...contentAccess, read: readClassOfPublishedStudio },
  admin: { useAsTitle: "title", defaultColumns: ["title", "studio", "price", "unconfirmed"] },
  fields: [
    { name: "title", type: "text", required: true },
    {
      name: "tab",
      type: "text",
      label: "Вкладка на главной",
      admin: { description: "Короткое название, например Wheel throwing. С ним занятие показывается на главной и на странице студии" },
    },
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
    { name: "salePrice", type: "number", min: 0, admin: { description: "Цена со скидкой. Пусто — скидки нет" } },
    { name: "images", type: "upload", relationTo: "media", hasMany: true },
    { name: "description", type: "textarea" },
    {
      name: "options",
      type: "array",
      labels: { singular: "Вариант", plural: "Варианты" },
      admin: { description: "Варианты товара (дата, цвет, размер): название и значения — по одному в строке" },
      fields: [
        { name: "title", type: "text", required: true },
        { name: "choices", type: "textarea", required: true },
      ],
    },
    {
      name: "category",
      type: "text",
      admin: { description: "Категории через запятую. Товар виден на витринах, где указана одна из них" },
    },
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
    { name: "period", type: "text", admin: { description: "например per month. Пусто — показана только цена" } },
    { name: "description", type: "textarea" },
    {
      name: "group",
      type: "text",
      admin: { description: "Группа: заголовок на странице тарифов; по ней блок «Список тарифов» выбирает тарифы" },
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
  labels: { singular: "Заявка", plural: "Заявки" },
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
      label: "Форма",
      options: [
        { label: "Связь и запись (contact)", value: "contact" },
        { label: "Заказ изделия (commission)", value: "commission" },
        { label: "Мероприятие (event)", value: "event" },
        { label: "Другое (other)", value: "other" },
      ],
      access: readOnlyAfterCreate,
    },
    { name: "email", type: "email", required: true, label: "Почта", access: readOnlyAfterCreate },
    // The forms carried over from the old site ask for neither a name nor a phone.
    { name: "name", type: "text", label: "Имя", access: readOnlyAfterCreate },
    { name: "phone", type: "text", label: "Телефон", access: readOnlyAfterCreate },
    {
      name: "answers",
      type: "array",
      label: "Ответы на вопросы формы",
      labels: { singular: "Ответ", plural: "Ответы" },
      access: readOnlyAfterCreate,
      maxRows: 30,
      admin: { initCollapsed: false },
      fields: [
        { name: "question", type: "text", required: true, label: "Вопрос", maxLength: 300 },
        { name: "answer", type: "textarea", required: true, label: "Ответ", maxLength: 5000 },
      ],
    },
    { name: "message", type: "textarea", label: "Сообщение", maxLength: 5000, access: readOnlyAfterCreate },
    { name: "studio", type: "relationship", relationTo: "studios", label: "Студия", access: readOnlyAfterCreate },
    { name: "page", type: "text", label: "Страница, с которой отправлено", access: readOnlyAfterCreate },
    {
      name: "status",
      type: "select",
      defaultValue: "new",
      label: "Статус",
      options: [
        { label: "Новая", value: "new" },
        { label: "В работе", value: "in-progress" },
        { label: "Отвечено", value: "done" },
      ],
      admin: { position: "sidebar" },
      // Only signed-in editors may set it through the API; the form route writes "new".
      access: { create: ({ req }) => Boolean(req.user) },
    },
  ],
};
