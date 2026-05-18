"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser, UserButton, SignInButton, SignUpButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { LanguageToggle } from "@/components/layout/language-toggle";
import { useT } from "@/components/i18n/language-provider";
import { BookOpen, Menu, X, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface NavbarProps {
  isAdmin?: boolean;
}

export function Navbar({ isAdmin = false }: NavbarProps) {
  const pathname = usePathname();
  const { isSignedIn } = useUser();
  const [mobileOpen, setMobileOpen] = useState(false);
  const t = useT();

  const navLinks = [
    { href: "/dashboard", label: t("nav.dashboard") },
    { href: "/practice", label: t("nav.practice") },
    { href: "/tips", label: t("nav.tips") },
    { href: "/pricing", label: t("nav.pricing") },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-zinc-200 bg-white/80 backdrop-blur-lg dark:border-zinc-800 dark:bg-zinc-950/80">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <BookOpen className="h-7 w-7 text-blue-600" />
          <span className="text-xl font-bold tracking-tight">ISE Simulator</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "px-3 py-2 rounded-md text-sm font-medium transition-colors",
                pathname === link.href
                  ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                  : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800"
              )}
            >
              {link.label}
            </Link>
          ))}
          {isAdmin && (
            <Link
              href="/admin"
              className={cn(
                "ml-1 inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                pathname?.startsWith("/admin")
                  ? "bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300"
                  : "text-purple-600 hover:bg-purple-50 dark:text-purple-300 dark:hover:bg-purple-950/40"
              )}
            >
              <ShieldCheck className="h-4 w-4" />
              {t("nav.admin")}
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-1 sm:gap-2">
          <LanguageToggle />
          <ThemeToggle />
          {!isSignedIn ? (
            <>
              <SignInButton mode="modal">
                <Button variant="ghost" size="sm">{t("nav.signIn")}</Button>
              </SignInButton>
              <SignUpButton mode="modal">
                <Button size="sm">{t("nav.getStarted")}</Button>
              </SignUpButton>
            </>
          ) : (
            <UserButton
              appearance={{
                elements: { avatarBox: "h-9 w-9" },
              }}
            />
          )}

          {/* Mobile toggle */}
          <button
            className="md:hidden p-2 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile nav */}
      {mobileOpen && (
        <div className="md:hidden border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-4 py-3 space-y-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "block px-3 py-2 rounded-md text-sm font-medium",
                pathname === link.href
                  ? "bg-blue-50 text-blue-700"
                  : "text-zinc-600 hover:bg-zinc-100"
              )}
            >
              {link.label}
            </Link>
          ))}
          {isAdmin && (
            <Link
              href="/admin"
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium",
                pathname?.startsWith("/admin")
                  ? "bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300"
                  : "text-purple-600 hover:bg-purple-50 dark:text-purple-300"
              )}
            >
              <ShieldCheck className="h-4 w-4" />
              {t("nav.admin")}
            </Link>
          )}
          {!isSignedIn && (
            <div className="flex gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800 mt-2">
              <SignInButton mode="modal">
                <Button variant="ghost" size="sm" className="flex-1" onClick={() => setMobileOpen(false)}>
                  {t("nav.signIn")}
                </Button>
              </SignInButton>
              <SignUpButton mode="modal">
                <Button size="sm" className="flex-1" onClick={() => setMobileOpen(false)}>
                  {t("nav.getStarted")}
                </Button>
              </SignUpButton>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
