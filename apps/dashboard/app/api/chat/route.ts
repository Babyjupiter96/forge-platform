import { NextResponse } from "next/server";
import { z } from "zod";
import { forOrg } from "@forge/db";
import type { PersonaConfig } from "@forge/shared";
import { LeadProfileUpdateSchema } from "@forge/shared";
import {
  buildSystemPrompt,
  scoreLead,
  UPDATE_LEAD_PROFILE_TOOL_NAME,
  UPDATE_LEAD_PROFILE_TOOL_SCHEMA,
} from "@forge/ai";
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
  const currentProfile = leadToProfile(existingLead);
  const persona = site.personaConfig as unknown as PersonaConfig;
  const systemPrompt = buildSystemPrompt(persona, currentProfile);

  const allMessages = await db.message.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: "asc" },
  });
  const history = buildHistoryFromMessages(allMessages);

  let provider;
  try {
    provider = getAIProvider();
  } catch (err) {
    return NextResponse.json(
      { error: "ai_provider_unavailable", detail: err instanceof Error ? err.message : String(err) },
      { status: 500, headers: corsHeaders(origin!) },
    );
  }

  let replyText = "";
  const rawToolCalls: { id: string; name: string; args: Record<string, unknown> }[] = [];

  for await (const event of provider.streamChat({
    systemPrompt,
    history,
    tools: [
      {
        name: UPDATE_LEAD_PROFILE_TOOL_NAME,
        description:
          "Record or update any lead qualification fields you've learned this turn. Only include fields with new or corrected information.",
        parameters: UPDATE_LEAD_PROFILE_TOOL_SCHEMA,
      },
    ],
  })) {
    if (event.type === "text_delta") {
      replyText += event.text;
    } else if (event.type === "tool_call" && event.name === UPDATE_LEAD_PROFILE_TOOL_NAME) {
      rawToolCalls.push({ id: event.id, name: event.name, args: event.args });
    }
  }

  const validUpdates = rawToolCalls
    .map((call) => LeadProfileUpdateSchema.safeParse(call.args))
    .filter((result) => result.success)
    .map((result) => result.data);

  const updatedProfile = mergeProfileUpdates(currentProfile, validUpdates);
  const scoreResult = scoreLead(updatedProfile);

  await db.message.create({
    data: {
      orgId: site.orgId,
      conversationId: conversation.id,
      role: "ASSISTANT",
      content: replyText,
      toolCallJson: rawToolCalls.length > 0 ? rawToolCalls : undefined,
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
