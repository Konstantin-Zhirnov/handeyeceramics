/**
 * The placeholders of the email templates (R12): {{key}} becomes the value,
 * a placeholder nobody provided stays in the text for the owner to notice,
 * and values go in as they are — the letters are plain text, nothing to escape.
 */
import { expect, it } from "vitest";
import { renderTemplate } from "../../lib/mail";

it("replaces known placeholders, with or without spaces inside the braces", () => {
  expect(renderTemplate("Hi {{name}}, order {{ order_number }} is paid", { name: "Ada", order_number: "HE-000007" })).toBe(
    "Hi Ada, order HE-000007 is paid",
  );
});

it("leaves an unknown placeholder as it is and repeats a value every time it appears", () => {
  expect(renderTemplate("{{class}} at {{studio_name}}; again {{class}}; {{unknown}}", { class: "Wheel", studio_name: "Chinatown" })).toBe(
    "Wheel at Chinatown; again Wheel; {{unknown}}",
  );
});

it("does not escape values: the letters are plain text", () => {
  expect(renderTemplate("Address: {{studio_address}}", { studio_address: "1 Test St <unit 2> & more" })).toBe("Address: 1 Test St <unit 2> & more");
});
