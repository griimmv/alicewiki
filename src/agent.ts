import { wikipediaTool } from "./tools/wikipedia.ts";

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

function extractWikiTopic(query: string): string {
  return query.replace(/^(who is|what is|tell me about|explain|describe)/i, '').trim() || query;
}

export async function runAgent(agent: any, input: string): Promise<string> {
  try {
    // Detect if might need Wikipedia
    if (mightNeedWikipedia(input)) {
      try {
        const topic = extractWikiTopic(input);
        const wikiResult = await wikipediaTool.func(topic);
        
        const messages = [
          { role: "user", content: `User asked: "${input}"\n\nWikipedia information:\n${wikiResult}\n\nPlease provide a helpful answer based on this information.` }
        ];
        
        const response = await agent.llm.invoke(messages);
        return response.content || String(response);
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
