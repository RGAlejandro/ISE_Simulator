import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E config for ISE Simulator.
 *
 * - Auto-starts dev server (next dev on :3000) before running tests
 * - Tests covering: public flows (landing, pricing, tips, i18n)
 * - Auth-protected flows currently SKIPPED — require Clerk test mode setup
 * - 3 projects: desktop Chrome, mobile iPhone 15, tablet iPad portrait
 *
 * Run:
 *   npm run test:e2e             — headless run all projects
 *   npm run test:e2e:ui          — interactive UI
 *   npm run test:e2e:headed      — see browser
 *   npm run test:e2e:install     — install Chromium (first time only)
 */
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // Retries help mitigate Clerk dev-instance rate limiting (429 "too_many_requests") under load.
  retries: 2,
  // Cap concurrency to avoid hitting Clerk dev rate limits when running all 3 projects together.
  workers: process.env.CI ? 2 : 2,
  reporter: process.env.CI ? "github" : [["html", { open: "never" }], ["list"]],

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    locale: "en-US",
    timezoneId: "Europe/Madrid",
  },

  projects: [
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
    {
      name: "mobile-iphone15",
      // Real iPhone 15 dimensions: 393×852 @ 3x. Use chromium to avoid needing webkit install.
      use: {
        ...devices["iPhone 15"],
        browserName: "chromium",
        defaultBrowserType: "chromium",
      },
    },
    {
      name: "tablet-ipad",
      use: {
        ...devices["iPad (gen 7)"],
        browserName: "chromium",
        defaultBrowserType: "chromium",
      },
    },
  ],

  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
    stdout: "ignore",
    stderr: "pipe",
  },
});
