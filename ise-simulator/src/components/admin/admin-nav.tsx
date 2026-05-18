"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutGrid, Users, FileText, Activity } from "lucide-react";

const TABS = [
  { href: "/admin",          label: "Overview", Icon: LayoutGrid },
  { href: "/admin/users",    label: "Users",    Icon: Users },
  { href: "/admin/exams",    label: "Exams",    Icon: FileText },
  { href: "/admin/activity", label: "Activity", Icon: Activity },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <div className="border-b border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/60 backdrop-blur sticky top-16 z-30">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <nav className="flex gap-1 overflow-x-auto">
          {TABS.map(({ href, label, Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "relative flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors",
                  active
                    ? "text-blue-600 dark:text-blue-400"
                    : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
                {active && <span className="absolute inset-x-0 -bottom-px h-0.5 bg-blue-600 dark:bg-blue-400" />}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
