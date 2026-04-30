import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
const DEFAULT_MODELS = {
    openai: "gpt-5.4-mini",
    //opencode: "big-pickle",
    anthropic: "claude-sonnet-4-20250514",
    google: "gemini-2.0-flash",
};
export function createLLM(config) {
    const modelName = config.modelName || DEFAULT_MODELS[config.provider];
    const temperature = config.temperature ?? 0.0;
    // Get API key from each provider
    switch (config.provider) {
        /*
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
            baseURL: apiBase,
          });
        }
        */
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
export function getDefaultProvider() {
    const provider = process.env.DEFAULT_PROVIDER;
    if (provider === "openai" || /* provider === "opencode"  || */ provider === "anthropic" || provider === "google") {
        return provider;
    }
    return "openai";
}
export function isValidProvider(name) {
    return name === "openai" || /* name === "opencode"  || */ name === "anthropic" || name === "google";
}
//# sourceMappingURL=llm.js.map