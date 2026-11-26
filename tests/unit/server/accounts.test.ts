import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", async () => ({ prisma: (await import("../helpers/prisma")).prismaMock }));
const clerk = vi.hoisted(() => ({ auth: vi.fn(), currentUser: vi.fn() }));
vi.mock("@clerk/nextjs/server", () => clerk);
const nav = vi.hoisted(() => ({ redirect: vi.fn((url: string) => { throw new Error(`REDIRECT ${url}`); }) }));
vi.mock("next/navigation", () => nav);
const stripeApi = vi.hoisted(() => ({
  prices: { list: vi.fn() },
  subscriptions: { retrieve: vi.fn() },
  checkout: { sessions: { retrieve: vi.fn() } },
}));
vi.mock("stripe", () => ({ default: class { constructor(public key: string) {} prices = stripeApi.prices; subscriptions = stripeApi.subscriptions; checkout = stripeApi.checkout; } }));

import { db, resetDb } from "../helpers/prisma";
import { consumeAiAssist, getCurrentUser, getDailyUsage, incrementUsage, isProUser } from "@/lib/user";
import { activateSubscription, confirmCheckoutSession, periodEnd, resolvePriceId } from "@/lib/billing";
import { getAdminUser, isAdminUser } from "@/lib/admin";
import { getStripe } from "@/lib/stripe";

const future = new Date(Date.now() + 86_400_000);
const past = new Date(Date.now() - 86_400_000);

beforeEach(() => {
  resetDb();
  vi.clearAllMocks();
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test");
});

describe("isProUser", () => {
  it("decides Pro from plan and subscription", () => {
    expect(isProUser(null)).toBe(false);
    expect(isProUser({ plan: "ADMIN" })).toBe(true);
    expect(isProUser({ plan: "FREE" })).toBe(false);
    expect(isProUser({ plan: "PRO", subscription: null })).toBe(false);
    expect(isProUser({ plan: "PRO", subscription: { status: "ACTIVE", currentPeriodEnd: null } })).toBe(true);
    // Payment failed: keep access until the paid period ends.
    expect(isProUser({ plan: "PRO", subscription: { status: "PAST_DUE", currentPeriodEnd: future } })).toBe(true);
    expect(isProUser({ plan: "PRO", subscription: { status: "PAST_DUE", currentPeriodEnd: past } })).toBe(false);
    expect(isProUser({ plan: "PRO", subscription: { status: "CANCELED", currentPeriodEnd: future } })).toBe(false);
  });
});

describe("getCurrentUser", () => {
  it("returns null when signed out", async () => {
    clerk.auth.mockResolvedValue({ userId: null });
    expect(await getCurrentUser()).toBeNull();
  });

  it("returns the stored user", async () => {
    clerk.auth.mockResolvedValue({ userId: "clerk_1" });
    db("user", "findUnique").mockResolvedValue({ id: "u1" });
    expect(await getCurrentUser()).toEqual({ id: "u1" });
    expect(clerk.currentUser).not.toHaveBeenCalled();
  });

  it("creates the user on first visit (no webhook needed)", async () => {
    clerk.auth.mockResolvedValue({ userId: "clerk_1" });
    db("user", "findUnique").mockResolvedValue(null);
    clerk.currentUser.mockResolvedValue({ emailAddresses: [{ emailAddress: "a@b.c" }], firstName: "Ana", lastName: null });
    db("user", "upsert").mockResolvedValue({ id: "new" });
    expect(await getCurrentUser()).toEqual({ id: "new" });
    expect(db("user", "upsert").mock.calls[0][0].create).toEqual({ clerkId: "clerk_1", email: "a@b.c", name: "Ana" });
  });

  it("gives up without a Clerk profile or an email", async () => {
    clerk.auth.mockResolvedValue({ userId: "clerk_1" });
    db("user", "findUnique").mockResolvedValue(null);
    clerk.currentUser.mockResolvedValueOnce(null).mockResolvedValueOnce({ emailAddresses: [], firstName: null, lastName: null });
    expect(await getCurrentUser()).toBeNull();
    expect(await getCurrentUser()).toBeNull();
  });
});

describe("daily usage", () => {
  it("applies the free limits and lifts them for Pro", async () => {
    db("user", "findUnique").mockResolvedValue({ plan: "FREE" });
    db("dailyUsage", "findUnique").mockResolvedValue({ writtenCount: 1, oralCount: 0, listeningCount: 9, readingCount: 0, writingCount: 0 });
    db("translationSession", "count").mockResolvedValue(1);
    const free = await getDailyUsage("u1");
    expect(free).toMatchObject({ writtenCount: 1, translationCount: 1, canTakeOral: true, canTakeListening: false, canTakeTranslation: false });

    db("user", "findUnique").mockResolvedValue({ plan: "ADMIN" });
    db("dailyUsage", "findUnique").mockResolvedValue(null);
    const pro = await getDailyUsage("u1");
    expect(pro).toMatchObject({ writtenCount: 0, canTakeListening: true, canTakeTranslation: true });
  });

  it("increments the right counter", async () => {
    for (const [type, field] of [["written", "writtenCount"], ["oral", "oralCount"], ["listening", "listeningCount"], ["reading", "readingCount"], ["writing", "writingCount"], ["chat", "chatCount"]] as const) {
      db("dailyUsage", "upsert").mockClear();
      await incrementUsage("u1", type);
      const arg = db("dailyUsage", "upsert").mock.calls[0][0];
      expect(arg.create[field]).toBe(1);
      expect(arg.update[field]).toEqual({ increment: 1 });
    }
  });

  it("caps small AI helpers per day (Pro gets more)", async () => {
    db("dailyUsage", "upsert").mockResolvedValue({ aiAssistCount: 11 });
    expect(await consumeAiAssist("u1", false)).toBe(false);
    expect(await consumeAiAssist("u1", true)).toBe(true);
    db("dailyUsage", "upsert").mockResolvedValue({ aiAssistCount: 10 });
    expect(await consumeAiAssist("u1", false)).toBe(true);
  });
});

describe("admin", () => {
  it("sends non-admins away", async () => {
    clerk.auth.mockResolvedValue({ userId: null });
    await expect(getAdminUser()).rejects.toThrow("REDIRECT /sign-in");
    clerk.auth.mockResolvedValue({ userId: "c" });
    db("user", "findUnique").mockResolvedValue({ plan: "PRO" });
    await expect(getAdminUser()).rejects.toThrow("REDIRECT /dashboard");
    db("user", "findUnique").mockResolvedValue({ plan: "ADMIN" });
    expect(await getAdminUser()).toEqual({ plan: "ADMIN" });
  });

  it("answers isAdmin without throwing", async () => {
    clerk.auth.mockResolvedValue({ userId: "c" });
    db("user", "findUnique").mockResolvedValue({ plan: "ADMIN" });
    expect(await isAdminUser()).toBe(true);
    clerk.auth.mockRejectedValue(new Error("no session"));
    expect(await isAdminUser()).toBe(false);
  });
});

describe("billing", () => {
  it("creates the Stripe client once, with the key", () => {
    expect(getStripe()).toBe(getStripe());
  });

  it("resolves the price from env or the lookup key", async () => {
    vi.stubEnv("STRIPE_PRO_MONTHLY_PRICE_ID", "");
    stripeApi.prices.list.mockResolvedValue({ data: [{ id: "price_lookup" }] });
    expect(await resolvePriceId("monthly")).toBe("price_lookup");
    stripeApi.prices.list.mockResolvedValue({ data: [] });
    expect(await resolvePriceId("yearly")).toBeNull();
    expect(stripeApi.prices.list.mock.calls[1][0]).toMatchObject({ lookup_keys: ["pro_yearly"] });
  });

  it("reads the period end from the subscription or its item", () => {
    expect(periodEnd({ current_period_end: 1_800_000_000 } as never).getTime()).toBe(1_800_000_000_000);
    expect(periodEnd({ items: { data: [{ current_period_end: 1_700_000_000 }] } } as never).getTime()).toBe(1_700_000_000_000);
    expect(periodEnd({} as never).getTime()).toBeGreaterThan(Date.now());
  });

  it("activates Pro without demoting admins", async () => {
    stripeApi.subscriptions.retrieve.mockResolvedValue({ id: "sub_1", items: { data: [{ price: { id: "price_1" } }] }, current_period_end: 1_800_000_000 });
    await activateSubscription("u1", "cus_1", "sub_1");
    expect(db("subscription", "upsert").mock.calls[0][0].create).toMatchObject({ userId: "u1", stripeCustomerId: "cus_1", stripeSubscriptionId: "sub_1", stripePriceId: "price_1", status: "ACTIVE" });
    expect(db("user", "updateMany").mock.calls[0][0]).toEqual({ where: { id: "u1", plan: { not: "ADMIN" } }, data: { plan: "PRO" } });
  });

  it("confirms a checkout only for its own user", async () => {
    expect(await confirmCheckoutSession("bad id", "u1")).toBe("invalid");
    stripeApi.checkout.sessions.retrieve.mockRejectedValueOnce(new Error("no such session"));
    expect(await confirmCheckoutSession("cs_test_1", "u1")).toBe("invalid");
    stripeApi.checkout.sessions.retrieve.mockResolvedValueOnce({ metadata: { userId: "someone" }, mode: "subscription" });
    expect(await confirmCheckoutSession("cs_test_1", "u1")).toBe("invalid");
    stripeApi.checkout.sessions.retrieve.mockResolvedValueOnce({ metadata: { userId: "u1" }, mode: "subscription", status: "open" });
    expect(await confirmCheckoutSession("cs_test_1", "u1")).toBe("pending");
    stripeApi.checkout.sessions.retrieve.mockResolvedValueOnce({ metadata: { userId: "u1" }, mode: "subscription", status: "complete", customer: { id: "cus_1" }, subscription: { id: "sub_1" } });
    stripeApi.subscriptions.retrieve.mockResolvedValue({ id: "sub_1", items: { data: [] } });
    expect(await confirmCheckoutSession("cs_test_1", "u1")).toBe("active");
    expect(stripeApi.subscriptions.retrieve).toHaveBeenCalledWith("sub_1");
  });
});

describe("stripe client", () => {
  it("needs a secret key", async () => {
    vi.resetModules();
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    const fresh = await import("@/lib/stripe");
    expect(() => fresh.getStripe()).toThrow(/STRIPE_SECRET_KEY/);
  });
});
