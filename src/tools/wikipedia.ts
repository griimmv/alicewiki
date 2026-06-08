import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const wikiCjs = require("wikipedia");

const MAX_CONTENT_CHARS = 8000;

export interface WikiResult {
  title: string;
  url: string;
  extract: string;
  fullContent?: string;
  thumbnail?: string;
  notification?: string;
}

async function fetchPage(input: string): Promise<WikiResult> {
  const page = await wikiCjs.page(input, { preload: true });
  const [pageSummary, content] = await Promise.all([
    page.summary(),
    page.content(),
  ]);

  const url = `https://en.wikipedia.org/wiki/${encodeURIComponent(pageSummary.title.replace(/ /g, '_'))}`;
  const truncated = content.length > MAX_CONTENT_CHARS
  const suffix = "\n\n[...content truncated]";
    ? content.slice(0, MAX_CONTENT_CHARS - suffix.length) + suffix
    : content;

  return {
    title: pageSummary.title,
    url,
    extract: pageSummary.extract,
    fullContent: truncated,
    thumbnail: pageSummary.thumbnail?.source,
  };
}

export const wikipediaTool = tool(
  async (input: { query: string }): Promise<string> => {
    const topic = input.query;
    try {
      const result = await fetchPage(topic);
      return JSON.stringify(result);
    } catch (error) {
      try {
        const searchResults = await wikiCjs.search(topic, { limit: 1 });
        if (searchResults.results.length === 0) {
          return JSON.stringify({ title: "", url: "", extract: "", fullContent: "", thumbnail: "", notification: `Search failed: ${error instanceof Error ? error.message : "Unknown error"}` });
        }
        const result = await fetchPage(searchResults.results[0].title);
        result.notification = "  (No title matched the query, using fuzzy finder option that might be inaccurate)";
        return JSON.stringify(result);
      } catch (searchError) {
        return JSON.stringify({ title: "", url: "", extract: "", fullContent: "", thumbnail: "", notification: `Fallback: ${searchError instanceof Error ? searchError.message : "Unknown error"}` });
      }
    }
  },
  {
    name: "wikipedia",
    description:
      "A Wikipedia search tool. Use this when the user asks about factual information, people, places, history, or any topic that can be found on Wikipedia. Input should be a search query or topic name.",
    schema: z.object({
      query: z.string().describe("The topic to search for on Wikipedia"),
    }),
  }
);

export const tools = [wikipediaTool];
