import { GoogleGenerativeAI } from "@google/generative-ai";
import type { Content, FunctionDeclarationSchema } from "@google/generative-ai";
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
    this.modelName = opts.model ?? "gemini-2.0-flash";
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
 * Gemini has no equivalent of OpenAI's "tool" role message (an
 * acknowledgment reply required to satisfy OpenAI's own protocol) — our
 * synthetic "ok" tool-response entries exist only to keep OpenAI happy on
 * replay, so they're simply dropped here rather than translated.
 */
function toGeminiHistory(history: ChatHistoryMessage[]): Content[] {
  return history
    .filter((m) => m.role !== "tool")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content || " " }],
    }));
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
