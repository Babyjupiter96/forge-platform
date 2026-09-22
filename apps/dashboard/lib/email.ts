import nodemailer from "nodemailer";
import type { Lead } from "@forge/db";

// Gmail SMTP via an app password — same pattern as ki-real-estate's
// notifier. Per-org since Forge Digital is currently the only tenant; a
// real multi-tenant rollout would move NOTIFY_EMAIL to a Site/Organization
// column instead of an env var.
const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
const NOTIFY_EMAIL = process.env.LEAD_NOTIFY_EMAIL || GMAIL_USER;
const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL || "http://localhost:3000";

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransporter() {
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
    });
  }
  return transporter;
}

export const emailConfigured = Boolean(GMAIL_USER && GMAIL_APP_PASSWORD);

export async function sendMail(opts: { to: string; subject: string; html: string }): Promise<{
  sent: boolean;
  reason?: string;
}> {
  const t = getTransporter();
  if (!t) {
    console.warn(
      `[email] GMAIL_USER / GMAIL_APP_PASSWORD not set — skipping send: "${opts.subject}" to ${opts.to}`,
    );
    return { sent: false, reason: "not_configured" };
  }
  try {
    await t.sendMail({ from: `Forge Digital <${GMAIL_USER}>`, to: opts.to, subject: opts.subject, html: opts.html });
    return { sent: true };
  } catch (err) {
    console.error("[email] send failed", err);
    return { sent: false, reason: "send_error" };
  }
}

function wrapper(title: string, body: string) {
  return `
  <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; background:#0a0a0b; padding: 32px;">
    <div style="max-width:560px;margin:0 auto;background:#131316;border:1px solid #2a2a2e;border-radius:16px;padding:32px;color:#f5f3ec;">
      <p style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#ffffff;margin:0 0 12px;">Forge Digital · SDR</p>
      <h1 style="font-size:22px;margin:0 0 20px;color:#f5f3ec;">${title}</h1>
      ${body}
    </div>
  </div>`;
}

export function leadQualifiedEmail(lead: Lead) {
  const rows: [string, string][] = [
    ["Score", String(lead.score)],
    ["Name", lead.contactName || "—"],
    ["Email", lead.contactEmail || "—"],
    ["Phone", lead.contactPhone || "—"],
    ["Business", lead.businessType || "—"],
    ["Budget", lead.budgetRange || "—"],
    ["Timeline", lead.timeline || "—"],
  ];
  if (lead.bookingUrl) rows.push(["Booking", lead.bookingUrl]);

  const rowsHtml = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:6px 0;color:#a9a394;font-size:13px;width:120px;">${escapeHtml(
          label,
        )}</td><td style="padding:6px 0;font-size:14px;">${escapeHtml(value)}</td></tr>`,
    )
    .join("");

  return {
    subject: `Qualified lead (${lead.score}): ${lead.contactName || lead.contactEmail || "no contact info yet"}`,
    html: wrapper(
      "A visitor just qualified.",
      `<table style="width:100%;border-collapse:collapse;">${rowsHtml}</table>
       <a href="${DASHBOARD_URL}/leads/${lead.id}" style="display:inline-block;margin-top:24px;background:#ffffff;color:#0a0a0b;text-decoration:none;padding:12px 24px;border-radius:999px;font-weight:600;font-size:14px;">View in dashboard</a>`,
    ),
  };
}

export function getNotifyEmail() {
  return NOTIFY_EMAIL;
}

function escapeHtml(str: string) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
