/**
 * The browser's copy of the cart (R03.1) survives a reload and the double
 * mounting of effects in React StrictMode: the provider reads, may be torn
 * down and read again, and persists its lines on every render — and the
 * stored cart must still be there. Storage is a Map standing in for localStorage.
 */
import { describe, expect, it } from "vitest";
import { CART_KEY, type CartLine, createCartSync, parseCart } from "../../components/cart/storage";

const stored: CartLine[] = [
  { kind: "session", id: 7, quantity: 2, seenAmount: 29680 },
  { kind: "product", id: 3, quantity: 1, option: "Glaze Colour: Blue bubbles" },
];

const memory = (initial?: CartLine[]) => {
  const map = new Map<string, string>();
  if (initial) map.set(CART_KEY, JSON.stringify(initial));
  return { map, storage: { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v) } };
};

describe("the stored cart across mount → unmount → mount", () => {
  it("is still there after the effects ran twice with an empty in-memory cart in between", () => {
    const { map, storage } = memory(stored);
    const sync = createCartSync(() => storage);
    // First mount: the provider renders with [] before the read lands; persisting that must not wipe the copy.
    expect(sync.persist([])).toBe(false);
    expect(sync.load()).toEqual(stored);
    // StrictMode tears the effects down and runs them again: the second read sees the same cart.
    const again = createCartSync(() => storage);
    expect(again.load()).toEqual(stored);
    // The provider persists what it has after the read: nothing changed, nothing written.
    expect(again.persist(stored)).toBe(false);
    expect(JSON.parse(map.get(CART_KEY)!)).toEqual(stored);
  });

  it("writes only a real change, and a later mount reads it back", () => {
    const { map, storage } = memory(stored);
    const sync = createCartSync(() => storage);
    sync.load();
    const more: CartLine[] = [...stored, { kind: "product", id: 9, quantity: 3 }];
    expect(sync.persist(more)).toBe(true);
    expect(sync.persist(more)).toBe(false);
    expect(createCartSync(() => storage).load()).toEqual(more);
    // Clearing the cart on purpose is a change too.
    expect(sync.persist([])).toBe(true);
    expect(map.get(CART_KEY)).toBe("[]");
  });

  it("lives in memory when there is no storage, and reads junk as an empty cart", () => {
    const sync = createCartSync(() => undefined);
    expect(sync.load()).toEqual([]);
    expect(sync.persist(stored)).toBe(true);
    expect(parseCart("not json")).toEqual([]);
    expect(parseCart(JSON.stringify([{ kind: "plan", id: 1, quantity: 1 }, { kind: "product", id: 2, quantity: 0 }, stored[1]]))).toEqual([stored[1]]);
  });
});
