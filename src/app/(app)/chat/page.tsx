import { redirect } from "next/navigation";
import { getCurrentUser, isProUser } from "@/lib/user";
import { ChatClient } from "./chat-client";

export const metadata = {
  title: "Chat — ISE Simulator",
  description: "Your English tutor: grammar, vocabulary, exam tips and, with Pro, advice based on your own results.",
};

export default async function ChatPage({ searchParams }: { searchParams: Promise<{ photos?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  const params = await searchParams;
  const isPro = isProUser(user);

  return (
    <ChatClient
      isPro={isPro}
      firstName={user.name?.split(/\s+/)[0] ?? null}
      startWithPhotos={isPro && params.photos === "1"}
    />
  );
}
