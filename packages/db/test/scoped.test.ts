import { beforeEach, describe, expect, it, vi } from "vitest";

// forOrg() builds a Prisma client extension. Stub the client so `$extends`
// hands the extension object straight back, which lets these tests call the
// query interceptor directly, with no database involved.
vi.mock("../src/client", () => ({
  prisma: { $extends: vi.fn((extension: unknown) => extension) },
}));

import { forOrg } from "../src/scoped";

type Interceptor = (params: {
  model: string;
  operation: string;
  args: Record<string, unknown>;
  query: (args: Record<string, unknown>) => Promise<unknown>;
}) => Promise<unknown>;

function interceptor(orgId: string): Interceptor {
  const extension = forOrg(orgId) as unknown as {
    query: { $allModels: { $allOperations: Interceptor } };
  };
  return extension.query.$allModels.$allOperations;
}

/** Runs one operation through the interceptor and returns the args Prisma would receive. */
async function run(orgId: string, model: string, operation: string, args: Record<string, unknown>) {
  const query = vi.fn(async (a: Record<string, unknown>) => ({ received: a }));
  const result = await interceptor(orgId)({ model, operation, args, query });
  return { sent: query.mock.calls[0][0], result, query };
}

const SCOPED = ["Site", "Conversation", "Message", "Lead", "BookingIntegration"];
const UNSCOPED = ["Organization", "User", "OrgUser"];
const READ_WRITE_OPS = [
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
];

beforeEach(() => vi.clearAllMocks());

describe("forOrg", () => {
  it("refuses to build a client without an orgId", () => {
    expect(() => forOrg("")).toThrow(/without an orgId/);
  });

  describe("reads and writes on tenant-owned models", () => {
    it.each(SCOPED.flatMap((m) => READ_WRITE_OPS.map((op) => [m, op])))(
      "%s.%s is filtered to the current org",
      async (model, operation) => {
        const { sent } = await run("org_a", model, operation, { where: { id: "x" } });
        expect(sent.where).toEqual({ id: "x", orgId: "org_a" });
      }
    );

    it("adds a where clause when the caller supplied none", async () => {
      const { sent } = await run("org_a", "Lead", "findMany", {});
      expect(sent.where).toEqual({ orgId: "org_a" });
    });

    it("overrides a caller-supplied orgId, so one tenant can't ask for another's rows", async () => {
      const { sent } = await run("org_a", "Lead", "findMany", { where: { orgId: "org_b" } });
      expect(sent.where).toEqual({ orgId: "org_a" });
    });

    it("keeps the caller's other filters and options", async () => {
      const { sent } = await run("org_a", "Lead", "findMany", {
        where: { status: "QUALIFIED" },
        take: 10,
        orderBy: { createdAt: "desc" },
      });
      expect(sent).toEqual({
        where: { status: "QUALIFIED", orgId: "org_a" },
        take: 10,
        orderBy: { createdAt: "desc" },
      });
    });
  });

  describe("creates", () => {
    it.each(SCOPED)("%s.create sets orgId on the new row", async (model) => {
      const { sent } = await run("org_a", model, "create", { data: { name: "n" } });
      expect(sent.data).toEqual({ name: "n", orgId: "org_a" });
    });

    it("overrides an orgId supplied in the data", async () => {
      const { sent } = await run("org_a", "Lead", "create", { data: { orgId: "org_b", name: "n" } });
      expect(sent.data).toEqual({ orgId: "org_a", name: "n" });
    });

    it("sets orgId on every row of a createMany", async () => {
      const { sent } = await run("org_a", "Message", "createMany", {
        data: [{ body: "1" }, { body: "2", orgId: "org_b" }],
      });
      expect(sent.data).toEqual([
        { body: "1", orgId: "org_a" },
        { body: "2", orgId: "org_a" },
      ]);
    });

    it("does not invent a data object when a create has none", async () => {
      const { sent } = await run("org_a", "Lead", "create", {});
      expect(sent.data).toBeUndefined();
    });
  });

  describe("upserts", () => {
    it("scopes both the lookup and the row it would create", async () => {
      const { sent } = await run("org_a", "Site", "upsert", {
        where: { embedKey: "k" },
        create: { name: "n" },
        update: { name: "m" },
      });
      expect(sent).toEqual({
        where: { embedKey: "k", orgId: "org_a" },
        create: { name: "n", orgId: "org_a" },
        update: { name: "m" },
      });
    });
  });

  describe("models without an orgId column", () => {
    it.each(UNSCOPED)("%s queries pass through untouched", async (model) => {
      const args = { where: { id: "x" } };
      const { sent } = await run("org_a", model, "findMany", args);
      expect(sent).toEqual({ where: { id: "x" } });
    });

    it.each(UNSCOPED)("%s creates pass through untouched", async (model) => {
      const { sent } = await run("org_a", model, "create", { data: { name: "n" } });
      expect(sent.data).toEqual({ name: "n" });
    });
  });

  it("returns whatever the underlying query returns", async () => {
    const { result } = await run("org_a", "Lead", "findMany", {});
    expect(result).toEqual({ received: { where: { orgId: "org_a" } } });
  });

  it("gives each client its own org, with no state shared between them", async () => {
    const a = await run("org_a", "Lead", "findMany", {});
    const b = await run("org_b", "Lead", "findMany", {});
    expect(a.sent.where).toEqual({ orgId: "org_a" });
    expect(b.sent.where).toEqual({ orgId: "org_b" });
  });
});
