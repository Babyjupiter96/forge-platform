export interface ChatHistoryMessage {
  role: "user" | "assistant" | "tool";
  content: string;
  /** Set when role === "tool": which assistant tool_call this responds to,
   *  and which function it was (providers that match by name rather than
   *  id, like Gemini, need the latter). */
  toolCallId?: string;
  toolName?: string;
  /** Set when role === "assistant" and it made tool calls this turn — required
   *  so OpenAI's message-sequence validation accepts a later "tool" role
   *  message replying to these call ids on the next turn. */
  toolCalls?: { id: string; name: string; args: Record<string, unknown> }[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema
}

export type AIStreamEvent =
  | { type: "text_delta"; text: string }
  | { type: "tool_call"; id: string; name: string; args: Record<string, unknown> }
  | { type: "done"; finishReason: string };

export interface ChatRequest {
  systemPrompt: string;
  history: ChatHistoryMessage[];
  tools: ToolDefinition[];
}

/**
 * Swappable AI backend. `OpenAIProvider` (packages/ai/src/providers/openai.ts)
 * is the only implementation today; adding Anthropic later means a new
 * file implementing this same interface, with a single call-site change
 * in the route handler that constructs the provider — no changes to
 * persona/scoring/business logic.
 */
export interface AIProvider {
  streamChat(request: ChatRequest): AsyncIterable<AIStreamEvent>;
}
