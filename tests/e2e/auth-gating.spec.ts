import { test, expect } from "@playwright/test";

/**
 * Verifies the Clerk middleware (src/proxy.ts) correctly redirects
 * unauthenticated users away from protected routes.
 *
 * NOTE: Full authenticated flows require Clerk test mode (env: CLERK_TEST_MODE + a test user).
 * Those flows are scoped to a future iteration.
 */
test.describe("Auth gating (protected routes)", () => {
  const PROTECTED = [
    "/dashboard",
    "/exam/written/sample-id",
    "/exam/oral/setup",
    "/results/sample-id",
    "/admin",
    "/admin/users",
    "/exams",
    "/practice",
  ];

  for (const path of PROTECTED) {
    test(`unauth visiting ${path} redirects to sign-in`, async ({ page, context }) => {
      // Ensure no Clerk session cookie carries over
      await context.clearCookies();

      const res = await page.goto(path, { waitUntil: "domcontentloaded" });
      // Either redirect to Clerk's hosted sign-in, an in-app /sign-in, or a 401-style page.
      // We assert: the URL is NOT the protected one (or we land on the sign-in surface).
      const finalUrl = page.url();
      const okRedirect =
        finalUrl.includes("sign-in") ||
        finalUrl.includes("accounts.dev") || // Clerk dev hosted
        finalUrl.includes("clerk") ||
        res?.status() === 401;
      expect(
        okRedirect,
        `Expected redirect away from ${path} when unauthenticated, ended at ${finalUrl}`,
      ).toBeTruthy();
    });
  }
});
