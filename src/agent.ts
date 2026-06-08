import { wikipediaTool } from "./tools/wikipedia.js";

const SYSTEM_PROMPT = `You are a helpful assistant with access to Wikipedia. When the user asks about factual topics (people, places, history, concepts), use the wikipedia tool to look up the topic. For general chat or simple queries, answer directly.

Respond ONLY with valid JSON matching this schema, no other text:
{
  "summary": "2-3 paragraph synthesis of the information",
  "quotes": [{"text": "a key quote", "source": "Article title", "url": "https://..."}],
  "sources": [{"title": "Article title", "url": "https://..."}]
}`;

export function createAgent(llm: any) {
  return { llm, tools: [wikipediaTool] };
}

export function extractWikiTopic(query: string): string {
  return query
    .replace(/^(who is|what is|tell me about|explain|describe)\s+/i, '')
    .replace(/^(the|a|an)\s+/i, '')
    .trim() || query;
}

export async function runAgent(
  agent: any,
  input: string,
  history: any[] = []
): Promise<string> {
  const messages: any[] = [...history, { role: "user", content: input }];
  const maxLoops = 5;

  // infinite loop safeguard for llm to prevent token wasted on unnecessary tasks
  for (let i = 0; i < maxLoops; i++) {
    const result = await agent.llm.invoke(
      [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
      { tools: agent.tools }
    );

    // checks if result.content is an array or not and converts it into string
    const content =
      typeof result.content === "string"
        ? result.content
        : Array.isArray(result.content)
          ? result.content
              .map((c: any) => (typeof c === "string" ? c : c?.text ?? ""))
              .join("")
          : String(result.content ?? result);

    if (result.tool_calls?.length > 0) {
      messages.push({ role: "assistant", content: "", tool_calls: result.tool_calls });
      for (const tc of result.tool_calls) {
        const tool = agent.tools.find((t: any) => t.name === tc.name);
        if (tool) {
          const output = await tool.func(tc.args);
          messages.push({ role: "tool", content: output, tool_call_id: tc.id });
        }
      }
      continue;
    }

    const parsed = parseJSONFromText(content);
    if (parsed) return JSON.stringify(parsed);
    return content;
  }

  return JSON.stringify({
    summary: "I couldn't complete this request within the allowed steps.",
    quotes: [],
    sources: []
  });
}

function parseJSONFromText(text: string): Record<string, unknown> | null {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const str = match ? match[1] : text.trim();
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}
