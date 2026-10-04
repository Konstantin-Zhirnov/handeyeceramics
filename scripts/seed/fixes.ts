/**
 * Whether this seed writes content/seo-fixes.md. A seed of a throw-away database
 * (the how-to videos, the site tests) sets SEED_FIXES=0, so that it does not
 * rewrite the report in the working tree.
 */
export function writesFixes(env: NodeJS.ProcessEnv): boolean {
  return env.SEED_FIXES !== "0";
}
