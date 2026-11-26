import { vi, type Mock } from "vitest";

/**
 * A stand-in for the Prisma client: every `prisma.<model>.<method>` is a vi.fn
 * created on first use, and `$transaction(fn)` runs `fn` with the same mock.
 *
 *   vi.mock("@/lib/prisma", async () => ({ prisma: (await import("../helpers/prisma")).prismaMock }));
 *   db("savedWord", "count").mockResolvedValue(3);
 */
const models = new Map<string, Record<string, Mock>>();

function model(name: string): Record<string, Mock> {
  let m = models.get(name);
  if (!m) {
    const fns: Record<string, Mock> = {};
    m = new Proxy(fns, {
      get(target, method: string) {
        target[method] ??= vi.fn();
        return target[method];
      },
    });
    models.set(name, m);
  }
  return m;
}

export const prismaMock = new Proxy({} as Record<string, unknown>, {
  get(_target, prop: string) {
    if (prop === "$transaction") {
      return (fnOrList: unknown) =>
        typeof fnOrList === "function" ? (fnOrList as (tx: unknown) => unknown)(prismaMock) : Promise.all(fnOrList as unknown[]);
    }
    if (prop === "then") return undefined;
    return model(prop);
  },
});

/** The mock for one Prisma call, e.g. db("user", "findUnique"). */
export function db(modelName: string, method: string): Mock {
  return model(modelName)[method];
}

/** Forget every implementation and call (use in beforeEach). */
export function resetDb(): void {
  for (const m of models.values()) for (const fn of Object.values(m)) fn.mockReset();
}
