import { defineConfig } from "vitest/config";

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
        },
      },
    ],
  },
});
