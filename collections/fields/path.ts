import type { TextField } from "payload";

/**
 * Normalise a public URL path: leading "/", no trailing "/", no query/hash,
 * no repeated slashes. "/" stays "/". Empty input stays empty (required check
 * reports it). A full URL keeps only its path; an unparseable http string is
 * returned as is, so validation rejects it.
 */
export function normalizePath(input: unknown): string {
  if (typeof input !== "string") return "";
  let p = input.trim();
  if (!p) return "";
  // Accept a full URL pasted from the live site: keep only its path.
  if (/^https?:\/\//i.test(p)) {
    try {
      p = new URL(p).pathname;
    } catch {
      // Unparseable URL: return it unchanged so validation rejects it.
      return input.trim();
    }
  }
  p = p.split(/[?#]/)[0];
  p = "/" + p.replace(/^\/+/, "");
  p = p.replace(/\/{2,}/g, "/");
  if (p.length > 1) p = p.replace(/\/+$/, "");
  return p;
}

/** The `path` field shared by pages, studios and products: unique, normalised. */
export function pathField(overrides: Partial<TextField> = {}): TextField {
  return {
    name: "path",
    type: "text",
    required: true,
    unique: true,
    index: true,
    admin: {
      position: "sidebar",
      description: "Адрес страницы как на старом сайте, например /pottery-classes-nanaimo",
    },
    hooks: {
      beforeValidate: [({ value }) => normalizePath(value)],
    },
    validate: (value: unknown) => {
      if (typeof value !== "string" || !value) return "Укажите адрес";
      if (/^https?:/i.test(value)) return "Неверная ссылка: укажите адрес страницы, например /about";
      if (!value.startsWith("/")) return "Адрес начинается с /";
      if (/\s/.test(value)) return "В адресе не должно быть пробелов";
      return true;
    },
    ...overrides,
  } as TextField;
}
