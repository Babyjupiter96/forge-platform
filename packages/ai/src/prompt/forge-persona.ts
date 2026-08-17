import type { LeadProfile, PersonaConfig } from "@forge/shared";

const SLOT_LABELS: Record<keyof LeadProfile, string> = {
  businessType: "business type",
  servicesOffered: "services offered",
  leadSources: "current lead sources",
  hasWebsite: "has a website",
  websiteUrl: "website URL",
  currentProblems: "current problems / what's not working",
  monthlyLeadVolume: "monthly lead/job volume",
  growthBottleneck: "biggest growth bottleneck",
  pipelineStage: "which pipeline stage is leaking (attract/convert/follow_up/close/measure)",
  fitServiceArea: "which service area fits (build/attract/automate/optimize)",
  budgetRange: "budget/investment range",
  timeline: "timeline",
  isDecisionMaker: "whether they're the decision maker",
};

function isFilled(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function describeKnownProfile(profile: Partial<LeadProfile>): string {
  const known = (Object.keys(SLOT_LABELS) as (keyof LeadProfile)[])
    .filter((key) => isFilled(profile[key]))
    .map((key) => `- ${SLOT_LABELS[key]}: ${JSON.stringify(profile[key])}`);
  const unknown = (Object.keys(SLOT_LABELS) as (keyof LeadProfile)[])
    .filter((key) => !isFilled(profile[key]))
    .map((key) => `- ${SLOT_LABELS[key]}`);

  return [
    known.length > 0 ? `Already known:\n${known.join("\n")}` : "Nothing is known about this visitor yet.",
    unknown.length > 0 ? `Still unknown:\n${unknown.join("\n")}` : "All qualification slots are filled.",
  ].join("\n\n");
}

/**
 * Builds the full system prompt for a turn, injecting the org's real
 * persona config (pipeline/pillar copy, CTA framing) and the lead
 * profile as currently known, so the model asks for what's missing
 * instead of re-asking what it already knows.
 */
export function buildSystemPrompt(persona: PersonaConfig, knownProfile: Partial<LeadProfile>): string {
  const pipelineLines = persona.pipeline
    .map((p) => `  ${p.label} (${p.stage}): ${p.description}`)
    .join("\n");
  const pillarLines = persona.pillars
    .map((p) => `  ${p.label} (${p.area}): ${p.description}`)
    .join("\n");
  const guardrailLines = persona.guardrails.map((g) => `- ${g}`).join("\n");

  return `You are ${persona.identity}

## Your target customer
${persona.targetCustomer}

## Your diagnostic lens — the revenue pipeline
This is how you privately reason about where a visitor's business is leaking. These are your internal
categories to diagnose with, not marketing copy to recite verbatim to the visitor:
${pipelineLines}

## Service fit taxonomy
Once you've diagnosed the leak, map it to one of these service areas — again, internal categories, not
something to read off as a menu:
${pillarLines}

## How to run the conversation
- Ask ONE question at a time, in whatever order the conversation naturally goes. NEVER present the
  qualification fields below as a checklist, form, or numbered list to the visitor.
- Follow the thread of what the visitor actually says. Example of the tone and depth expected:
  Visitor: "${persona.exampleExchange.visitor}"
  You: "${persona.exampleExchange.assistant}"
- Every turn where you learn something new (even partial or uncertain), call update_lead_profile with
  just the fields you learned or updated. Do this silently — never tell the visitor you're "recording"
  or "logging" anything.
- The qualification slots you're trying to fill over the course of the conversation:
${describeKnownProfile(knownProfile)}
- Once you and the visitor have covered enough ground that a real diagnosis is possible, pivot toward
  booking. Use this framing (never "give me your email" or a hard pitch): "${persona.ctaFraming}"
  CTA label: "${persona.ctaLabel}".
- The decision to actually offer a booking link is made by the backend based on a deterministic score —
  not by you. If the backend hasn't offered a booking link yet, keep diagnosing rather than assuming
  they're ready.

## Guardrails
${guardrailLines}
`;
}

export const UPDATE_LEAD_PROFILE_TOOL_NAME = "update_lead_profile";

export const UPDATE_LEAD_PROFILE_TOOL_SCHEMA = {
  type: "object",
  properties: {
    businessType: { type: "string" },
    servicesOffered: { type: "array", items: { type: "string" } },
    leadSources: {
      type: "array",
      items: { type: "string", enum: ["google", "social", "paid_ads", "referrals", "other"] },
    },
    hasWebsite: { type: "boolean" },
    websiteUrl: { type: "string" },
    currentProblems: { type: "array", items: { type: "string" } },
    monthlyLeadVolume: { type: "string", enum: ["0-10", "10-50", "50-200", "200+"] },
    growthBottleneck: { type: "string" },
    pipelineStage: { type: "string", enum: ["attract", "convert", "follow_up", "close", "measure"] },
    fitServiceArea: { type: "string", enum: ["build", "attract", "automate", "optimize"] },
    budgetRange: { type: "string", enum: ["<1k", "1k-3k", "3k-10k", "10k+", "unknown"] },
    timeline: { type: "string", enum: ["immediate", "1-3mo", "3-6mo", "exploring"] },
    isDecisionMaker: { type: "boolean" },
  },
  additionalProperties: false,
} as const;
