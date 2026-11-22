"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser, UserButton, SignInButton, SignUpButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { LanguageToggle } from "@/components/layout/language-toggle";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useT } from "@/components/i18n/language-provider";
import { BookOpen, ChevronDown, Menu, X, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface NavbarProps {
  isAdmin?: boolean;
}

type NavLink = { href: string; label: string };

export function Navbar({ isAdmin = false }: NavbarProps) {
  const pathname = usePathname();
  const { isSignedIn } = useUser();
  const [mobileOpen, setMobileOpen] = useState(false);
  const t = useT();

  // Signed in: the four things a learner does, the rest one click away.
  const primary: NavLink[] = isSignedIn
    ? [
        { href: "/dashboard", label: t("nav.dashboard") },
        { href: "/practice", label: t("nav.practice") },
        { href: "/readiness", label: t("nav.progress") },
        { href: "/chat", label: t("nav.tutor") },
      ]
    : // Visitors only see what they can open without an account.
      [
        { href: "/#features", label: t("nav.features") },
        { href: "/#how-it-works", label: t("nav.howItWorks") },
        { href: "/#pricing", label: t("nav.pricing") },
        { href: "/tips", label: t("nav.tips") },
      ];
  const more: NavLink[] = isSignedIn
    ? [
        { href: "/teams", label: t("nav.teams") },
        { href: "/tips", label: t("nav.tips") },
        { href: "/pricing", label: t("nav.pricing") },
      ]
    : [];

  const isActive = (href: string) => !href.includes("#") && (pathname === href || pathname?.startsWith(`${href}/`));
  const linkCls = (href: string) =>
    cn(
      "px-3 py-2 text-sm font-medium transition-colors underline-offset-[6px] decoration-4",
      isActive(href) ? "text-ink underline decoration-marker" : "text-ink-soft hover:text-ink",
    );

  return (
    <header className="sticky top-0 z-50 w-full border-b border-rule bg-paper/85 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href={isSignedIn ? "/dashboard" : "/"} className="flex items-center gap-2 text-ink">
          <BookOpen className="h-7 w-7" />
          <span className="text-xl font-display font-semibold tracking-tight">ISE Simulator</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {primary.map((link) => (
            <Link key={link.href} href={link.href} className={linkCls(link.href)}>
              {link.label}
            </Link>
          ))}
          {more.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger
                className={cn(
                  "inline-flex items-center gap-1 px-3 py-2 text-sm font-medium outline-none transition-colors",
                  more.some((l) => isActive(l.href)) ? "text-ink" : "text-ink-soft hover:text-ink",
                )}
              >
                {t("nav.more")} <ChevronDown className="h-3.5 w-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-44">
                {more.map((link) => (
                  <DropdownMenuItem key={link.href} asChild>
                    <Link href={link.href} className={cn("cursor-pointer", isActive(link.href) && "font-semibold")}>{link.label}</Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {isAdmin && (
            <Link
              href="/admin"
              className={cn(
                "ml-1 inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors underline-offset-[6px] decoration-4",
                pathname?.startsWith("/admin") ? "text-ink underline decoration-marker" : "text-ink-soft hover:text-ink",
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
                <Button variant="ghost" size="sm" className="hidden sm:inline-flex">{t("nav.signIn")}</Button>
              </SignInButton>
              <SignUpButton mode="modal">
                <Button size="sm" className="hidden sm:inline-flex">{t("nav.getStarted")}</Button>
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
            className="md:hidden p-2 rounded-md text-ink hover:bg-rule"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile nav */}
      {mobileOpen && (
        <div className="md:hidden border-t border-rule bg-paper px-4 py-3 space-y-1 animate-in slide-in-from-top-2 duration-200">
          {[...primary, ...more].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "block px-3 py-3 text-sm font-medium transition-colors",
                isActive(link.href) ? "text-ink underline decoration-marker decoration-4 underline-offset-[6px]" : "text-ink-soft hover:text-ink",
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
                "flex items-center gap-1.5 px-3 py-3 text-sm font-medium transition-colors",
                pathname?.startsWith("/admin") ? "text-ink underline decoration-marker decoration-4 underline-offset-[6px]" : "text-ink-soft hover:text-ink",
              )}
            >
              <ShieldCheck className="h-4 w-4" />
              {t("nav.admin")}
            </Link>
          )}
          {!isSignedIn && (
            <div className="flex gap-2 pt-3 border-t border-rule mt-2">
              <SignInButton mode="modal">
                <Button variant="ghost" size="sm" className="flex-1 h-11 text-sm" onClick={() => setMobileOpen(false)}>
                  {t("nav.signIn")}
                </Button>
              </SignInButton>
              <SignUpButton mode="modal">
                <Button size="sm" className="flex-1 h-11 text-sm" onClick={() => setMobileOpen(false)}>
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
