export async function register() {
  // Only validate in the Node.js server runtime (not edge, not during build).
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validateEnv } = await import("@/lib/env");
    validateEnv();
  }
}
