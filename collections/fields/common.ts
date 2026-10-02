import type { Access, Field, Where } from "payload";

export const publicRead: Access = () => true;
export const signedIn: Access = ({ req }) => Boolean(req.user);

/** Content collections: anyone may read, only signed-in editors may write. */
export const contentAccess = {
  read: publicRead,
  create: signedIn,
  update: signedIn,
  delete: signedIn,
};

/**
 * Anonymous visitors read only documents whose `flag` checkbox is on
 * (published / visible); signed-in editors read everything.
 */
export const readWhenFlagged =
  (flag: "published" | "visible"): Access =>
  ({ req }) =>
    req.user ? true : { [flag]: { equals: true } };

/**
 * Classes: an anonymous visitor does not get a class whose every studio is
 * unpublished. A class tied to no studio is public.
 */
const classOfPublishedStudio: Where = { or: [{ studio: { exists: false } }, { "studio.published": { equals: true } }] };
export const readClassOfPublishedStudio: Access = ({ req }) => (req.user ? true : classOfPublishedStudio);

/** Content access for collections with a published/visible flag. */
export const flaggedContentAccess = (flag: "published" | "visible") => ({
  ...contentAccess,
  read: readWhenFlagged(flag),
});

export const seoField: Field = {
  name: "seo",
  type: "group",
  label: "SEO",
  fields: [
    { name: "title", type: "text", label: "Title (browser tab and Google)" },
    { name: "description", type: "textarea", label: "Meta description" },
  ],
};

export const publishedField: Field = {
  name: "published",
  type: "checkbox",
  defaultValue: true,
  label: "Published",
  admin: { position: "sidebar" },
};

export const photosField = (name = "photos", label = "Photos"): Field => ({
  name,
  type: "upload",
  relationTo: "media",
  hasMany: true,
  label,
});
