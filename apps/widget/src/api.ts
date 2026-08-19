import type { WidgetConfigResponse } from "@forge/shared";

// Kept as a local literal union rather than importing @forge/ai's LeadStatus —
// that package pulls in server-only AI provider code the browser bundle has
// no business shipping.
export type LeadStatus = "NEEDS_INFO" | "QUALIFIED" | "DISQUALIFIED";

export interface ChatApiResponse {
  conversationId: string;
  reply: string;
  lead: { score: number; status: LeadStatus; bookingUrl: string | null };
}

export async function fetchWidgetConfig(baseUrl: string, embedKey: string): Promise<WidgetConfigResponse> {
  const res = await fetch(`${baseUrl}/api/widget-config?embedKey=${encodeURIComponent(embedKey)}`);
  if (!res.ok) throw new Error(`widget-config request failed: ${res.status}`);
  return res.json();
}

export async function postChatMessage(
  baseUrl: string,
  body: { embedKey: string; visitorId: string; conversationId?: string; message: string },
): Promise<ChatApiResponse> {
  const res = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`chat request failed: ${res.status}`);
  return res.json();
}
