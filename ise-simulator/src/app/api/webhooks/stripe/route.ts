import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import Stripe from "stripe";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const headerPayload = await headers();
  const sig = headerPayload.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

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
          currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
        },
        update: {
          stripeSubscriptionId: subscription.id,
          stripePriceId: subscription.items.data[0].price.id,
          plan: "PRO",
          status: "ACTIVE",
          currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
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

      const status = subscription.status === "active" ? "ACTIVE"
        : subscription.status === "past_due" ? "PAST_DUE"
        : "CANCELED";

      await prisma.subscription.update({
        where: { stripeSubscriptionId: subscription.id },
        data: {
          status,
          currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
        },
      });

      if (status !== "ACTIVE") {
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
  }

  return NextResponse.json({ received: true });
}
