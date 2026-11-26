import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";

export type BillingPlan = "monthly" | "yearly";

const LOOKUP_KEY: Record<BillingPlan, string> = { monthly: "pro_monthly", yearly: "pro_yearly" };
const ENV_PRICE: Record<BillingPlan, string | undefined> = {
  monthly: process.env.STRIPE_PRO_MONTHLY_PRICE_ID,
  yearly: process.env.STRIPE_PRO_YEARLY_PRICE_ID,
};

/**
 * The Stripe price for a plan, decided on the server (the browser only says
 * "monthly" or "yearly"). Env first; else the price's lookup key in Stripe.
 */
export async function resolvePriceId(plan: BillingPlan): Promise<string | null> {
  const fromEnv = ENV_PRICE[plan];
  if (fromEnv && /^price_[A-Za-z0-9]{14,}$/.test(fromEnv)) return fromEnv;
  const found = await getStripe().prices.list({ lookup_keys: [LOOKUP_KEY[plan]], active: true, limit: 1 });
  return found.data[0]?.id ?? null;
}

/** End of the paid period. Newer API versions keep it on the subscription item. */
export function periodEnd(subscription: Stripe.Subscription): Date {
  const s = subscription as unknown as { current_period_end?: number; items?: { data?: { current_period_end?: number }[] } };
  const ts = s.current_period_end ?? s.items?.data?.[0]?.current_period_end;
  return ts ? new Date(ts * 1000) : new Date(Date.now() + 31 * 24 * 60 * 60 * 1000);
}

/** Record an active Pro subscription for a user (idempotent). */
export async function activateSubscription(userId: string, customerId: string, subscriptionId: string): Promise<void> {
  const subscription = (await getStripe().subscriptions.retrieve(subscriptionId)) as unknown as Stripe.Subscription;
  const data = {
    stripeSubscriptionId: subscription.id,
    stripePriceId: subscription.items.data[0]?.price.id ?? null,
    plan: "PRO" as const,
    status: "ACTIVE" as const,
    currentPeriodEnd: periodEnd(subscription),
  };
  await prisma.subscription.upsert({
    where: { userId },
    create: { userId, stripeCustomerId: customerId, ...data },
    update: { stripeCustomerId: customerId, ...data },
  });
  // An admin stays admin: Pro is already included.
  await prisma.user.updateMany({ where: { id: userId, plan: { not: "ADMIN" } }, data: { plan: "PRO" } });
}

/**
 * Back from Stripe Checkout: verify the session with Stripe and activate Pro
 * straight away, without waiting for the webhook (which can't reach localhost
 * and may arrive late). The session must belong to this user.
 */
export async function confirmCheckoutSession(sessionId: string, userId: string): Promise<"active" | "pending" | "invalid"> {
  if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return "invalid";
  let session: Stripe.Checkout.Session;
  try {
    session = await getStripe().checkout.sessions.retrieve(sessionId);
  } catch {
    return "invalid";
  }
  if (session.metadata?.userId !== userId || session.mode !== "subscription") return "invalid";
  if (session.status !== "complete" || !session.subscription || !session.customer) return "pending";
  await activateSubscription(
    userId,
    typeof session.customer === "string" ? session.customer : session.customer.id,
    typeof session.subscription === "string" ? session.subscription : session.subscription.id,
  );
  return "active";
}
