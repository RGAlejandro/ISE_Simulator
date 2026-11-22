"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, ShieldCheck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/i18n/language-provider";

interface Props {
  code: string;
  team: { name: string; owner: string; level: string; alreadyMember: boolean } | null;
}

export function JoinClient({ code, team }: Props) {
  const { dict, t } = useI18n();
  const tm = dict.teams;
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const join = async () => {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/teams/join", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
    if (!res.ok) {
      setBusy(false);
      return setError((await res.json().catch(() => ({}))).error ?? "Error");
    }
    router.push("/dashboard");
  };

  return (
    <div className="paper-bg grid min-h-[calc(100dvh-4rem)] place-items-center px-4 py-10">
      <div className="w-full max-w-md space-y-5 rounded-3xl border border-zinc-200 bg-white p-6 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900">
          <Users className="h-5 w-5" />
        </div>
        {!team ? (
          <>
            <p className="text-zinc-700 dark:text-zinc-300">{tm.inviteInvalid}</p>
            <Button asChild variant="outline"><Link href="/teams">{tm.back}</Link></Button>
          </>
        ) : (
          <>
            <div className="space-y-1">
              <h1 className="font-display text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{t("teams.joinTitle", { team: team.name })}</h1>
              <p className="text-sm text-zinc-500">{t("teams.joinBy", { name: team.owner, level: team.level })}</p>
            </div>
            <p className="flex items-start gap-2 rounded-xl bg-zinc-50 p-3 text-left text-sm text-zinc-700 ring-1 ring-zinc-200 dark:bg-zinc-800/50 dark:text-zinc-300 dark:ring-zinc-700">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#0ca30c]" />
              {tm.joinPrivacy}
            </p>
            {team.alreadyMember ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">{tm.alreadyMember}</p>
            ) : (
              <Button onClick={join} disabled={busy} className="w-full gap-2">
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {busy ? tm.joining : tm.join}
              </Button>
            )}
            {error && <p className="text-sm text-[#d03b3b]">{error}</p>}
          </>
        )}
      </div>
    </div>
  );
}
