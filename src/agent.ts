import { wikipediaTool, WikiResult } from "./tools/wikipedia.js";
import * as z from "zod";

const ResponseSchema = z.object({
  summary: z.string().describe("2-3 paragraph synthesis of the information"),
  quotes: z.array(
    z.object({
      text: z.string().describe("a key quote or passage from the Wikipedia text"),
      source: z.string().describe("the Wikipedia page title"),
      url: z.string().describe("the Wikipedia page URL"),
    })
  ).describe("list of direct quotes from the Wikipedia article"),
  sources: z.array(
    z.object({
      title: z.string().describe("the Wikipedia page title"),
      url: z.string().describe("the Wikipedia page URL"),
    })
  ).describe("list of Wikipedia sources"),
});

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

        const messages = [
          { 
            role: "user", 
            content: `User asked: "${input}"

Wikipedia article about "${wikiData.title}":
${wikiData.extract}
Source: ${wikiData.url}

Respond ONLY with valid JSON, no other text:
{
  "summary": "2-3 paragraph synthesis of the information",
  "quotes": [
    {"text": "a key quote or passage from the Wikipedia text", "source": "${wikiData.title}", "url": "${wikiData.url}"}
  ],
  "sources": [
    {"title": "${wikiData.title}", "url": "${wikiData.url}"}
  ]
}`
          }
        ];
        
        const structuredLlm = agent.llm.withStructuredOutput(ResponseSchema);
        const response = await structuredLlm.invoke(messages);
        return JSON.stringify(response);
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
