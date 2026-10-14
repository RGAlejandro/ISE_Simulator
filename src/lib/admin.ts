import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/user";

export async function getAdminUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (user.plan !== "ADMIN") redirect("/dashboard");
  return user;
}

export async function isAdminUser() {
  try {
    const user = await getCurrentUser();
    return user?.plan === "ADMIN";
  } catch {
    // Public routes inside (app) layout (e.g. /pricing for unauth visitors) shouldn't 500
    // just because Clerk couldn't resolve a session. Treat as "not admin".
    return false;
  }
}
