import { redirect } from "next/navigation";
import { getCurrentUser, isProUser } from "@/lib/user";
import { confirmCheckoutSession } from "@/lib/billing";
import { SuccessClient } from "./success-client";

export const metadata = { title: "Welcome to Pro — ISE Simulator" };

/** Back from Stripe Checkout: confirm the payment with Stripe and switch Pro on now. */
export default async function PricingSuccessPage({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  const { session_id } = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  // Already Pro (e.g. the client refresh right after activation): no need to ask Stripe again.
  const result = isProUser(user)
    ? "active"
    : session_id ? await confirmCheckoutSession(session_id, user.id).catch(() => "invalid" as const) : "invalid";
  return <SuccessClient result={result} />;
}
