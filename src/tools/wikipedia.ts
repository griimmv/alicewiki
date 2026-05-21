import wiki from "wikipedia";
import { tool } from "@langchain/core/tools";
import * as z from "zod";

export interface WikiResult {
  title: string;
  url: string;
  extract: string;
  thumbnail?: string;
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
      return JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" });
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
