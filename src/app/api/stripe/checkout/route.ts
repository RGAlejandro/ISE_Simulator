import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, isProUser } from "@/lib/user";
import { resolvePriceId, type BillingPlan } from "@/lib/billing";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const LOCALES = new Set(["es", "en", "fr"]);

/** Start Stripe Checkout for Pro. The browser picks "monthly" or "yearly"; the price is decided here. */
export async function POST(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return NextResponse.json({ error: "Unauthorized", code: "auth" }, { status: 401 });

    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
    if (isProUser(user)) return NextResponse.json({ error: "Already Pro", code: "already" }, { status: 409 });

    const body = (await req.json().catch(() => ({}))) as { plan?: string; locale?: string };
    const plan: BillingPlan | null = body.plan === "monthly" || body.plan === "yearly" ? body.plan : null;
    if (!plan) return NextResponse.json({ error: "Invalid plan" }, { status: 400 });

    const priceId = await resolvePriceId(plan);
    if (!priceId) {
      console.error(`[checkout] No Stripe price for plan ${plan}`);
      return NextResponse.json({ error: "Plan not available", code: "config" }, { status: 503 });
    }

    // Reuse the Stripe customer from an earlier subscription, if any.
    const existing = await prisma.subscription.findUnique({ where: { userId: user.id }, select: { stripeCustomerId: true } });

    const session = await getStripe().checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${APP_URL}/pricing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${APP_URL}/pricing?canceled=1`,
      client_reference_id: user.id,
      metadata: { userId: user.id },
      subscription_data: { metadata: { userId: user.id } },
      ...(existing?.stripeCustomerId ? { customer: existing.stripeCustomerId } : { customer_email: user.email }),
      allow_promotion_codes: true,
      locale: LOCALES.has(body.locale ?? "") ? (body.locale as "es" | "en" | "fr") : "auto",
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Stripe checkout error:", error);
    return NextResponse.json({ error: "Failed to create checkout" }, { status: 500 });
  }
}
