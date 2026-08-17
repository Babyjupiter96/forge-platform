import { OpenAIProvider, type AIProvider } from "@forge/ai";

/**
 * Single call site that constructs the AI backend. Adding Anthropic later
 * means a new provider class in packages/ai plus one more branch here —
 * nothing else in the app touches a specific vendor's SDK.
 */
export function getAIProvider(): AIProvider {
  const providerName = process.env.AI_PROVIDER ?? "openai";

  if (providerName === "openai") {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not set — add it to .env before using the chat endpoint");
    }
    return new OpenAIProvider({ apiKey, model: process.env.AI_MODEL });
  }

  throw new Error(`Unknown AI_PROVIDER: ${providerName}`);
}
