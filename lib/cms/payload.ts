/**
 * The one way to the Payload instance for code that runs outside a page
 * render: the booking, cart, payments and mail modules, the cron, the scripts
 * and the unit tests. Loaded lazily, so the config — which reads the
 * environment when it is imported — is read only when first needed; the unit
 * tests on a throw-away database set their variables first and rely on that
 * order. No `server-only` here: the collections, which the config imports,
 * import the booking code that calls this, and a static import of the config
 * would close that circle. `getPayload` caches the instance itself, so every
 * call after the first is free. Page code imports the same function as
 * `getCMS` of lib/cms/resolve.
 */
import type { Payload } from "payload";

export async function getCMS(): Promise<Payload> {
  const [{ getPayload }, { default: config }] = await Promise.all([import("payload"), import("../../payload.config")]);
  return getPayload({ config });
}
