import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { ToastProvider } from "@/components/ui/toaster";
import { LanguageProvider } from "@/components/i18n/language-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ISE Simulator — Practice Trinity ISE Exams with AI",
  description:
    "AI-powered Trinity ISE exam simulator. Practice written and oral exams with instant feedback. Prepare for ISE Foundation to ISE IV (A2–C2).",
  keywords: ["Trinity ISE", "exam simulator", "English exam practice", "ISE preparation", "AI examiner"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html
        lang="en"
        className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
        suppressHydrationWarning
      >
        <head>
          {/* Anti-flash: apply dark class before React hydrates */}
          <Script id="theme-init" strategy="beforeInteractive" src="/theme-init.js" />
        </head>
        <body className="min-h-full flex flex-col">
          <ThemeProvider>
            <LanguageProvider>
              <ToastProvider>{children}</ToastProvider>
            </LanguageProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
