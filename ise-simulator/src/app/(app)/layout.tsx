import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { ChatBot } from "@/components/ui/chatbot";
import { isAdminUser } from "@/lib/admin";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const isAdmin = await isAdminUser();
  return (
    <>
      <Navbar isAdmin={isAdmin} />
      <main className="flex-1 bg-zinc-50 dark:bg-zinc-950">{children}</main>
      <Footer />
      <ChatBot />
    </>
  );
}
