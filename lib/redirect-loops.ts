/**
 * The one rule for redirect chains from the admin, shared by proxy.ts (301
 * before render) and resolvePath (the page router): a rule whose chain comes
 * back to where it started (A → B → A) is not applied anywhere.
 */
export function withoutLoops(map: Map<string, string>): Map<string, string> {
  const out = new Map(map);
  for (const from of map.keys()) {
    let at = map.get(from);
    for (let step = 0; at !== undefined && step <= map.size; step++) {
      if (at === from) {
        out.delete(from);
        break;
      }
      at = map.get(at);
    }
  }
  return out;
}
