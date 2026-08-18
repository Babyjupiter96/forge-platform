import { GoogleGenerativeAI } from "@google/generative-ai";
import type { Content, FunctionDeclarationSchema, Part } from "@google/generative-ai";
import type { AIProvider, AIStreamEvent, ChatHistoryMessage, ChatRequest } from "../provider";

/**
 * Free-tier alternative to OpenAIProvider, same AIProvider interface —
 * swap via AI_PROVIDER=gemini in .env, no business-logic changes. Useful
 * when OpenAI billing isn't set up yet; swapping back to OpenAI later is
 * a one-line env change.
 */
export class GeminiProvider implements AIProvider {
  private readonly client: GoogleGenerativeAI;
  private readonly modelName: string;

  constructor(opts: { apiKey: string; model?: string }) {
    this.client = new GoogleGenerativeAI(opts.apiKey);
    this.modelName = opts.model ?? "gemini-3.6-flash";
  }

  async *streamChat(request: ChatRequest): AsyncIterable<AIStreamEvent> {
    const tools =
      request.tools.length > 0
        ? [
            {
              functionDeclarations: request.tools.map((t) => ({
                name: t.name,
                description: t.description,
                parameters: toGeminiSchema(t.parameters) as unknown as FunctionDeclarationSchema,
              })),
            },
          ]
        : undefined;

    const model = this.client.getGenerativeModel({
      model: this.modelName,
      systemInstruction: request.systemPrompt,
      tools,
    });

    const history = toGeminiHistory(request.history);
    const lastTurn = history.pop();
    if (!lastTurn) {
      yield { type: "done", finishReason: "stop" };
      return;
    }

    const chat = model.startChat({ history });
    const result = await chat.sendMessageStream(lastTurn.parts);

    let finishReason = "stop";
    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) yield { type: "text_delta", text };

      for (const call of chunk.functionCalls() ?? []) {
        yield {
          type: "tool_call",
          id: `${call.name}-${Math.random().toString(36).slice(2, 10)}`,
          name: call.name,
          args: (call.args ?? {}) as Record<string, unknown>,
        };
      }
    }

    yield { type: "done", finishReason };
  }
}

/**
 * Gemini represents a tool-calling exchange with actual functionCall /
 * functionResponse parts, not plain text — collapsing a tool call into an
 * empty-text "model" turn (an earlier version of this function did
 * exactly that) means the model has no record it ever called anything,
 * and it will just call the same function again on the next round
 * instead of ever producing a final reply. Each entry here maps
 * structurally, not just by role name.
 */
function toGeminiHistory(history: ChatHistoryMessage[]): Content[] {
  return history.map((m): Content => {
    if (m.role === "user") {
      return { role: "user", parts: [{ text: m.content || " " }] };
    }

    if (m.role === "assistant") {
      const parts: Part[] = [];
      if (m.content) parts.push({ text: m.content });
      for (const call of m.toolCalls ?? []) {
        parts.push({ functionCall: { name: call.name, args: call.args } } as Part);
      }
      if (parts.length === 0) parts.push({ text: " " });
      return { role: "model", parts };
    }

    // role === "tool": Gemini's function-response turn.
    return {
      role: "function",
      parts: [{ functionResponse: { name: m.toolName ?? "unknown", response: { status: "ok" } } } as Part],
    };
  });
}

/**
 * Our shared tool schemas are written as plain JSON Schema (lowercase
 * "object"/"string"/etc., used as-is for OpenAI's tool-calling API).
 * Gemini's function-declaration schema wants the same shape but with
 * uppercase type names — this converts recursively rather than
 * maintaining a second, Gemini-specific copy of every tool schema.
 */
function toGeminiSchema(schema: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  if (typeof schema.type === "string") {
    out.type = schema.type.toUpperCase();
  }
  if (typeof schema.description === "string") {
    out.description = schema.description;
  }
  if (Array.isArray(schema.enum)) {
    out.enum = schema.enum;
  }
  if (schema.properties && typeof schema.properties === "object") {
    out.properties = Object.fromEntries(
      Object.entries(schema.properties as Record<string, unknown>).map(([key, value]) => [
        key,
        toGeminiSchema(value as Record<string, unknown>),
      ]),
    );
  }
  if (schema.items && typeof schema.items === "object") {
    out.items = toGeminiSchema(schema.items as Record<string, unknown>);
  }

  return out;
}
