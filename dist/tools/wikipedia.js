import wiki from "wikipedia";
import { Tool } from "langchain/tools";
export const wikipediaTool = new Tool({
    name: "wikipedia",
    description: "A Wikipedia search tool. Use this when the user asks about factual information, people, places, history, or any topic that can be found on Wikipedia. Input should be a search query or topic name.",
    func: async (input) => {
        try {
            const summary = await wiki.summary(input);
            let result = `Title: ${summary.title}\n\n`;
            result += `Summary: ${summary.extract}\n`;
            if (summary.thumbnail?.source) {
                result += `\nImage: ${summary.thumbnail.source}`;
            }
            return result;
        }
        catch (error) {
            if (error instanceof Error) {
                return `Wikipedia error: ${error.message}`;
            }
            return "Unknown error occurred while fetching Wikipedia article";
        }
    },
});
export const tools = [wikipediaTool];
//# sourceMappingURL=wikipedia.js.map