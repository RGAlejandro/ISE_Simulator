import { getCurrentUser, isProUser } from "@/lib/user";
import { PricingClient } from "./pricing-client";

export const metadata = { title: "Pricing — ISE Simulator" };

export default async function PricingPage({ searchParams }: { searchParams: Promise<{ canceled?: string }> }) {
  const { canceled } = await searchParams;
  const user = await getCurrentUser();
  const sub = user?.subscription;
  return (
    <PricingClient
      signedIn={!!user}
      isPro={isProUser(user)}
      isAdmin={user?.plan === "ADMIN"}
      renewsAt={sub?.status === "ACTIVE" && sub.currentPeriodEnd ? sub.currentPeriodEnd.toISOString() : null}
      canceled={canceled === "1"}
      testMode={(process.env.STRIPE_SECRET_KEY ?? "").startsWith("sk_test_")}
    />
  );
}
