import { BaseChatModel } from "langchain/dist/chat_models/base.js";
import { AgentExecutor } from "langchain/dist/agents/agent_executor.js";
export declare function createAgent(llm: BaseChatModel): AgentExecutor;
export declare function runAgent(agent: AgentExecutor, input: string): Promise<string>;
//# sourceMappingURL=agent.d.ts.map