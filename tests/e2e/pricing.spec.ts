import { test, expect } from "@playwright/test";

test.describe("Pricing page", () => {
  test("renders 3 plans with correct prices", async ({ page }) => {
    await page.goto("/pricing");

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    // All 3 prices visible (euros; the yearly price may be written 89,99 € in es/fr)
    await expect(page.getByText(/(€\s?0|\b0\s?€)(?![.,\d])/).first()).toBeVisible();
    await expect(page.getByText(/9[.,]99/).first()).toBeVisible();
    await expect(page.getByText(/89[.,]99/).first()).toBeVisible();

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
