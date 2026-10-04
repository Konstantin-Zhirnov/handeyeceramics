import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  CONFIRMATION,
  FORMS,
  SELECT_PLACEHOLDER,
  SUBMIT,
  isVisible,
  type FieldDef,
} from "../../components/forms/definitions";

/**
 * The contact and commission forms must ask what the old site asked: the same
 * questions in the same order, with the same choices, placeholders, required
 * marks, show/hide rules, button and confirmation. The source is the capture
 * of the live pages in content/forms-live.json.
 */
type LiveField = { label: string; kind: string; required: boolean; placeholder?: string; options?: string[] };
type LiveForm = {
  url: string;
  capturedAt: string;
  submit: string;
  confirmation: string;
  /** Where the confirmation text was read on the old site; "[TBD]" text when it could not be established. */
  confirmationSource?: string;
  selectPlaceholder: string;
  fields: LiveField[];
  visibility: null | { dependsOn: string; visibleFields: Record<string, string[]> };
};

const live = JSON.parse(
  readFileSync(path.resolve(import.meta.dirname, "../../content/forms-live.json"), "utf8"),
) as { forms: Record<"contact" | "commission", LiveForm> };

const shape = (f: FieldDef): LiveField => ({
  label: f.label,
  kind: f.kind,
  required: Boolean(f.required),
  ...(f.placeholder ? { placeholder: f.placeholder } : {}),
  ...(f.options ? { options: f.options } : {}),
});

describe.each(["contact", "commission"] as const)("the %s form against the live capture", (type) => {
  const want = live.forms[type];

  it("has a dated source", () => {
    expect(want.url).toMatch(/^https:\/\/www\.handeyeceramics\.com\//);
    expect(want.capturedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("says where its confirmation text was read, or leaves it [TBD]", () => {
    if (want.confirmation === "[TBD]") return;
    // "<the page's address> (<date read>): <where on the page>"
    const source = want.confirmationSource || "";
    expect(source.startsWith(`${want.url} (`), source).toBe(true);
    expect(source.slice(want.url.length)).toMatch(/^ \(\d{4}-\d{2}-\d{2}\): .{20,}/);
  });

  it("asks the same questions, in order, with the same choices and placeholders", () => {
    expect(FORMS[type].map(shape)).toEqual(want.fields);
  });

  it("has the same button, empty choice and confirmation", () => {
    expect(SUBMIT).toBe(want.submit);
    expect(SELECT_PLACEHOLDER).toBe(want.selectPlaceholder);
    expect(CONFIRMATION[type]).toBe(want.confirmation);
  });

  it("shows and hides the same questions for every choice", () => {
    if (!want.visibility) {
      // no rules on the live form: every question is always shown
      expect(FORMS[type].filter((f) => f.showWhen || f.hideWhen)).toEqual([]);
      return;
    }
    const { dependsOn, visibleFields } = want.visibility;
    const driver = FORMS[type].find((f) => f.label === dependsOn)!;
    expect(Object.keys(visibleFields)).toEqual(["", ...driver.options!]);
    for (const [choice, labels] of Object.entries(visibleFields)) {
      const shown = FORMS[type].filter((f) => isVisible(f, { [driver.name]: choice })).map((f) => f.label);
      expect(shown, `choice "${choice}"`).toEqual(labels);
    }
  });
});
