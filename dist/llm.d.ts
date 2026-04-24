import { BaseChatModel } from "langchain/dist/chat_models/base.js";
export type ProviderName = "openai" | "anthropic" | "google";
export interface LLMConfig {
    provider: ProviderName;
    modelName?: string;
    temperature?: number;
}
export declare function createLLM(config: LLMConfig): BaseChatModel;
export declare function getDefaultProvider(): ProviderName;
export declare function isValidProvider(name: string): name is ProviderName;
//# sourceMappingURL=llm.d.ts.map