type Env = Partial<Record<"NEXT_PUBLIC_SERVER_URL" | "SITE_ENV" | "NODE_ENV" | "NEXT_PHASE" | "PORT", string | undefined>>;

/** Written out one by one: Next puts `process.env.NEXT_PUBLIC_*` into browser code only when it is spelled in full. */
const current = (): Env => ({
  NEXT_PUBLIC_SERVER_URL: process.env.NEXT_PUBLIC_SERVER_URL,
  SITE_ENV: process.env.SITE_ENV,
  NODE_ENV: process.env.NODE_ENV,
  NEXT_PHASE: process.env.NEXT_PHASE,
  PORT: process.env.PORT,
});

/**
 * The address the site is served from: canonical links, the sitemap, JSON-LD
 * and the redirect table all hang on it. Locally it falls back to this
 * machine. A production server without NEXT_PUBLIC_SERVER_URL does not start:
 * a guessed address would silently switch the redirects off and print
 * somebody else's address into canonical links. The build itself may run
 * without it — nothing of the address is baked into the build.
 */
export function serverURL(env: Env = current()): string {
  const configured = (env.NEXT_PUBLIC_SERVER_URL || "").trim().replace(/\/+$/, "");
  if (configured) return configured;
  const production = env.SITE_ENV === "production" || env.NODE_ENV === "production";
  const building = env.NEXT_PHASE === "phase-production-build";
  if (production && !building && typeof window === "undefined") {
    throw new Error(
      "NEXT_PUBLIC_SERVER_URL is not set. A production server needs the public address of the site " +
        "(for example https://example.com): redirects, canonical links and the sitemap are built from it. " +
        "Set it in the environment and start again.",
    );
  }
  return `http://localhost:${env.PORT || 3210}`;
}
