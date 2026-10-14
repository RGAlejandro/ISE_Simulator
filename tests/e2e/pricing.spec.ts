import { test, expect } from "@playwright/test";

test.describe("Pricing page", () => {
  test("renders 3 plans with correct prices", async ({ page }) => {
    await page.goto("/pricing");

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    // All 3 prices visible
    await expect(page.getByText(/\$0/)).toBeVisible();
    await expect(page.getByText(/\$9\.99/)).toBeVisible();
    await expect(page.getByText(/\$89\.99/)).toBeVisible();

    // "Most Popular" badge on the highlighted plan
    await expect(page.getByText(/Most Popular|M[áa]s popular|Le plus populaire/)).toBeVisible();
  });

  test("Free plan CTA is 'Get Started Free'", async ({ page }) => {
    await page.goto("/pricing");
    await expect(
      page.getByRole("button", { name: /Get Started Free|Empezar gratis|Commencer gratuitement/i }),
    ).toBeVisible();
  });

  test("Pro plans show Subscribe buttons", async ({ page }) => {
    await page.goto("/pricing");
    const subs = page.getByRole("button", { name: /Subscribe|Suscribirse|S'abonner/i });
    await expect(subs).toHaveCount(2);
  });
});
