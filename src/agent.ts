import { wikipediaTool, WikiResult } from "./tools/wikipedia.js";

function parseJSONFromText(text: string): Record<string, unknown> | null {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const str = match ? match[1] : text.trim();
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

function buildJsonPrompt(input: string, wikiData: WikiResult): string {
  return `User asked: "${input}"

Wikipedia article about "${wikiData.title}":
${wikiData.extract}
Source: ${wikiData.url}

Respond ONLY with valid JSON matching this schema, no other text:
{
  "summary": "2-3 paragraph synthesis of the information",
  "quotes": [
    {"text": "a key quote or passage from the Wikipedia text", "source": "${wikiData.title}", "url": "${wikiData.url}"}
  ],
  "sources": [
    {"title": "${wikiData.title}", "url": "${wikiData.url}"}
  ]
}`;
}

export function createAgent(llm: any) {
  return {
    llm,
    tools: [wikipediaTool],
  };
}

const WIKI_KEYWORDS = [
  'who', 'what', 'where', 'when', 'why', 'how', 'explain', 'describe',
  'information', 'about', 'definition', 'history', 'person', 'place'
];

function mightNeedWikipedia(query: string): boolean {
  const lower = query.toLowerCase();
  return WIKI_KEYWORDS.some(kw => lower.includes(kw));
}

export function extractWikiTopic(query: string): string {
  return query
    .replace(/^(who is|what is|tell me about|explain|describe)\s+/i, '')
    .replace(/^(the|a|an)\s+/i, '')
    .trim() || query;
}

export async function runAgent(agent: any, input: string): Promise<string> {
  try {
    // Detect if might need Wikipedia
    if (mightNeedWikipedia(input)) {
      try {
        const topic = extractWikiTopic(input);
        const rawWikiResult = await wikipediaTool.func(topic);
        const rawResult = typeof rawWikiResult === 'string' ? rawWikiResult : String(rawWikiResult);
        
        let wikiData: WikiResult;
        try {
          wikiData = JSON.parse(rawResult);
        } catch {
          return "Error: Failed to parse Wikipedia response";
        }

        if ("error" in wikiData) {
          return `Wikipedia error: ${wikiData.error}`;
        }

        const messages = [{ role: "user", content: buildJsonPrompt(input, wikiData) }];
        const result = await agent.llm.invoke(messages);
        const content = result.content || String(result);
        const parsed = parseJSONFromText(content);
        if (parsed) return JSON.stringify(parsed);
        return content;
      } catch (wikiError) {
        const response = await agent.llm.invoke([{ role: "user", content: input }]);
        return response.content || String(response);
      }
    }
    
    const messages = [{ role: "user", content: input }];
    const response = await agent.llm.invoke(messages);
    return response.content || String(response);
  } catch (error) {
    if (error instanceof Error) {
      return `Error: ${error.message}`;
    }
    return "Unknown error occurred";
  }
}
