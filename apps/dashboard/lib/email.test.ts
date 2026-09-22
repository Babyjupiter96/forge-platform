import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Lead } from "@forge/db";

const sendMailMock = vi.fn();
vi.mock("nodemailer", () => ({
  default: { createTransport: vi.fn(() => ({ sendMail: sendMailMock })) },
}));

async function loadEmail(env: Record<string, string | undefined>) {
  vi.resetModules();
  vi.unstubAllEnvs();
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) vi.stubEnv(k, "");
    else vi.stubEnv(k, v);
  }
  return import("./email");
}

const baseLead = {
  id: "lead_1",
  score: 72,
  contactName: "Jane Doe",
  contactEmail: "jane@example.com",
  contactPhone: null,
  businessType: "HVAC",
  budgetRange: "3k-10k",
  timeline: "immediate",
  bookingUrl: null,
} as unknown as Lead;

beforeEach(() => {
  vi.clearAllMocks();
  sendMailMock.mockResolvedValue({});
});
afterEach(() => vi.unstubAllEnvs());

describe("emailConfigured", () => {
  it("is false when either credential is missing", async () => {
    expect((await loadEmail({ GMAIL_USER: "a@gmail.com" })).emailConfigured).toBe(false);
    expect((await loadEmail({ GMAIL_APP_PASSWORD: "pw" })).emailConfigured).toBe(false);
    expect((await loadEmail({})).emailConfigured).toBe(false);
  });

  it("is true once both are set", async () => {
    const { emailConfigured } = await loadEmail({ GMAIL_USER: "a@gmail.com", GMAIL_APP_PASSWORD: "pw" });
    expect(emailConfigured).toBe(true);
  });
});

describe("getNotifyEmail", () => {
  it("prefers LEAD_NOTIFY_EMAIL when set", async () => {
    const { getNotifyEmail } = await loadEmail({ GMAIL_USER: "a@gmail.com", LEAD_NOTIFY_EMAIL: "sales@forge.com" });
    expect(getNotifyEmail()).toBe("sales@forge.com");
  });

  it("falls back to GMAIL_USER when unset", async () => {
    const { getNotifyEmail } = await loadEmail({ GMAIL_USER: "a@gmail.com" });
    expect(getNotifyEmail()).toBe("a@gmail.com");
  });

  it("is undefined when nothing is configured", async () => {
    const { getNotifyEmail } = await loadEmail({});
    expect(getNotifyEmail()).toBeUndefined();
  });
});

describe("sendMail", () => {
  it("skips sending and reports not_configured when credentials are missing", async () => {
    const { sendMail } = await loadEmail({});
    const result = await sendMail({ to: "x@example.com", subject: "s", html: "<p>h</p>" });
    expect(result).toEqual({ sent: false, reason: "not_configured" });
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it("sends through nodemailer when configured", async () => {
    const { sendMail } = await loadEmail({ GMAIL_USER: "a@gmail.com", GMAIL_APP_PASSWORD: "pw" });
    const result = await sendMail({ to: "x@example.com", subject: "New lead", html: "<p>hi</p>" });
    expect(result).toEqual({ sent: true });
    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({ from: "Forge Digital <a@gmail.com>", to: "x@example.com", subject: "New lead" }),
    );
  });

  it("reports send_error instead of throwing when nodemailer rejects", async () => {
    sendMailMock.mockRejectedValue(new Error("smtp down"));
    const { sendMail } = await loadEmail({ GMAIL_USER: "a@gmail.com", GMAIL_APP_PASSWORD: "pw" });
    const result = await sendMail({ to: "x@example.com", subject: "s", html: "<p>h</p>" });
    expect(result).toEqual({ sent: false, reason: "send_error" });
  });
});

describe("leadQualifiedEmail", () => {
  it("includes the score and contact fields in the subject and body", async () => {
    const { leadQualifiedEmail } = await loadEmail({});
    const { subject, html } = leadQualifiedEmail(baseLead);
    expect(subject).toBe("Qualified lead (72): Jane Doe");
    expect(html).toContain("Jane Doe");
    expect(html).toContain("jane@example.com");
    expect(html).toContain("HVAC");
  });

  it("falls back to the contact email in the subject when there is no name", async () => {
    const { leadQualifiedEmail } = await loadEmail({});
    const { subject } = leadQualifiedEmail({ ...baseLead, contactName: null });
    expect(subject).toBe("Qualified lead (72): jane@example.com");
  });

  it("falls back to a placeholder when there is no contact info at all", async () => {
    const { leadQualifiedEmail } = await loadEmail({});
    const { subject } = leadQualifiedEmail({ ...baseLead, contactName: null, contactEmail: null });
    expect(subject).toBe("Qualified lead (72): no contact info yet");
  });

  it("adds a booking row only when a booking URL exists", async () => {
    const { leadQualifiedEmail } = await loadEmail({});
    expect(leadQualifiedEmail(baseLead).html).not.toContain("Booking");
    expect(leadQualifiedEmail({ ...baseLead, bookingUrl: "https://calendly.com/x" }).html).toContain(
      "https://calendly.com/x",
    );
  });

  it("escapes HTML in contact fields instead of injecting them raw", async () => {
    const { leadQualifiedEmail } = await loadEmail({});
    const { html } = leadQualifiedEmail({ ...baseLead, contactName: "<script>alert(1)</script>" });
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("links to the lead's dashboard page", async () => {
    const { leadQualifiedEmail } = await loadEmail({ NEXT_PUBLIC_DASHBOARD_URL: "https://forge.example" });
    expect(leadQualifiedEmail(baseLead).html).toContain("https://forge.example/leads/lead_1");
  });
});
