"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useI18n } from "@/components/i18n/language-provider";

/** Shown when an admin opens a learner's result or text in read-only mode. */
export function ProfileViewingBanner({ name, userId }: { name: string; userId: string }) {
  const { t } = useI18n();
  return (
    <div className="border-b border-rule bg-paper">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-2 sm:px-6 lg:px-8">
        <p className="font-hand text-xl leading-none text-pen">{t("adminProfile.banner", { name })}</p>
        <Link href={`/admin/users/${userId}`} className="inline-flex items-center gap-1 text-sm font-medium text-ink underline decoration-rule decoration-2 underline-offset-4 hover:decoration-marker">
          <ArrowLeft className="h-3.5 w-3.5" /> {t("adminProfile.backToProfile", { name })}
        </Link>
      </div>
    </div>
  );
}
