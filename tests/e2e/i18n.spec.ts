import { test, expect } from "@playwright/test";

/**
 * Verify language toggle switches across en/es/fr and persists.
 * Provider: src/components/i18n/language-provider.tsx (localStorage key: "ise-locale")
 */
test.describe("Language toggle (i18n)", () => {
  test.beforeEach(async ({ page, context }) => {
    // Start clean — clear any persisted locale before each run
    await context.clearCookies();
    await page.goto("/");
    await page.evaluate(() => window.localStorage.removeItem("ise-locale"));
  });

  test("default locale is en, document.lang updates", async ({ page }) => {
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });

  test("switching to Español updates UI + persists", async ({ page }) => {
    await page.goto("/");

    // Click the language flag button (uses Languages icon + flag emoji)
    await page.getByRole("button", { name: /Language \/ Idioma/i }).click();
    await page.getByRole("menuitem", { name: /Español/i }).click();

    await expect(page.locator("html")).toHaveAttribute("lang", "es");

    // localStorage was written
    const stored = await page.evaluate(() => window.localStorage.getItem("ise-locale"));
    expect(stored).toBe("es");

    // Page-level content switches to Spanish (hero heading + CTA — visible on every viewport)
    await expect(page.getByRole("heading", { name: /Domina el Trinity ISE/i })).toBeVisible();
  });

  test("switching to Français updates UI", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: /Language \/ Idioma/i }).click();
    await page.getByRole("menuitem", { name: /Français/i }).click();

    await expect(page.locator("html")).toHaveAttribute("lang", "fr");

    await expect(page.getByRole("heading", { name: /Maîtrisez le Trinity ISE/i })).toBeVisible();
  });

  test("locale persists after reload", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => window.localStorage.setItem("ise-locale", "es"));
    await page.reload();

    await expect(page.locator("html")).toHaveAttribute("lang", "es");
  });
});
