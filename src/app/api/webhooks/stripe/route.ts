import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import Stripe from "stripe";
import type { SubscriptionStatus } from "@prisma/client";

function mapStripeStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  switch (status) {
    case "active":
    case "trialing":
      return "ACTIVE";
    case "past_due":
    case "unpaid":
      return "PAST_DUE";
    default:
      return "CANCELED";
  }
}

function periodEnd(subscription: Stripe.Subscription): Date {
  const ts = (subscription as unknown as { current_period_end?: number }).current_period_end;
  return ts ? new Date(ts * 1000) : new Date();
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const headerPayload = await headers();
  const sig = headerPayload.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[stripe-webhook] STRIPE_WEBHOOK_SECRET is not configured");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Idempotency: skip events we already processed (Stripe retries deliveries).
  const alreadyProcessed = await prisma.processedWebhookEvent.findUnique({
    where: { id: event.id },
  });
  if (alreadyProcessed) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    await handleEvent(event);
  } catch (err) {
    // Don't record the event so Stripe redelivers it.
    console.error(`[stripe-webhook] Failed to process ${event.type} (${event.id})`, err);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }

  await prisma.processedWebhookEvent
    .create({ data: { id: event.id } })
    .catch(() => {}); // P2002 = concurrent delivery already recorded it

  return NextResponse.json({ received: true });
}

async function handleEvent(event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      if (!userId) break;

      const subResponse = await getStripe().subscriptions.retrieve(
        session.subscription as string
      );
      const subscription = subResponse as unknown as Stripe.Subscription;

      await prisma.subscription.upsert({
        where: { userId },
        create: {
          userId,
          stripeCustomerId: session.customer as string,
          stripeSubscriptionId: subscription.id,
          stripePriceId: subscription.items.data[0].price.id,
          plan: "PRO",
          status: "ACTIVE",
          currentPeriodEnd: periodEnd(subscription),
        },
        update: {
          stripeSubscriptionId: subscription.id,
          stripePriceId: subscription.items.data[0].price.id,
          plan: "PRO",
          status: "ACTIVE",
          currentPeriodEnd: periodEnd(subscription),
        },
      });

      await prisma.user.update({
        where: { id: userId },
        data: { plan: "PRO" },
      });
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const sub = await prisma.subscription.findUnique({
        where: { stripeSubscriptionId: subscription.id },
      });
      if (!sub) break;

      const status = mapStripeStatus(subscription.status);

      await prisma.subscription.update({
        where: { stripeSubscriptionId: subscription.id },
        data: {
          status,
          currentPeriodEnd: periodEnd(subscription),
        },
      });

      // PAST_DUE keeps the plan during the dunning grace period (entitlement is
      // gated by isProUser, which checks currentPeriodEnd). Only CANCELED downgrades.
      if (status === "CANCELED") {
        await prisma.user.update({
          where: { id: sub.userId },
          data: { plan: "FREE" },
        });
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const sub = await prisma.subscription.findUnique({
        where: { stripeSubscriptionId: subscription.id },
      });
      if (!sub) break;

      await prisma.subscription.update({
        where: { stripeSubscriptionId: subscription.id },
        data: { status: "CANCELED", plan: "FREE" },
      });

      await prisma.user.update({
        where: { id: sub.userId },
        data: { plan: "FREE" },
      });
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId =
        (invoice as unknown as { subscription?: string | null }).subscription;
      if (subscriptionId) {
        await prisma.subscription.updateMany({
          where: { stripeSubscriptionId: subscriptionId },
          data: { status: "PAST_DUE" },
        });
      } else if (typeof invoice.customer === "string") {
        await prisma.subscription.updateMany({
          where: { stripeCustomerId: invoice.customer },
          data: { status: "PAST_DUE" },
        });
      }
      break;
    }
  }
}
