import { test, expect } from "@playwright/test";

test.describe("Tips & Guides page", () => {
  test("renders hero + 6 section cards", async ({ page }) => {
    await page.goto("/tips");

    // Hero title
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    // 6 sections (slugs hard-coded in tips-client.tsx)
    const slugs = [
      "reading-tasks",
      "reading-into-writing",
      "extended-writing",
      "oral-topic",
      "oral-conversation",
      "exam-strategy",
    ];
    for (const slug of slugs) {
      await expect(page.locator(`#${slug}`)).toBeVisible();
    }
  });

  test("filter pill 'Reading' hides non-reading sections", async ({ page }) => {
    await page.goto("/tips");

    // Click the Reading filter (use the chip in sticky bar, not a heading)
    const readingPill = page.getByRole("button", { name: /^Reading · \d+$|^Lectura · \d+$|^Lecture · \d+$/i }).first();
    await readingPill.click();

    // Reading section still visible
    await expect(page.locator("#reading-tasks")).toBeVisible();

    // Oral conversation section should not be present in the DOM after filter
    await expect(page.locator("#oral-conversation")).toHaveCount(0);
  });

  test("examiner quote + bottom CTA visible when no filter applied", async ({ page }) => {
    await page.goto("/tips");

    await expect(
      page.getByText(/From an ISE Examiner|De un examinador|D'un examinateur/i),
    ).toBeVisible();

    await expect(
      page.getByRole("link", { name: /Start a Full Exam|examen completo|examen complet/i }).first(),
    ).toBeVisible();
  });
});
