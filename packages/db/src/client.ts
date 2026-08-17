import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __forgePrisma: PrismaClient | undefined;
}

/**
 * Unscoped client. Only for use inside this package (seed script,
 * cross-tenant admin tooling, migrations) — never import this directly
 * from a route handler. Route handlers must go through `forOrg()`.
 */
export const prisma = globalThis.__forgePrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__forgePrisma = prisma;
}
