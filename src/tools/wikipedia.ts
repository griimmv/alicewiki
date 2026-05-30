import wiki from "wikipedia";
import { tool } from "@langchain/core/tools";
import * as z from "zod";
import { createRequire } from "node:module";

/**
 * The wikipedia npm package is CJS. When imported via ESM (`import wiki from "wikipedia"`),
 * only `summary` survives the interop wrapping — `search` is lost at runtime.
 * `as any` would silently hide this. So we use createRequire to access the CJS module
 * which has all methods including `search`.
 */
const require = createRequire(import.meta.url);
const wikiCjs = require("wikipedia");

export interface WikiResult {
  title: string;
  url: string;
  extract: string;
  thumbnail?: string;
  notification?: string;
}

export const wikipediaTool = tool(
  async (input: string): Promise<string> => {
    try {
      const summary = await wiki.summary(input);

      const url = `https://en.wikipedia.org/wiki/${encodeURIComponent(summary.title.replace(/ /g, '_'))}`;

      return JSON.stringify({
        title: summary.title,
        url,
        extract: summary.extract,
        thumbnail: summary.thumbnail?.source
      });
    } catch (error) {
      try {
        const searchResults = await wikiCjs.search(input, { limit: 1 });
        if (searchResults.results.length === 0) {
          return JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" });
        }
        const firstResult = searchResults.results[0];
        const fallbackSummary = await wiki.summary(firstResult.title);
        const url = `https://en.wikipedia.org/wiki/${encodeURIComponent(fallbackSummary.title.replace(/ /g, '_'))}`;
        return JSON.stringify({
          title: fallbackSummary.title,
          url,
          extract: fallbackSummary.extract,
          thumbnail: fallbackSummary.thumbnail?.source,
          notification: "  (No title matched the query, using fuzzy finder option that might be inaccurate)"
        });
      } catch (searchError) {
        return JSON.stringify({ error: searchError instanceof Error ? searchError.message : "Unknown error" });
      }
    }
  },
  {
    name: "wikipedia",
    description:
      "A Wikipedia search tool. Use this when the user asks about factual information, people, places, history, or any topic that can be found on Wikipedia. Input should be a search query or topic name.",
    schema: z.string(),
  }
);

export const tools = [wikipediaTool];
