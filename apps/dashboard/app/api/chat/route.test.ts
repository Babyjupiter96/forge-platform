import { beforeEach, describe, expect, it, vi } from "vitest";

// This route is the one place that decides whether a "just qualified"
// email goes out, so the mocks below stub every collaborator except that
// decision: the AI provider never makes a tool call (simplest path
// through the round loop), scoreLead's return value drives the scenario,
// and the DB is an in-memory stand-in shaped like the scoped client.

vi.mock("@/lib/org-context", () => ({
  resolveSite: vi.fn(),
  SiteNotFoundError: class SiteNotFoundError extends Error {},
  OriginNotAllowedError: class OriginNotAllowedError extends Error {},
}));
vi.mock("@/lib/cors", () => ({
  corsHeaders: () => ({}),
  preflightResponse: () => new Response(null, { status: 204 }),
}));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: vi.fn(() => true) }));
vi.mock("@/lib/ai-provider", () => ({
  getAIProvider: vi.fn(() => ({
    async *streamChat() {
      yield { type: "text_delta", text: "Thanks, noted." };
    },
  })),
}));
vi.mock("@/lib/booking-provider", () => ({ getBookingProvider: vi.fn(async () => null) }));
vi.mock("@/lib/chat-history", () => ({ buildHistoryFromMessages: vi.fn(() => []) }));
vi.mock("@/lib/lead-profile", () => ({
  leadToProfile: vi.fn(() => ({})),
  mergeProfileUpdates: vi.fn((current) => current),
}));
vi.mock("@forge/ai", () => ({
  buildSystemPrompt: vi.fn(() => "system"),
  scoreLead: vi.fn(),
  UPDATE_LEAD_PROFILE_TOOL_NAME: "update_lead_profile",
  UPDATE_LEAD_PROFILE_TOOL_SCHEMA: {},
}));
vi.mock("@forge/db", () => ({ forOrg: vi.fn() }));
vi.mock("@/lib/email", () => ({
  sendMail: vi.fn(async () => ({ sent: true })),
  leadQualifiedEmail: vi.fn((lead) => ({ subject: `Qualified: ${lead.id}`, html: "<p>x</p>" })),
  getNotifyEmail: vi.fn(() => "owner@example.com"),
}));

import { POST } from "./route";
import { resolveSite } from "@/lib/org-context";
import { forOrg } from "@forge/db";
import { scoreLead } from "@forge/ai";
import { sendMail, leadQualifiedEmail, getNotifyEmail } from "@/lib/email";

const site = {
  id: "site_1",
  orgId: "org_1",
  embedKey: "key_abc",
  personaConfig: {},
};

function makeDb(overrides: { existingLead?: Record<string, unknown> | null; leadRow?: Record<string, unknown> } = {}) {
  const leadRow = { id: "lead_1", bookingUrl: null, status: "NEEDS_INFO", ...overrides.leadRow };
  const db = {
    conversation: {
      findUnique: vi.fn(async () => ({ id: "conv_1", siteId: site.id, visitorId: "visitor_1" })),
      create: vi.fn(async () => ({ id: "conv_1", siteId: site.id, visitorId: "visitor_1" })),
      update: vi.fn(async () => ({})),
    },
    message: {
      create: vi.fn(async () => ({})),
      findMany: vi.fn(async () => []),
    },
    lead: {
      findUnique: vi.fn(async () => overrides.existingLead ?? null),
      upsert: vi.fn(async () => leadRow),
      update: vi.fn(async () => ({})),
    },
  };
  return db;
}

const post = (body: Record<string, unknown> = {}) =>
  new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://client.example" },
    body: JSON.stringify({ embedKey: "key_abc", visitorId: "visitor_1", message: "hello", ...body }),
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(resolveSite).mockResolvedValue(site as never);
});

describe("POST /api/chat — qualification email", () => {
  it("sends a notification the turn a lead first crosses QUALIFIED", async () => {
    vi.mocked(scoreLead).mockReturnValue({ score: 72, status: "QUALIFIED", breakdown: {} });
    const db = makeDb({ existingLead: { status: "NEEDS_INFO" }, leadRow: { id: "lead_1", status: "QUALIFIED" } });
    vi.mocked(forOrg).mockReturnValue(db as never);

    await POST(post());

    expect(getNotifyEmail).toHaveBeenCalled();
    expect(leadQualifiedEmail).toHaveBeenCalledWith(expect.objectContaining({ id: "lead_1" }));
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "owner@example.com", subject: "Qualified: lead_1" }),
    );
  });

  it("does not re-notify on a later message of an already-qualified conversation", async () => {
    vi.mocked(scoreLead).mockReturnValue({ score: 80, status: "QUALIFIED", breakdown: {} });
    const db = makeDb({ existingLead: { status: "QUALIFIED" }, leadRow: { id: "lead_1", status: "QUALIFIED" } });
    vi.mocked(forOrg).mockReturnValue(db as never);

    await POST(post());

    expect(sendMail).not.toHaveBeenCalled();
  });

  it("does not notify when the lead is not yet qualified", async () => {
    vi.mocked(scoreLead).mockReturnValue({ score: 20, status: "NEEDS_INFO", breakdown: {} });
    const db = makeDb({ existingLead: null, leadRow: { id: "lead_1", status: "NEEDS_INFO" } });
    vi.mocked(forOrg).mockReturnValue(db as never);

    await POST(post());

    expect(sendMail).not.toHaveBeenCalled();
  });

  it("does not notify when a conversation drops to DISQUALIFIED", async () => {
    vi.mocked(scoreLead).mockReturnValue({ score: 0, status: "DISQUALIFIED", breakdown: {} });
    const db = makeDb({ existingLead: { status: "NEEDS_INFO" }, leadRow: { id: "lead_1", status: "DISQUALIFIED" } });
    vi.mocked(forOrg).mockReturnValue(db as never);

    await POST(post());

    expect(sendMail).not.toHaveBeenCalled();
  });

  it("skips sending, without failing the request, when no notify address is configured", async () => {
    vi.mocked(getNotifyEmail).mockReturnValue(undefined);
    vi.mocked(scoreLead).mockReturnValue({ score: 72, status: "QUALIFIED", breakdown: {} });
    const db = makeDb({ existingLead: { status: "NEEDS_INFO" }, leadRow: { id: "lead_1", status: "QUALIFIED" } });
    vi.mocked(forOrg).mockReturnValue(db as never);

    const res = await POST(post());

    expect(res.status).toBe(200);
    expect(sendMail).not.toHaveBeenCalled();
  });
});
