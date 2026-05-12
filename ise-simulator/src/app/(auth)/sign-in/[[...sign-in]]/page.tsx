import { SignIn } from "@clerk/nextjs";
import Link from "next/link";

export default function SignInPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-zinc-950">
      {/* Background gradient blobs */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-blue-600/20 blur-[120px]" />
        <div className="absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full bg-indigo-600/20 blur-[120px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[300px] w-[300px] rounded-full bg-sky-500/10 blur-[80px]" />
      </div>

      {/* Grid overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <div className="relative z-10 flex w-full max-w-md flex-col items-center gap-6 px-4">
        {/* Logo / brand */}
        <Link href="/" className="flex flex-col items-center gap-1 mb-2 group">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-sky-400 to-indigo-500 flex items-center justify-center">
              <span className="text-white font-bold text-sm">IS</span>
            </div>
            <span className="text-xl font-bold text-white">ISE Simulator</span>
          </div>
          <span className="text-xs text-zinc-500 group-hover:text-zinc-400 transition-colors">← Back to home</span>
        </Link>

        <SignIn
          appearance={{
            variables: {
              colorBackground: "#18181b",
              colorText: "#f4f4f5",
              colorTextSecondary: "#a1a1aa",
              colorInputBackground: "#27272a",
              colorInputText: "#f4f4f5",
              colorPrimary: "#38bdf8",
              colorNeutral: "#f4f4f5",
              colorDanger: "#f87171",
              borderRadius: "0.75rem",
            },
            elements: {
              rootBox: { width: "100%" },
              card: {
                backgroundColor: "#18181b",
                border: "1px solid #3f3f46",
                boxShadow: "0 25px 50px -12px rgba(0,0,0,0.8)",
                width: "100%",
              },
              headerTitle: { color: "#f4f4f5" },
              headerSubtitle: { color: "#a1a1aa" },
              socialButtonsBlockButton: {
                backgroundColor: "#27272a",
                border: "1px solid #3f3f46",
                color: "#e4e4e7",
              },
              socialButtonsBlockButtonText: { color: "#e4e4e7" },
              dividerLine: { backgroundColor: "#3f3f46" },
              dividerText: { color: "#71717a" },
              formFieldLabel: { color: "#d4d4d8" },
              formFieldInput: {
                backgroundColor: "#27272a",
                borderColor: "#3f3f46",
                color: "#f4f4f5",
              },
              formButtonPrimary: {
                background: "linear-gradient(to right, #38bdf8, #6366f1)",
                border: "none",
                color: "white",
              },
              footerActionText: { color: "#71717a" },
              footerActionLink: { color: "#38bdf8" },
              footer: { display: "none" },
              badge: { display: "none" },
              identityPreviewText: { color: "#d4d4d8" },
              identityPreviewEditButton: { color: "#38bdf8" },
            },
          }}
        />

        <p className="text-sm text-zinc-500">
          Don&apos;t have an account?{" "}
          <Link href="/sign-up" className="text-sky-400 hover:text-sky-300 transition-colors">
            Sign up for free
          </Link>
        </p>
      </div>
    </div>
  );
}
