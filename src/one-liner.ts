import { wikipediaTool, WikiResult } from "./tools/wikipedia.js";
import { extractWikiTopic } from "./agent.js";

/**
 * I know there is already a parsing function in cli.ts (parseJSONResponse),
 * but it's not compatible with summary() output, so I make a new one to parse it.
 */
function parseWikipediaSummary(response: string): WikiResult | null {
  try {
    const parsed = JSON.parse(response.trim());
    if ("error" in parsed) return null;
    if ("title" in parsed && "extract" in parsed && "url" in parsed) {
      return parsed as WikiResult;
    }
    return null;
  } catch {
    return null;
  }
}

export async function runOneLiner(query: string): Promise<void> {
  const topic = extractWikiTopic(query);
  const raw = await wikipediaTool.func(topic);
  const result = parseWikipediaSummary(raw as string);

  if (!result) {
    console.log(`Error: Could not fetch Wikipedia summary for "${query}"`);
    return;
  }

  console.log(`\n\n${result.title}\n`);
  console.log(result.extract);
  console.log(`\n\n${result.url}\n`);
}
