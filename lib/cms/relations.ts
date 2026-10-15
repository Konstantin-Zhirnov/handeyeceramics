/**
 * A relationship field as Payload hands it back: the id at depth 0, the whole
 * document when populated. `relId` gives the id either way, undefined for an
 * empty field — so code that reads orders, sessions and registrations at any
 * depth has one spelling of the question.
 */
export const relId = (v: number | { id: number } | null | undefined): number | undefined => (typeof v === "object" && v ? v.id : (v ?? undefined));
