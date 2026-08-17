export interface ThemeTokens {
  bg: string;
  panel: string;
  panelAlt: string;
  ink: string;
  inkSoft: string;
  muted: string;
  accent: string;
  steel: string;
  rule: string;
  ruleStrong: string;
  fontHeadline: string;
  fontLabel: string;
  fontBody: string;
}

export interface PipelineStageCopy {
  stage: "attract" | "convert" | "follow_up" | "close" | "measure";
  label: string;
  description: string;
}

export interface ServicePillarCopy {
  area: "build" | "attract" | "automate" | "optimize";
  label: string;
  description: string;
}

export interface PersonaConfig {
  orgName: string;
  identity: string;
  pipeline: PipelineStageCopy[];
  pillars: ServicePillarCopy[];
  ctaLabel: string;
  ctaFraming: string;
  exampleExchange: { visitor: string; assistant: string };
  targetCustomer: string;
  guardrails: string[];
}

export interface WidgetConfigResponse {
  siteName: string;
  greeting: string;
  theme: ThemeTokens;
  ctaLabel: string;
}

export type ChatRole = "user" | "assistant";

export interface ChatMessageInput {
  visitorId: string;
  conversationId?: string;
  message: string;
}
