import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/user";
import { GrammarClient } from "./grammar-client";

export default async function GrammarPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  return <GrammarClient />;
}
