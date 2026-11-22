import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, getDailyUsage } from "@/lib/user";
import type { TranslationItem, TranslationResult } from "@/lib/translation";
import { TranslationSessionClient } from "./translation-session-client";

export const metadata = { title: "Translation — ISE Simulator" };

export default async function TranslationSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const session = await prisma.translationSession.findUnique({ where: { id } });
  if (!session || session.userId !== user.id) redirect("/translation");
  const usage = await getDailyUsage(user.id);

  return (
    <TranslationSessionClient
      id={session.id}
      level={session.level}
      items={session.items as unknown as TranslationItem[]}
      initialAnswers={(session.answers ?? {}) as unknown as Record<string, TranslationResult>}
      canStartAnother={usage.canTakeTranslation}
    />
  );
}
