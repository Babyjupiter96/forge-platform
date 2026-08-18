import type { Message } from "@forge/db";
import type { ChatHistoryMessage } from "@forge/ai";

/**
 * Rebuilds OpenAI-protocol-valid history from our stored Message rows.
 * An ASSISTANT row that made tool calls (toolCallJson set) must be
 * followed by one synthetic "tool" role entry per call id, or the next
 * API request fails OpenAI's message-sequence validation. We don't
 * persist those synthetic responses in the DB — their content is always
 * the constant "ok" acknowledgment, so there's nothing worth storing.
 */
export function buildHistoryFromMessages(messages: Message[]): ChatHistoryMessage[] {
  const history: ChatHistoryMessage[] = [];

  for (const message of messages) {
    if (message.role === "USER") {
      history.push({ role: "user", content: message.content });
      continue;
    }

    if (message.role === "ASSISTANT") {
      const rawToolCalls = message.toolCallJson as
        | { id: string; name: string; args: Record<string, unknown> }[]
        | null;

      history.push({
        role: "assistant",
        content: message.content,
        toolCalls: rawToolCalls ?? undefined,
      });

      for (const call of rawToolCalls ?? []) {
        history.push({ role: "tool", content: "ok", toolCallId: call.id, toolName: call.name });
      }
    }
    // SYSTEM/TOOL rows are not persisted directly today — system prompt is
    // rebuilt fresh each turn, and tool responses are synthesized above.
  }

  return history;
}
