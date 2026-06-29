import { mock, test, expect, beforeAll, describe } from "bun:test";

mock.module("../tools/wikipedia.ts", () => ({
  wikipediaTool: { name: "wikipedia", func: async () => "{}" },
  tools: [{ name: "wikipedia", func: async () => "{}" }],
}));

let runAgent: any;
let extractWikiTopic: any;

beforeAll(async () => {
  const mod = await import("../agent.ts");
  runAgent = mod.runAgent;
  extractWikiTopic = mod.extractWikiTopic;
});

const mockTool = {
  name: "wikipedia",
  func: async (args: { query: string }) =>
    JSON.stringify({
      title: args.query,
      extract: `Extract of ${args.query}`,
      fullContent: `Full content of ${args.query}`,
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(args.query)}`,
      foundArticle: true,
    }),
};

function captureMockLLM(responses: any[]) {
  let callIndex = 0;
  const calls: any[] = [];
  const mock = {
    invoke: async (messages: any[], options: any) => {
      calls.push({ messages, options });
      const response = responses[callIndex];
      callIndex++;
      return typeof response === "function" ? response({ messages, options, index: callIndex - 1 }) : response;
    },
    calls: () => calls,
    callCount: () => calls.length,
    lastMessages: () => calls[calls.length - 1]?.messages,
  };
  return mock;
}

describe("runAgent", () => {
  test("returns parsed JSON when LLM responds directly (no tool call)", async () => {
    const mockLLM = captureMockLLM([
      {
        content: JSON.stringify({
          summary: "Python is a programming language.",
          quotes: [{ text: "A key quote", source: "Wikipedia", url: "https://..." }],
          sources: [{ title: "Wikipedia", url: "https://..." }],
        }),
        usage_metadata: { input_tokens: 10, output_tokens: 20, total_tokens: 30 },
      },
    ]);
    const agent = { llm: mockLLM, tools: [mockTool] };
    const result = await runAgent(agent, "what is Python");
    const parsed = JSON.parse(result.content);
    expect(parsed.summary).toBe("Python is a programming language.");
    expect(parsed.quotes).toHaveLength(1);
    expect(parsed.sources).toHaveLength(1);
  });

  test("calls tool and returns LLM synthesis (2-loop workflow)", async () => {
    const mockLLM = captureMockLLM([
      {
        content: "",
        tool_calls: [{ name: "wikipedia", args: { query: "Python programming language" }, id: "call_1" }],
        usage_metadata: { input_tokens: 15, output_tokens: 5, total_tokens: 20 },
      },
      {
        content: JSON.stringify({
          summary: "Python is a high-level programming language.",
          quotes: [{ text: "Python is a high-level language", source: "Python", url: "https://en.wikipedia.org/wiki/Python" }],
          sources: [{ title: "Python (programming language)", url: "https://en.wikipedia.org/wiki/Python_(programming_language)" }],
        }),
        usage_metadata: { input_tokens: 30, output_tokens: 25, total_tokens: 55 },
      },
    ]);
    const agent = { llm: mockLLM, tools: [mockTool] };
    const result = await runAgent(agent, "what is Python");
    const parsed = JSON.parse(result.content);
    expect(parsed.summary).toContain("Python");
    expect(mockLLM.callCount()).toBe(2);
  });

  test("skips unknown tool calls gracefully", async () => {
    const mockLLM = captureMockLLM([
      {
        content: "",
        tool_calls: [{ name: "nonexistent_tool", args: {}, id: "call_1" }],
        usage_metadata: { input_tokens: 5, output_tokens: 5, total_tokens: 10 },
      },
      {
        content: JSON.stringify({ summary: "No tool was called", quotes: [], sources: [] }),
        usage_metadata: { input_tokens: 10, output_tokens: 10, total_tokens: 20 },
      },
    ]);
    const agent = { llm: mockLLM, tools: [mockTool] };
    const result = await runAgent(agent, "test");
    const parsed = JSON.parse(result.content);
    expect(parsed.summary).toBe("No tool was called");
  });

  test("falls back to raw text when LLM returns unparseable content", async () => {
    const mockLLM = captureMockLLM([
      {
        content: "Hello! How can I help you today?",
        usage_metadata: { input_tokens: 5, output_tokens: 10, total_tokens: 15 },
      },
    ]);
    const agent = { llm: mockLLM, tools: [mockTool] };
    const result = await runAgent(agent, "hi");
    expect(result.content).toBe("Hello! How can I help you today?");
  });

  test("falls back to raw text when LLM returns unparseable JSON", async () => {
    const mockLLM = captureMockLLM([
      {
        content: 'Some text before ```json\n{"summary": "test"}\n```',
        usage_metadata: { input_tokens: 5, output_tokens: 5, total_tokens: 10 },
      },
    ]);
    const agent = { llm: mockLLM, tools: [mockTool] };
    const result = await runAgent(agent, "test");
    const parsed = JSON.parse(result.content);
    expect(parsed.summary).toBe("test");
  });

  test("returns fallback error when max loops exhausted", async () => {
    const mockLLM = captureMockLLM([
      {
        content: "",
        tool_calls: [{ name: "wikipedia", args: { query: "test" }, id: "call_1" }],
        usage_metadata: { input_tokens: 5, output_tokens: 5, total_tokens: 10 },
      },
      {
        content: "",
        tool_calls: [{ name: "wikipedia", args: { query: "test2" }, id: "call_2" }],
        usage_metadata: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
      },
    ]);
    const agent = { llm: mockLLM, tools: [mockTool] };
    const result = await runAgent(agent, "test");
    const parsed = JSON.parse(result.content);
    expect(parsed.summary).toBe("I couldn't complete this request within the allowed steps.");
  });

  test("accumulates token usage across invocations", async () => {
    const mockLLM = captureMockLLM([
      {
        content: "",
        tool_calls: [{ name: "wikipedia", args: { query: "test" }, id: "call_1" }],
        usage_metadata: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
      },
      {
        content: JSON.stringify({ summary: "Done", quotes: [], sources: [] }),
        usage_metadata: { input_tokens: 20, output_tokens: 15, total_tokens: 35 },
      },
    ]);
    const agent = { llm: mockLLM, tools: [mockTool] };
    const result = await runAgent(agent, "test");
    expect(result.tokens.input).toBe(30);
    expect(result.tokens.output).toBe(20);
    expect(result.tokens.total).toBe(50);
  });

  test("preserves conversation history across loops", async () => {
    const mockLLM = captureMockLLM([
      {
        content: "",
        tool_calls: [{ name: "wikipedia", args: { query: "test" }, id: "call_1" }],
      },
      {
        content: JSON.stringify({ summary: "Final response", quotes: [], sources: [] }),
      },
    ]);
    const agent = { llm: mockLLM, tools: [mockTool] };
    const history = [{ role: "user", content: "previous message" }];
    await runAgent(agent, "current message", history);
    const firstMessages = mockLLM.calls()[0].messages;
    const hasHistory = firstMessages.some((m: any) => m.content === "previous message");
    expect(hasHistory).toBe(true);
    const hasCurrent = firstMessages.some((m: any) => m.content === "current message");
    expect(hasCurrent).toBe(true);
    const hasSystem = firstMessages.some((m: any) => m.role === "system");
    expect(hasSystem).toBe(true);
  });

  test("includes tool result in second LLM call messages", async () => {
    const mockLLM = captureMockLLM([
      {
        content: "",
        tool_calls: [{ name: "wikipedia", args: { query: "test query" }, id: "call_1" }],
      },
      {
        content: JSON.stringify({ summary: "Based on Wikipedia", quotes: [], sources: [] }),
      },
    ]);
    const agent = { llm: mockLLM, tools: [mockTool] };
    await runAgent(agent, "search this");
    const secondMessages = mockLLM.calls()[1].messages;
    const toolMessages = secondMessages.filter((m: any) => m.role === "tool");
    expect(toolMessages.length).toBe(1);
    expect(toolMessages[0].tool_call_id).toBe("call_1");
  });

  test("aborts when signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const agent = {
      llm: {
        invoke: async (_messages: any[], options: any) => {
          if (options.signal?.aborted) {
            throw new DOMException("Aborted", "AbortError");
          }
          return { content: JSON.stringify({ summary: "should not reach", quotes: [], sources: [] }) };
        },
      },
      tools: [mockTool],
    };
    await expect(runAgent(agent, "test", [], controller.signal)).rejects.toThrow("Aborted");
  });
});
