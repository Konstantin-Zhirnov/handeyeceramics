import { describe, expect, it } from "vitest";
import { sourceName, pickMedia } from "../../scripts/seed/media-key";

// Payload renames an upload whose name is already taken in storage to
// `<stem>-<n>.<ext>`. The seed must recognise such a document as the same
// picture as the inventory file it came from.
describe("sourceName", () => {
  it.each([
    ["wheel-spin.jpg", "wheel-spin.jpg"],
    ["wheel-spin-7.jpg", "wheel-spin.jpg"],
    ["62bba2_04d38d28b94e4568a4f20dbc9324e2a1-mv2-14.png", "62bba2_04d38d28b94e4568a4f20dbc9324e2a1-mv2.png"],
    ["01c3aff52f2a4dffa526d7a9843d46ea-5.png", "01c3aff52f2a4dffa526d7a9843d46ea.png"],
    ["photo-2024.jpeg", "photo.jpeg"],
    ["no-extension-3", "no-extension-3"],
    ["dash-only-.png", "dash-only-.png"],
    ["Wheel-Spin-7.JPG", "wheel-spin.jpg"],
  ])("%j → %j", (filename, expected) => {
    expect(sourceName(filename)).toBe(expected);
  });
});

describe("pickMedia", () => {
  const docs = [
    { id: 1, filename: "a-5.png", createdAt: "2026-10-04T00:00:00Z" },
    { id: 2, filename: "a-6.png", createdAt: "2026-10-06T00:00:00Z" },
    { id: 3, filename: "a-7.png", createdAt: "2026-10-07T00:00:00Z" },
  ];
  it("prefers the newest document when none is referenced", () => {
    expect(pickMedia(docs)?.id).toBe(3);
  });
  it("prefers a referenced document over a newer unreferenced one", () => {
    expect(pickMedia(docs, new Set([2]))?.id).toBe(2);
  });
  it("prefers the newest among several referenced documents", () => {
    expect(pickMedia(docs, new Set([1, 2]))?.id).toBe(2);
  });
  it("returns undefined for an empty list", () => {
    expect(pickMedia([])).toBeUndefined();
  });
});
