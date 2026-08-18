import { NextResponse } from "next/server";
import { z } from "zod";
import { forOrg } from "@forge/db";
import type { PersonaConfig } from "@forge/shared";
import { LeadProfileUpdateSchema, type LeadProfile } from "@forge/shared";
import {
  buildSystemPrompt,
  scoreLead,
  UPDATE_LEAD_PROFILE_TOOL_NAME,
  UPDATE_LEAD_PROFILE_TOOL_SCHEMA,
} from "@forge/ai";
import type { ChatHistoryMessage } from "@forge/ai";
import { resolveSite, SiteNotFoundError, OriginNotAllowedError } from "@/lib/org-context";
import { corsHeaders, preflightResponse } from "@/lib/cors";
import { checkRateLimit } from "@/lib/rate-limit";
import { getAIProvider } from "@/lib/ai-provider";
import { getBookingProvider } from "@/lib/booking-provider";
import { buildHistoryFromMessages } from "@/lib/chat-history";
import { leadToProfile, mergeProfileUpdates } from "@/lib/lead-profile";

const ChatRequestBodySchema = z.object({
  embedKey: z.string().min(1),
  visitorId: z.string().min(1),
  conversationId: z.string().optional(),
  message: z.string().min(1).max(4000),
});

// Tool-calling models generally answer a turn that triggers a tool call
// with *just* the call and no visible text — the natural-language reply
// only comes back on a follow-up round once the tool's result is fed back
// in. This caps how many such rounds one incoming user message can
// trigger before we give up and reply with whatever text we have (a
// pathological loop, not a normal conversation, would hit this).
const MAX_TOOL_ROUNDS = 4;

export async function OPTIONS(req: Request) {
  return preflightResponse(req.headers.get("origin"));
}

export async function POST(req: Request) {
  const origin = req.headers.get("origin");

  let body: z.infer<typeof ChatRequestBodySchema>;
  try {
    body = ChatRequestBodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  let site;
  try {
    site = await resolveSite(body.embedKey, origin);
  } catch (err) {
    if (err instanceof SiteNotFoundError) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    if (err instanceof OriginNotAllowedError) {
      return NextResponse.json({ error: "origin_not_allowed" }, { status: 403 });
    }
    throw err;
  }

  if (!checkRateLimit(`${site.embedKey}:${body.visitorId}`)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: corsHeaders(origin!) });
  }

  const db = forOrg(site.orgId);

  // Resolve or create the conversation. A conversationId that doesn't
  // belong to this site+visitor is treated as not found — never let one
  // visitor read/append to another visitor's conversation by guessing ids.
  let conversation;
  if (body.conversationId) {
    conversation = await db.conversation.findUnique({ where: { id: body.conversationId } });
    if (!conversation || conversation.siteId !== site.id || conversation.visitorId !== body.visitorId) {
      return NextResponse.json({ error: "conversation_not_found" }, { status: 404, headers: corsHeaders(origin!) });
    }
  } else {
    conversation = await db.conversation.create({
      data: { orgId: site.orgId, siteId: site.id, visitorId: body.visitorId },
    });
  }

  await db.message.create({
    data: { orgId: site.orgId, conversationId: conversation.id, role: "USER", content: body.message },
  });

  const existingLead = await db.lead.findUnique({ where: { conversationId: conversation.id } });
  const persona = site.personaConfig as unknown as PersonaConfig;

  const allMessages = await db.message.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: "asc" },
  });

  let provider;
  try {
    provider = getAIProvider();
  } catch (err) {
    return NextResponse.json(
      { error: "ai_provider_unavailable", detail: err instanceof Error ? err.message : String(err) },
      { status: 500, headers: corsHeaders(origin!) },
    );
  }

  const tools = [
    {
      name: UPDATE_LEAD_PROFILE_TOOL_NAME,
      description:
        "Record or update any lead qualification fields you've learned this turn. Only include fields with new or corrected information.",
      parameters: UPDATE_LEAD_PROFILE_TOOL_SCHEMA,
    },
  ];

  let runningProfile: LeadProfile = leadToProfile(existingLead);
  let workingHistory: ChatHistoryMessage[] = buildHistoryFromMessages(allMessages);
  let replyText = "";
  const allToolCalls: { id: string; name: string; args: Record<string, unknown> }[] = [];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const systemPrompt = buildSystemPrompt(persona, runningProfile);

    let roundText = "";
    const roundToolCalls: { id: string; name: string; args: Record<string, unknown> }[] = [];

    for await (const event of provider.streamChat({ systemPrompt, history: workingHistory, tools })) {
      if (event.type === "text_delta") {
        roundText += event.text;
      } else if (event.type === "tool_call" && event.name === UPDATE_LEAD_PROFILE_TOOL_NAME) {
        roundToolCalls.push({ id: event.id, name: event.name, args: event.args });
      }
    }

    replyText += roundText;
    allToolCalls.push(...roundToolCalls);

    if (roundToolCalls.length === 0) {
      // No new tool calls — this round's text is the model's actual reply.
      break;
    }

    const validUpdates = roundToolCalls
      .map((call) => LeadProfileUpdateSchema.safeParse(call.args))
      .filter((result) => result.success)
      .map((result) => result.data);
    runningProfile = mergeProfileUpdates(runningProfile, validUpdates);

    // Extend the in-memory history for the follow-up round: the tool-call
    // round itself, plus a synthetic "ok" response per call so the next
    // provider call's message sequence is valid (OpenAI requires a tool
    // response message per call id; Gemini's history mapping just ignores
    // "tool" role entries).
    workingHistory = [
      ...workingHistory,
      { role: "assistant", content: roundText, toolCalls: roundToolCalls },
      ...roundToolCalls.map((call) => ({
        role: "tool" as const,
        content: "ok",
        toolCallId: call.id,
        toolName: call.name,
      })),
    ];
  }

  const updatedProfile = runningProfile;
  const scoreResult = scoreLead(updatedProfile);

  await db.message.create({
    data: {
      orgId: site.orgId,
      conversationId: conversation.id,
      role: "ASSISTANT",
      content: replyText,
      toolCallJson: allToolCalls.length > 0 ? allToolCalls : undefined,
    },
  });

  const lead = await db.lead.upsert({
    where: { conversationId: conversation.id },
    create: {
      orgId: site.orgId,
      conversationId: conversation.id,
      ...updatedProfile,
      score: scoreResult.score,
      scoreBreakdown: scoreResult.breakdown,
      status: scoreResult.status,
      scoredAt: new Date(),
    },
    update: {
      ...updatedProfile,
      score: scoreResult.score,
      scoreBreakdown: scoreResult.breakdown,
      status: scoreResult.status,
      scoredAt: new Date(),
    },
  });

  let bookingUrl: string | null = lead.bookingUrl;
  if (scoreResult.status === "QUALIFIED" && !bookingUrl) {
    const bookingProvider = await getBookingProvider(db, site.orgId);
    if (bookingProvider) {
      bookingUrl = bookingProvider.buildSchedulingUrl({
        leadProfile: updatedProfile,
        contactName: lead.contactName,
        contactEmail: lead.contactEmail,
      });
      await db.lead.update({ where: { conversationId: conversation.id }, data: { bookingUrl } });
    }
  }

  await db.conversation.update({
    where: { id: conversation.id },
    data: {
      status:
        scoreResult.status === "QUALIFIED" ? "QUALIFIED" : scoreResult.status === "DISQUALIFIED" ? "DISQUALIFIED" : "ACTIVE",
    },
  });

  return NextResponse.json(
    {
      conversationId: conversation.id,
      reply: replyText,
      lead: {
        score: scoreResult.score,
        status: scoreResult.status,
        bookingUrl: scoreResult.status === "QUALIFIED" ? bookingUrl : null,
      },
    },
    { headers: corsHeaders(origin!) },
  );
}
