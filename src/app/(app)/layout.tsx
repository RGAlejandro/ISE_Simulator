import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { isAdminUser } from "@/lib/admin";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const isAdmin = await isAdminUser();
  return (
    <>
      <Navbar isAdmin={isAdmin} />
      {/* overflow-x-clip: the sheet slides in from the side without a horizontal scrollbar. */}
      <main className="flex-1 overflow-x-clip bg-zinc-50 dark:bg-zinc-950">{children}</main>
      <Footer />
    </>
  );
}
