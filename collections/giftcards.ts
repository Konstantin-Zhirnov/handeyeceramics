/**
 * Gift cards: a code with a balance. The site issues one for every gift card
 * bought (lib/giftcards) and takes from the balance when a code is used at
 * checkout; the editor may add a card by hand — a balance carried over from
 * Wix, or a card given away — and may void one. The code is set once: typed
 * or generated on create, never edited.
 */
import type { CollectionConfig } from "payload";
import { GIFT_CODE, generateGiftCode, normalizeGiftCode } from "../lib/giftcards/code";
import { signedIn } from "./fields/common";

const GROUP = "Sales";

export const GiftCards: CollectionConfig = {
  slug: "giftcards",
  labels: { singular: "Gift card", plural: "Gift cards" },
  access: { read: signedIn, create: signedIn, update: signedIn, delete: () => false },
  admin: {
    useAsTitle: "code",
    group: GROUP,
    defaultColumns: ["code", "amount", "balance", "status", "buyerEmail", "createdAt"],
    description:
      "Every gift card bought on the site appears here with its code and balance. Add a card by hand to carry a Wix balance over; set a card to Void to stop it being used.",
  },
  defaultSort: "-createdAt",
  hooks: {
    beforeValidate: [
      ({ data, operation }) => {
        if (!data) return data;
        if (operation === "create") {
          const typed = normalizeGiftCode(data.code);
          data.code = typed || generateGiftCode();
          if (typeof data.balance !== "number") data.balance = data.amount;
        }
        return data;
      },
    ],
  },
  fields: [
    {
      name: "code",
      type: "text",
      required: true,
      unique: true,
      index: true,
      label: "Code",
      access: { update: () => false },
      validate: (value: unknown) => (typeof value === "string" && GIFT_CODE.test(value) ? true : "A code looks like HE-XXXX-XXXX-XXXX"),
      admin: { description: "Leave empty to have one generated. Cannot be changed afterwards" },
    },
    { name: "amount", type: "number", required: true, min: 0, label: "Amount", admin: { description: "In dollars, what the card was loaded with" } },
    {
      name: "balance",
      type: "number",
      required: true,
      min: 0,
      label: "Balance",
      admin: { description: "In dollars, what is left. The site takes from it at checkout; correct it here only to fix a mistake" },
    },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "active",
      label: "Status",
      options: [
        { label: "Active", value: "active" },
        { label: "Void (cannot be used)", value: "void" },
      ],
      admin: { position: "sidebar" },
    },
    { name: "buyerEmail", type: "email", label: "Buyer's email", admin: { description: "Where the code was sent" } },
    { name: "order", type: "relationship", relationTo: "orders", label: "Bought in order", access: { update: () => false }, admin: { readOnly: true, position: "sidebar" } },
    { name: "note", type: "textarea", label: "Note", admin: { description: "e.g. the Wix card it replaces, or who it was given to" } },
    {
      name: "uses",
      type: "array",
      label: "Uses",
      labels: { singular: "Use", plural: "Uses" },
      access: { create: () => false, update: () => false },
      admin: { readOnly: true, initCollapsed: true },
      fields: [
        { name: "at", type: "date", required: true, label: "When" },
        // Not "order": Postgres would give its index the name of the array's own `_order` index.
        { name: "usedIn", type: "relationship", relationTo: "orders", label: "Order" },
        { name: "amount", type: "number", required: true, label: "Amount", admin: { description: "In dollars" } },
      ],
    },
  ],
};
