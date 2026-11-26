import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Unit and integration tests (Vitest). The browser flows are covered by the
 * Playwright suite in tests/e2e.
 *
 *   npm test               — run once
 *   npm run test:watch     — re-run on change
 *   npm run test:coverage  — run with coverage; fails under the thresholds
 */
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    restoreMocks: true,
    unstubEnvs: true,
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.ts", "src/store/**/*.ts", "src/i18n/index.ts"],
      reporter: ["text-summary", "text", "html", "lcov"],
      reportsDirectory: "coverage",
      // The build fails if coverage drops below this (regression guard).
      thresholds: { lines: 80, statements: 80, functions: 80, branches: 80 },
    },
  },
});
