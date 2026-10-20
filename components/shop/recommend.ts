/**
 * "You might also like" under a product page. The owner's pick in the admin
 * wins (`products.recommended`, in that order) — that is how the next level
 * after a course is set. Without a pick: other classes in the same city as
 * this one, those at another studio of that city first (a Chinatown class
 * points to Mt Pleasant and back), then the rest of the city, sooner dates
 * first. Where a class runs is where its dates are. A product with no dates
 * (a pot, clay) gets no automatic picks. Pure: data.ts loads the inputs.
 */

/** A class date as the rule needs it; `sellable` — isSellable() of the date. */
export type DateAt = { product: number; studio: number; startsAt: string | null; sellable: boolean };
/** A studio the visitor may see, with the city of its address. */
export type StudioCity = { id: number; city: string };

export const RECOMMEND_LIMIT = 4;

const time = (iso: string | null) => (iso ? new Date(iso).getTime() : Number.POSITIVE_INFINITY);

export function recommend(input: {
  product: number;
  picked?: number[];
  dates: DateAt[];
  studios: StudioCity[];
  visible: ReadonlySet<number>;
  limit?: number;
}): number[] {
  const { product, dates, visible, limit = RECOMMEND_LIMIT } = input;
  const shown = (id: number) => id !== product && visible.has(id);

  const picked = [...new Set(input.picked || [])].filter(shown);
  if (picked.length) return picked.slice(0, limit);

  const cityOf = new Map(input.studios.filter((s) => s.city).map((s) => [s.id, s.city]));
  const placed = dates.filter((d) => cityOf.has(d.studio));
  const home = new Set(placed.filter((d) => d.product === product).map((d) => d.studio));
  const cities = new Set([...home].map((id) => cityOf.get(id)));
  if (!cities.size) return [];

  // Per candidate: does it run at another studio of the city, and its soonest date there (else anywhere in the city).
  const best = new Map<number, { elsewhere: boolean; at: number }>();
  for (const d of placed) {
    if (!d.sellable || !shown(d.product) || !cities.has(cityOf.get(d.studio))) continue;
    const elsewhere = !home.has(d.studio);
    const at = time(d.startsAt);
    const was = best.get(d.product);
    if (!was || (elsewhere && !was.elsewhere) || (elsewhere === was.elsewhere && at < was.at)) best.set(d.product, { elsewhere, at });
  }
  return [...best]
    .sort(([a, x], [b, y]) => Number(y.elsewhere) - Number(x.elsewhere) || x.at - y.at || a - b)
    .map(([id]) => id)
    .slice(0, limit);
}
