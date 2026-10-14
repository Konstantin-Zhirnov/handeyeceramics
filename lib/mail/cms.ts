/**
 * The Payload instance for code that runs outside a page render: emails,
 * tracking, cron. Loaded lazily, so the config — which reads the environment
 * when it is imported — is read only when first needed; the unit tests on a
 * throw-away database rely on that order. `getCMS()` of lib/cms/resolve is
 * `server-only` and alias-bound, so it cannot be imported from code that is
 * unit-tested under vitest; `getPayload` caches the instance all the same.
 */
import type { Payload } from "payload";

export async function cms(): Promise<Payload> {
  const [{ getPayload }, { default: config }] = await Promise.all([import("payload"), import("../../payload.config")]);
  return getPayload({ config });
}
