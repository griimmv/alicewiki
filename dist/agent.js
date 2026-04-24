import { wikipediaTool } from "./tools/wikipedia.js";
import { createReactAgent } from "langchain/dist/agents";
export function createAgent(llm) {
    return createReactAgent({
        llm,
        tools: [wikipediaTool],
    });
}
export async function runAgent(agent, input) {
    const result = await agent.invoke({ input });
    return result.output;
}
//# sourceMappingURL=agent.js.map