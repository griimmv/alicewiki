import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

export type ProviderName = "opencode" | "anthropic" | "google";

export interface LLMConfig {
  provider: ProviderName;
  modelName?: string;
  temperature?: number;
}

const DEFAULT_MODELS: Record<ProviderName, string> = {
  opencode: "big-pickle",
  anthropic: "claude-sonnet-4-20250514",
  google: "gemini-2.0-flash",
};

export function createLLM(config: LLMConfig): any {
  const modelName = config.modelName || DEFAULT_MODELS[config.provider];
  const temperature = config.temperature ?? 0.7;

  switch (config.provider) {
    case "opencode": {
      const apiKey = process.env.OPENCODE_API_KEY;
      const apiBase = process.env.OPENCODE_API_BASE;
      if (!apiKey) {
        throw new Error("OPENCODE_API_KEY is not set in .env");
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
  if (provider === "opencode" || provider === "anthropic" || provider === "google") {
    return provider;
  }
  return "opencode";
}

export function isValidProvider(name: string): name is ProviderName {
  return name === "opencode" || name === "anthropic" || name === "google";
}
