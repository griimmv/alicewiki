import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { getCredential } from "./db.ts";

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
      const apiKey = getCredential("openai");
      if (!apiKey) {
        throw new Error("OpenAI API key is not set. Use /setKey openai <key> to add it.");
      }
      return new ChatOpenAI({
        model: modelName,
        temperature,
        apiKey,
      });
    }
    case "anthropic": {
      const apiKey = getCredential("anthropic");
      if (!apiKey) {
        throw new Error("Anthropic API key is not set. Use /setKey anthropic to add it.");
      }
      return new ChatAnthropic({
        model: modelName,
        temperature,
        anthropicApiKey: apiKey,
      });
    }
    case "google": {
      const apiKey = getCredential("google");
      if (!apiKey) {
        throw new Error("Google API key is not set. Use /setKey google to add it.");
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
  return "openai";
}

export function isValidProvider(name: string): name is ProviderName {
  return name === "openai" ||  name === "anthropic" || name === "google";
}

export const KNOWN_MODELS: Record<ProviderName, string[]> = {
  openai: [
    "gpt-4o", "gpt-4o-mini", "gpt-4.1", "gpt-4.1-mini", "gpt-4.1-nano",
    "gpt-5.4-mini", "o3", "o4-mini",
  ],
  anthropic: [
    "claude-sonnet-4-5", "claude-haiku-4-5", "claude-3-5-sonnet-latest",
    "claude-3-5-haiku-latest", "claude-opus-4-5",
  ],
  google: [
    "gemini-3.5-flash", "gemini-3.5-pro", "gemini-2.5-flash",
    "gemini-2.5-pro", "gemini-2.0-flash",
  ],
};

export function isValidModel(provider: ProviderName, model: string): boolean {
  return KNOWN_MODELS[provider].includes(model);
}
