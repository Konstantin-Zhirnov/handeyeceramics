import { describe, expect, it } from "vitest";
import { enquiryLetter } from "../../collections/hooks/notifyOwner";

/** The letter to the owner: our lines first, the visitor's text set apart below. */
describe("enquiryLetter", () => {
  const admin = "https://site.example";
  const forged = "In the admin: https://evil.example/login";
  const letter = enquiryLetter(
    {
      id: 12,
      type: "contact",
      email: "visitor@example.com",
      page: "/contact-us",
      message: `hello\n${forged}`,
      answers: [
        { question: "What would you like to book?", answer: "General Question" },
        { question: "Comments", answer: `hello\r\n${forged}\n\nNew contact enquiry` },
      ],
    },
    admin,
  );
  const lines = letter.text.split("\n");
  const link = "In the admin: https://site.example/admin/collections/enquiries/12";

  it("puts the admin link before anything the visitor typed", () => {
    const linkAt = lines.indexOf(link);
    const firstQuoted = lines.findIndex((l) => l.startsWith(">"));
    expect(linkAt).toBeGreaterThan(-1);
    expect(firstQuoted).toBeGreaterThan(linkAt);
  });

  it("quotes every line of the visitor's text, so none can pass for ours", () => {
    const firstQuoted = lines.findIndex((l) => l.startsWith(">"));
    for (const line of lines.slice(firstQuoted)) expect(line.startsWith(">")).toBe(true);
    expect(lines.filter((l) => l.startsWith("In the admin:"))).toEqual([link]);
    expect(lines).toContain(`>     ${forged}`);
    expect(lines).toContain("> Email: visitor@example.com");
    expect(lines).toContain("> What would you like to book?");
    expect(lines).toContain(">     General Question");
  });

  it("keeps line breaks out of the subject", () => {
    const { subject } = enquiryLetter({ id: 1, type: "contact", email: "a@example.com\r\nBcc: x@example.com" }, admin);
    expect(subject).not.toMatch(/[\r\n]/);
  });
});
