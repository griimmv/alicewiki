import { mock, test, expect, beforeAll, beforeEach, afterEach, describe } from "bun:test";

const mockLogs: string[] = [];
let originalLog: typeof console.log;

mock.module("../tools/wikipedia.ts", () => ({
  wikipediaTool: {
    name: "wikipedia",
    func: async (input: { query: string }) => {
      if (input.query === "nonexistent") {
        return JSON.stringify({ title: "", extract: "", url: "", foundArticle: false, notification: `No Wikipedia article found for "${input.query}"` });
      }
      if (input.query === "error") {
        return JSON.stringify({ error: "Something went wrong" });
      }
      return JSON.stringify({
        title: input.query,
        extract: `Extract of ${input.query}`,
        url: `https://en.wikipedia.org/wiki/${encodeURIComponent(input.query)}`,
        foundArticle: true,
      });
    },
  },
  WikiResult: {},
}));

let runOneLiner: any;

beforeAll(async () => {
  const mod = await import("../one-liner.ts");
  runOneLiner = mod.runOneLiner;
});

beforeEach(() => {
  mockLogs.length = 0;
  originalLog = console.log;
  console.log = (...args: any[]) => {
    mockLogs.push(args.map(String).join(" "));
  };
});

afterEach(() => {
  console.log = originalLog;
});

describe("runOneLiner", () => {
  test("prints title, extract, and url for a valid query", async () => {
    await runOneLiner("Python");
    const output = mockLogs.join("\n");
    expect(output).toContain("Python");
    expect(output).toContain("Extract of Python");
    expect(output).toContain("https://en.wikipedia.org/wiki/Python");
  });

  test("prints notification when article not found", async () => {
    await runOneLiner("nonexistent");
    const output = mockLogs.join("\n");
    expect(output).toContain("No Wikipedia article found");
    expect(output).toContain("nonexistent");
  });

  test("prints error for invalid response shape", async () => {
    await runOneLiner("error");
    const output = mockLogs.join("\n");
    expect(output).toContain("Error");
  });

  test("strips leading keywords before calling tool", async () => {
    await runOneLiner("who is Einstein");
    const output = mockLogs.join("\n");
    expect(output).toContain("Einstein");
    expect(output).toContain("Extract of Einstein");
  });
});
