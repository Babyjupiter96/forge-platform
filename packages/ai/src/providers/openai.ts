import OpenAI from "openai";
import type { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/index";
import type { AIProvider, AIStreamEvent, ChatRequest } from "../provider";

interface PendingToolCall {
  id: string;
  name: string;
  argsText: string;
}

export class OpenAIProvider implements AIProvider {
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(opts: { apiKey: string; model?: string }) {
    this.client = new OpenAI({ apiKey: opts.apiKey });
    this.model = opts.model ?? "gpt-4o-mini";
  }

  async *streamChat(request: ChatRequest): AsyncIterable<AIStreamEvent> {
    const messages: ChatCompletionMessageParam[] = [
      { role: "system", content: request.systemPrompt },
      ...request.history.map((m): ChatCompletionMessageParam => {
        if (m.role === "tool") {
          return { role: "tool", content: m.content, tool_call_id: m.toolCallId ?? "" };
        }
        if (m.role === "assistant") {
          return {
            role: "assistant",
            content: m.content || null,
            tool_calls: m.toolCalls?.map((tc) => ({
              id: tc.id,
              type: "function" as const,
              function: { name: tc.name, arguments: JSON.stringify(tc.args) },
            })),
          };
        }
        return { role: "user", content: m.content };
      }),
    ];

    const tools: ChatCompletionTool[] = request.tools.map((t) => ({
      type: "function",
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));

    const stream = await this.client.chat.completions.create({
      model: this.model,
      messages,
      tools: tools.length > 0 ? tools : undefined,
      stream: true,
    });

    // OpenAI streams tool-call args as fragmented deltas, keyed by index,
    // that must be accumulated before they're valid JSON.
    const pending = new Map<number, PendingToolCall>();
    let finishReason = "stop";

    for await (const chunk of stream) {
      const choice = chunk.choices[0];
      if (!choice) continue;

      if (choice.delta?.content) {
        yield { type: "text_delta", text: choice.delta.content };
      }

      for (const toolCallDelta of choice.delta?.tool_calls ?? []) {
        const idx = toolCallDelta.index;
        const existing = pending.get(idx) ?? { id: "", name: "", argsText: "" };
        if (toolCallDelta.id) existing.id = toolCallDelta.id;
        if (toolCallDelta.function?.name) existing.name += toolCallDelta.function.name;
        if (toolCallDelta.function?.arguments) existing.argsText += toolCallDelta.function.arguments;
        pending.set(idx, existing);
      }

      if (choice.finish_reason) {
        finishReason = choice.finish_reason;
      }
    }

    for (const call of pending.values()) {
      let args: Record<string, unknown> = {};
      try {
        args = call.argsText ? JSON.parse(call.argsText) : {};
      } catch {
        args = {};
      }
      yield { type: "tool_call", id: call.id, name: call.name, args };
    }

    yield { type: "done", finishReason };
  }
}
