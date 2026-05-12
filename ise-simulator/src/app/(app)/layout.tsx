import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { ChatBot } from "@/components/ui/chatbot";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <main className="flex-1 bg-zinc-50 dark:bg-zinc-950">{children}</main>
      <Footer />
      <ChatBot />
    </>
  );
}
