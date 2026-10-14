import { dark } from "@clerk/themes";
import type { ComponentProps } from "react";
import type { SignIn } from "@clerk/nextjs";

type Appearance = ComponentProps<typeof SignIn>["appearance"];

/**
 * Shared Clerk appearance for the auth pages (`/sign-in`, `/sign-up`) and any
 * embedded Clerk component on a dark surface.
 *
 * Built on top of Clerk's `dark` baseTheme so we inherit consistent typography,
 * spacing and component states, then override the few brand-specific things:
 * primary accent (sky→indigo gradient), card surface, social button layout.
 */
export const clerkDarkAppearance: Appearance = {
  baseTheme: dark,
  layout: {
    // Force all social buttons into one consistent stacked layout so we never
    // get the mixed "first provider full-width + rest as icon row" Clerk default.
    socialButtonsVariant: "blockButton",
    socialButtonsPlacement: "top",
    showOptionalFields: false,
  },
  variables: {
    colorPrimary: "#38bdf8",
    colorBackground: "#0a0a0a",
    colorInputBackground: "#1c1c20",
    colorInputText: "#f4f4f5",
    colorText: "#f4f4f5",
    colorTextSecondary: "#a1a1aa",
    colorDanger: "#f87171",
    borderRadius: "0.75rem",
    fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
  },
  elements: {
    rootBox: { width: "100%" },
    card: {
      backgroundColor: "rgb(24, 24, 27)",
      border: "1px solid rgb(63, 63, 70)",
      boxShadow: "0 25px 50px -12px rgba(0,0,0,0.6)",
      width: "100%",
    },
    cardBox: { backgroundColor: "transparent" },
    headerTitle: { color: "#f4f4f5", fontSize: "1.25rem" },
    headerSubtitle: { color: "#a1a1aa" },

    // SSO layout: GitHub full-width on its own row, Apple + Google share the next row 50/50.
    socialButtons: {
      display: "flex",
      flexWrap: "wrap",
      gap: "0.5rem",
    },
    socialButtonsBlockButton: {
      backgroundColor: "rgb(39, 39, 42)",
      border: "1px solid rgb(63, 63, 70)",
      color: "#e4e4e7",
      minHeight: "2.75rem",
      flex: "1 1 calc(50% - 0.25rem)",
      transition: "all 0.15s ease",
      "&:hover": {
        backgroundColor: "rgb(63, 63, 70)",
        borderColor: "rgb(82, 82, 91)",
      },
    },
    socialButtonsBlockButton__github: { flex: "1 1 100%" },
    socialButtonsBlockButtonText: { color: "#e4e4e7", fontWeight: 500 },
    socialButtonsBlockButtonArrow: { color: "#a1a1aa" },
    socialButtonsIconButton: {
      backgroundColor: "rgb(39, 39, 42)",
      border: "1px solid rgb(63, 63, 70)",
      flex: "1 1 calc(50% - 0.25rem)",
      "&:hover": { backgroundColor: "rgb(63, 63, 70)" },
    },
    socialButtonsProviderIcon__apple: { filter: "invert(1) brightness(1.2)" },
    badge: { display: "none !important" },
    socialButtonsBlockButton__badge: { display: "none !important" },

    dividerLine: { backgroundColor: "rgba(63, 63, 70, 0.6)" },
    dividerText: { color: "#71717a" },

    formFieldLabel: { color: "#e4e4e7", fontWeight: 500 },
    formFieldInput: {
      backgroundColor: "rgb(39, 39, 42)",
      border: "1px solid rgb(82, 82, 91)",
      color: "#f4f4f5",
      minHeight: "2.75rem",
      "&::placeholder": { color: "#71717a" },
      "&:hover": { borderColor: "rgb(113, 113, 122)" },
      "&:focus": {
        borderColor: "#38bdf8",
        boxShadow: "0 0 0 3px rgba(56, 189, 248, 0.2)",
        outline: "none",
      },
    },
    otpCodeFieldInput: {
      backgroundColor: "rgb(24, 24, 27)",
      border: "1px solid rgb(63, 63, 70)",
      color: "#f4f4f5",
    },

    formButtonPrimary: {
      background: "linear-gradient(to right, #38bdf8, #6366f1)",
      border: "none",
      color: "white",
      fontWeight: 600,
      "&:hover": {
        background: "linear-gradient(to right, #0ea5e9, #4f46e5)",
        boxShadow: "0 4px 12px rgba(56, 189, 248, 0.25)",
      },
    },

    footerActionText: { color: "#71717a" },
    footerActionLink: {
      color: "#38bdf8",
      "&:hover": { color: "#7dd3fc" },
    },
    footer: { display: "none" },
    identityPreviewText: { color: "#d4d4d8" },
    identityPreviewEditButton: { color: "#38bdf8" },
  },
};
