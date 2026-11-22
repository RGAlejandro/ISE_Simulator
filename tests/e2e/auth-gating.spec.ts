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
    "/vocabulary/reading",
    "/vocabulary/reading/sample-id",
    "/vocabulary/review",
    "/writing",
    "/writing/sample-id",
    "/exam/oral/live/sample-id",
    "/readiness",
    "/teams",
    "/teams/sample-id",
    "/teams/join/ABCDEFGH",
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

/** Live Examiner and Teams APIs must never mint Gemini credentials or touch data without a session. */
test.describe("Auth gating (live examiner + teams APIs)", () => {
  const ENDPOINTS = [
    "/api/exam/oral/live/session",
    "/api/exam/oral/live/sample-id/token",
    "/api/exam/oral/live/sample-id/finish",
    "/api/teams",
    "/api/teams/join",
    "/api/teams/sample-id/assignments",
    "/api/teams/sample-id/lesson",
  ];
  for (const path of ENDPOINTS) {
    test(`unauth POST ${path} is rejected`, async ({ request }) => {
      const res = await request.post(path, { data: {}, maxRedirects: 0 });
      const body = await res.text();
      // Clerk's protect() answers API calls with 401/404, or redirects to sign-in.
      expect([401, 403, 404, 307, 308].includes(res.status()), `status ${res.status()}`).toBeTruthy();
      expect(body).not.toContain("auth_tokens/");
    });
  }
});

test.describe("Auth gating (personal tutor)", () => {
  test("unauth JSON POST /api/chat is rejected", async ({ request }) => {
    const res = await request.post("/api/chat", {
      data: { messages: [{ role: "user", content: "Analyse my weak spots" }] },
      maxRedirects: 0,
    });
    expect([401, 403, 404, 307, 308].includes(res.status()), `status ${res.status()}`).toBeTruthy();
    expect(await res.text()).not.toContain("student_data");
  });

  test("unauth multipart POST /api/chat with a photo is rejected", async ({ request }) => {
    const res = await request.post("/api/chat", {
      multipart: {
        messages: JSON.stringify([{ role: "user", content: "Make a list" }]),
        photos: { name: "cards.jpg", mimeType: "image/jpeg", buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]) },
      },
      maxRedirects: 0,
    });
    expect([401, 403, 404, 307, 308].includes(res.status()), `status ${res.status()}`).toBeTruthy();
  });

  test("unauth POST /api/vocabulary/lists/bulk is rejected", async ({ request }) => {
    const res = await request.post("/api/vocabulary/lists/bulk", {
      data: { name: "x", words: [{ english: "thorough", spanish: "minucioso" }] },
      maxRedirects: 0,
    });
    expect([401, 403, 404, 307, 308].includes(res.status()), `status ${res.status()}`).toBeTruthy();
  });
});
