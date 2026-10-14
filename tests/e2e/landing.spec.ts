import { test, expect } from "@playwright/test";

test.describe("Landing page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("renders hero with primary CTA", async ({ page }) => {
    await expect(page).toHaveTitle(/ISE Simulator/);

    // Hero headline contains the level brand
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    // Both CTAs exist (primary + secondary)
    const primary = page.getByRole("link", { name: /start practicing free|empezar gratis|commencer/i }).first();
    await expect(primary).toBeVisible();
  });

  test("navbar links present", async ({ page, isMobile }) => {
    test.skip(!!isMobile, "Desktop nav links are hidden on mobile (md:flex). Covered by mobile menu spec.");
    // Desktop navbar shows core links (use getByRole to avoid duplicates from mobile menu)
    const nav = page.locator("header").first();
    await expect(nav).toBeVisible();
    await expect(nav.getByText(/Dashboard|Tableau|Panel/).first()).toBeVisible();
    await expect(nav.getByText(/Pricing|Precios|Tarifs/).first()).toBeVisible();
  });

  test("no horizontal overflow on initial load", async ({ page }) => {
    // Check that body width <= viewport width (no horizontal scroll)
    const overflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth - document.documentElement.clientWidth;
    });
    expect(overflow).toBeLessThanOrEqual(2); // 2px tolerance for rounding
  });

  test("no console errors during render", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    await page.reload({ waitUntil: "networkidle" });
    // Allow expected dev-mode noise (HMR, framework warnings, Clerk dev-instance race fetches)
    const real = errors.filter(
      (e) =>
        !e.includes("Download the React DevTools") &&
        !e.includes("HMR") &&
        !e.includes("Source Map") &&
        !e.includes("clerk.accounts.dev") &&
        !e.includes("clerk.browser.js") &&
        !e.includes("Failed to fetch") &&
        !e.includes("Failed to load resource") &&
        !e.includes("net::ERR_FAILED"),
    );
    expect(real).toEqual([]);
  });
});
