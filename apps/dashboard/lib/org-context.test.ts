import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@forge/db", () => ({ prisma: { site: { findUnique: vi.fn() } } }));

import { prisma } from "@forge/db";
import { OriginNotAllowedError, SiteNotFoundError, resolveSite } from "./org-context";

const findUnique = vi.mocked(prisma.site.findUnique);

const site = {
  id: "site_1",
  orgId: "org_1",
  embedKey: "key_abc",
  isActive: true,
  allowedOrigins: ["https://client.example", "http://localhost:5173"],
};
const found = (overrides: Record<string, unknown> = {}) =>
  findUnique.mockResolvedValue({ ...site, ...overrides } as never);

beforeEach(() => vi.clearAllMocks());

describe("resolveSite", () => {
  it.each([null, ""])("rejects a missing embed key (%j) without touching the database", async (key) => {
    await expect(resolveSite(key, "https://client.example")).rejects.toBeInstanceOf(SiteNotFoundError);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("looks the site up by embed key", async () => {
    found();
    await resolveSite("key_abc", "https://client.example");
    expect(findUnique).toHaveBeenCalledWith({ where: { embedKey: "key_abc" } });
  });

  it("treats an unknown key as not found", async () => {
    findUnique.mockResolvedValue(null);
    await expect(resolveSite("nope", "https://client.example")).rejects.toBeInstanceOf(SiteNotFoundError);
  });

  it("treats an inactive site the same as an unknown one, so key existence doesn't leak", async () => {
    found({ isActive: false });
    await expect(resolveSite("key_abc", "https://client.example")).rejects.toBeInstanceOf(SiteNotFoundError);
  });

  it("returns the site when the origin is on its allowlist", async () => {
    found();
    await expect(resolveSite("key_abc", "https://client.example")).resolves.toMatchObject({
      id: "site_1",
      orgId: "org_1",
    });
  });

  it("accepts any origin in the allowlist, not just the first", async () => {
    found();
    await expect(resolveSite("key_abc", "http://localhost:5173")).resolves.toMatchObject({ id: "site_1" });
  });

  it("rejects a request with no Origin header", async () => {
    found();
    await expect(resolveSite("key_abc", null)).rejects.toBeInstanceOf(OriginNotAllowedError);
  });

  it.each([
    ["an unlisted origin", "https://evil.example"],
    ["a lookalike with the allowed origin as a prefix", "https://client.example.evil.com"],
    ["the same host on another scheme", "http://client.example"],
    ["the same host on another port", "https://client.example:8443"],
    ["an origin with a trailing slash", "https://client.example/"],
    ["a different case", "https://CLIENT.example"],
  ])("rejects %s", async (_label, origin) => {
    found();
    await expect(resolveSite("key_abc", origin)).rejects.toBeInstanceOf(OriginNotAllowedError);
  });

  it("uses distinguishable errors so the route can return 404 vs 403", () => {
    expect(new SiteNotFoundError()).not.toBeInstanceOf(OriginNotAllowedError);
    expect(new OriginNotAllowedError()).not.toBeInstanceOf(SiteNotFoundError);
  });
});
