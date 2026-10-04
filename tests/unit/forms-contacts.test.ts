/**
 * The contacts a form shows when sending fails come from the site settings in
 * the admin, never from the prototype data in lib/site.ts.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../..");
const files = ["components/forms/EnquiryForm.tsx", "components/forms/EnquiryFormFields.tsx", "app/(site)/forms/enquiry/route.ts"];

describe("form contacts", () => {
  it.each(files)("%s does not read lib/site.ts", (f) => {
    expect(readFileSync(path.join(root, f), "utf8")).not.toMatch(/from ["']@\/lib\/site["']/);
  });
});
