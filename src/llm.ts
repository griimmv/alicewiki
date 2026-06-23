import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

export type ProviderName = "openai" | "anthropic" | "google";

export interface LLMConfig {
  provider: ProviderName;
  modelName?: string;
  temperature?: number;
}

export const DEFAULT_MODELS: Record<ProviderName, string> = {
  openai: "gpt-5.4-mini",
  anthropic: "claude-haiku-4-5",
  google: "gemini-3.5-flash",
};

// JSON mode is handled via .withStructuredOutput() in agent.ts
// Anthropic: uses prompt-based JSON (less reliable)

export function createLLM(config: LLMConfig): any {
  const modelName = config.modelName || DEFAULT_MODELS[config.provider];
  const temperature = config.temperature ?? 0.0;

  // Get API key from each provider
  switch (config.provider) {
    case "openai": {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error("OPENAI_API_KEY is not set in .env");
      }
      return new ChatOpenAI({
        model: modelName,
        temperature,
        apiKey,
      });
    }
    case "anthropic": {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        throw new Error("ANTHROPIC_API_KEY is not set in .env");
      }
      return new ChatAnthropic({
        model: modelName,
        temperature,
        anthropicApiKey: apiKey,
      });
    }
    case "google": {
      const apiKey = process.env.GOOGLE_API_KEY;
      if (!apiKey) {
        throw new Error("GOOGLE_API_KEY is not set in .env");
      }
      return new ChatGoogleGenerativeAI({
        model: modelName,
        temperature,
        apiKey,
      });
    }
    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }
}

export function getDefaultProvider(): ProviderName {
  const provider = process.env.DEFAULT_PROVIDER;
  if (provider === "openai" || provider === "anthropic" || provider === "google") {
    return provider;
  }
  return "openai"
}

export function isValidProvider(name: string): name is ProviderName {
  return name === "openai" ||  name === "anthropic" || name === "google";
}
