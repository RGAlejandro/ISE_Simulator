import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/user";

export async function getAdminUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (user.plan !== "ADMIN") redirect("/dashboard");
  return user;
}

export async function isAdminUser() {
  const user = await getCurrentUser();
  return user?.plan === "ADMIN";
}
