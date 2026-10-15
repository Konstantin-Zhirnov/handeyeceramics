import path from "node:path";
import { defineConfig } from "vitest/config";

const root = import.meta.dirname;

// The aliases of tsconfig.json, plus `server-only` as an empty module: the
// tests import the server code of lib/ and app/ as the site does.
const alias = [
  { find: /^server-only$/, replacement: path.join(root, "tests/unit/stubs/server-only.ts") },
  { find: /^@payload-config$/, replacement: path.join(root, "payload.config.ts") },
  { find: /^@\//, replacement: `${root}/` },
];

// Two projects: fast unit tests, and the site tests that seed a temporary
// SQLite database, start the site on it and walk every URL of the inventory.
export default defineConfig({
  test: {
    fileParallelism: false,
    projects: [
      {
        test: {
          name: "unit",
          include: ["tests/unit/**/*.test.ts"],
          environment: "node",
          alias,
        },
      },
      {
        test: {
          name: "site",
          include: ["tests/site/**/*.test.ts"],
          environment: "node",
          globalSetup: ["tests/site/global-setup.ts"],
          testTimeout: 120_000,
          hookTimeout: 900_000,
          alias,
        },
      },
    ],
  },
});
