import { test, expect } from "@playwright/test";

/**
 * Mobile-specific checks. Run via the `mobile-iphone15` project.
 * These assertions are most meaningful in that viewport (393×852) — they will still
 * pass on desktop but the bug they catch only shows on small screens.
 */
test.describe("Mobile responsive — public pages", () => {
  const PUBLIC_PATHS = ["/", "/pricing", "/tips"];

  for (const path of PUBLIC_PATHS) {
    test(`no horizontal overflow at ${path}`, async ({ page }) => {
      await page.goto(path);

      const overflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth - document.documentElement.clientWidth;
      });
      expect(overflow, `Horizontal overflow detected at ${path}`).toBeLessThanOrEqual(2);
    });
  }

  test("mobile menu toggle opens nav drawer on landing", async ({ page, isMobile, viewport }) => {
    // Drawer toggle only exists at viewport < md (768px). iPad portrait (810w) hides it.
    test.skip(!isMobile || (viewport?.width ?? 0) >= 768, "Mobile drawer only renders below md breakpoint");
    await page.goto("/");

    // Toggle menu button (aria-label / lucide Menu icon)
    await page.getByRole("button", { name: /Toggle menu/i }).click();

    // Mobile drawer (md:hidden) reveals links — scope to the drawer, not the hidden desktop nav
    const drawer = page.locator("header .md\\:hidden").last();
    await expect(drawer.getByText(/Pricing|Precios|Tarifs/).first()).toBeVisible();
  });

  test("language toggle dropdown opens on mobile", async ({ page, isMobile }) => {
    test.skip(!isMobile, "Only relevant on mobile viewports");
    await page.goto("/");

    await page.getByRole("button", { name: /Language \/ Idioma/i }).click();
    await expect(page.getByRole("menu")).toBeVisible();
  });
});
