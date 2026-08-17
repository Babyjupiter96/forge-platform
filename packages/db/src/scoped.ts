import { prisma } from "./client";

/**
 * Models that carry an `orgId` column and must never be queried without
 * a tenant filter. Keep in sync with schema.prisma.
 */
const SCOPED_MODELS = new Set([
  "Site",
  "Conversation",
  "Message",
  "Lead",
  "BookingIntegration",
]);

const READ_WRITE_OPS = new Set([
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "findUnique",
  "findUniqueOrThrow",
  "count",
  "aggregate",
  "groupBy",
  "update",
  "updateMany",
  "delete",
  "deleteMany",
]);

const CREATE_OPS = new Set(["create", "createMany"]);
const UPSERT_OPS = new Set(["upsert"]);

/**
 * Returns a Prisma client scoped to a single organization: every
 * scoped-model query is forced to include `orgId`, and every scoped-model
 * write is forced to set `orgId`. This is the ONLY way route handlers
 * should touch the database — never import `prisma` directly outside
 * this package (seed script and migrations are the deliberate exceptions).
 */
export function forOrg(orgId: string) {
  if (!orgId) {
    throw new Error("forOrg() called without an orgId — refusing to build an unscoped client");
  }

  return prisma.$extends({
    name: `org-scoped:${orgId}`,
    query: {
      $allModels: {
        // Prisma 5's extension callback types aren't cleanly exported for
        // external re-annotation; `any` here is scoped to this one
        // interception point, and every field we touch is re-cast below.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async $allOperations({ model, operation, args, query }: any) {
          if (SCOPED_MODELS.has(model)) {
            if (READ_WRITE_OPS.has(operation)) {
              const typedArgs = args as { where?: Record<string, unknown> };
              typedArgs.where = { ...typedArgs.where, orgId };
            } else if (CREATE_OPS.has(operation)) {
              const typedArgs = args as {
                data?: Record<string, unknown> | Record<string, unknown>[];
              };
              if (Array.isArray(typedArgs.data)) {
                typedArgs.data = typedArgs.data.map((d) => ({ ...d, orgId }));
              } else if (typedArgs.data) {
                typedArgs.data = { ...typedArgs.data, orgId };
              }
            } else if (UPSERT_OPS.has(operation)) {
              const typedArgs = args as {
                where?: Record<string, unknown>;
                create?: Record<string, unknown>;
                update?: Record<string, unknown>;
              };
              typedArgs.where = { ...typedArgs.where, orgId };
              if (typedArgs.create) typedArgs.create = { ...typedArgs.create, orgId };
            }
          }
          return query(args);
        },
      },
    },
  });
}

export type ScopedPrismaClient = ReturnType<typeof forOrg>;
