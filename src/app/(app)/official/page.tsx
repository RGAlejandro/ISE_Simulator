import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, isProUser } from "@/lib/user";
import { OfficialHomeClient } from "./official-home-client";

export const metadata = { title: "Official paper — ISE Simulator" };

export default async function OfficialPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  const papers = await prisma.officialPaper.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, title: true, level: true, status: true, score: true, createdAt: true },
  });
  return (
    <OfficialHomeClient
      isPro={isProUser(user)}
      papers={papers.map((p) => ({ ...p, createdAt: p.createdAt.toISOString() }))}
    />
  );
}
