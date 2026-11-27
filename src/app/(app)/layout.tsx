import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { getCurrentUser, isProUser } from "@/lib/user";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Public routes in this group (e.g. /pricing) must not 500 when Clerk can't resolve a session.
  const user = await getCurrentUser().catch(() => null);
  return (
    <>
      <Navbar isAdmin={user?.plan === "ADMIN"} isPro={user ? isProUser(user) : undefined} />
      {/* overflow-x-clip: the sheet slides in from the side without a horizontal scrollbar. */}
      <main className="flex-1 overflow-x-clip bg-zinc-50 dark:bg-zinc-950">{children}</main>
      <Footer />
    </>
  );
}
