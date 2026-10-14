/**
 * Startup validation of required environment variables.
 * In production a missing var throws (fail fast, naming every missing var);
 * in development it only warns so partial setups still run.
 */

const REQUIRED_VARS = [
  "DATABASE_URL",
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
  "CLERK_SECRET_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRO_MONTHLY_PRICE_ID",
  "STRIPE_PRO_YEARLY_PRICE_ID",
  "NEXT_PUBLIC_APP_URL",
] as const;

/** At least one AI provider key must be configured. */
const AI_PROVIDER_VARS = ["GROQ_API_KEY", "GEMINI_API_KEY", "OPENROUTER_API_KEY"] as const;

function isMissing(name: string): boolean {
  const value = process.env[name];
  return !value || value.includes("your_secret_here") || value.includes("your_key_here");
}

export function validateEnv(): void {
  const missing = REQUIRED_VARS.filter(isMissing);

  if (AI_PROVIDER_VARS.every(isMissing)) {
    missing.push(`one of ${AI_PROVIDER_VARS.join(" | ")}` as never);
  }

  if (missing.length === 0) return;

  const message = `[env] Missing or placeholder environment variables: ${missing.join(", ")}`;
  if (process.env.NODE_ENV === "production") {
    throw new Error(message);
  }
  console.warn(`${message} — some features will fail until these are set.`);
}
