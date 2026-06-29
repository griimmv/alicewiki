import { mock, test, expect, beforeAll, describe } from "bun:test";

let mockSummary: any = null;
let mockContent: string = "";
let mockSearchResults: any[] = [];
let pageFailCount: number = 0;
let searchThrow: boolean = false;
let searchTimeout: boolean = false;
let summaryThrow: boolean = false;
let contentThrow: boolean = false;

mock.module("wikipedia", () => ({
  default: {
    page: async (_title: string, _opts?: any) => {
      if (pageFailCount > 0) {
        pageFailCount--;
        throw new Error("Page not found");
      }
      return {
        summary: async () => {
          if (summaryThrow) throw new Error("Summary fetch failed");
          return mockSummary;
        },
        content: async () => {
          if (contentThrow) throw new Error("Content fetch failed");
          return mockContent;
        },
      };
    },
    search: async (_query: string, _opts?: any) => {
      if (searchThrow) {
        throw new Error(searchTimeout ? "timed out" : "Search failed");
      }
      return { results: mockSearchResults };
    },
  },
}));

let wikipediaTool: any;

beforeAll(async () => {
  const mod = await import("../tools/wikipedia.ts");
  wikipediaTool = mod.wikipediaTool;
});

function resetMocks() {
  mockSummary = { title: "Python", extract: "Python is a programming language", thumbnail: { source: "https://example.com/thumb.jpg" } };
  mockContent = "Full content of the Python article...";
  mockSearchResults = [];
  pageFailCount = 0;
  searchThrow = false;
  searchTimeout = false;
  summaryThrow = false;
  contentThrow = false;
}

describe("wikipediaTool", () => {
  test("returns article data for exact match", async () => {
    resetMocks();
    const result = JSON.parse(await wikipediaTool.func({ query: "Python" }));
    expect(result.title).toBe("Python");
    expect(result.extract).toBe("Python is a programming language");
    expect(result.url).toBe("https://en.wikipedia.org/wiki/Python");
    expect(result.foundArticle).toBe(true);
    expect(result.notification).toBeUndefined();
  });

  test("includes thumbnail when available", async () => {
    resetMocks();
    const result = JSON.parse(await wikipediaTool.func({ query: "Python" }));
    expect(result.thumbnail).toBe("https://example.com/thumb.jpg");
  });

  test("truncates fullContent when exceeding MAX_CONTENT_CHARS", async () => {
    resetMocks();
    mockContent = "x".repeat(9000);
    const result = JSON.parse(await wikipediaTool.func({ query: "Python" }));
    expect(result.fullContent.length).toBeLessThan(8010);
    expect(result.fullContent).toContain("[...content truncated]");
  });

  test("does not truncate short content", async () => {
    resetMocks();
    mockContent = "Short content";
    const result = JSON.parse(await wikipediaTool.func({ query: "Python" }));
    expect(result.fullContent).toBe("Short content");
  });

  test("falls back to fuzzy search when exact page fails", async () => {
    resetMocks();
    pageFailCount = 1;
    mockSearchResults = [{ title: "Python (programming language)" }];
    const result = JSON.parse(await wikipediaTool.func({ query: "Pythn" }));
    expect(result.title).toBe("Python");
    expect(result.foundArticle).toBe(true);
    expect(result.notification).toBeTruthy();
    expect(result.notification).toContain("fuzzy");
  });

  test("returns not found when search also returns nothing", async () => {
    resetMocks();
    pageFailCount = 1;
    mockSearchResults = [];
    const result = JSON.parse(await wikipediaTool.func({ query: "xyznonexistent123" }));
    expect(result.foundArticle).toBe(false);
    expect(result.notification).toContain("No Wikipedia article found");
  });

  test("returns error notification when search itself fails", async () => {
    resetMocks();
    pageFailCount = 1;
    searchThrow = true;
    searchTimeout = false;
    const result = JSON.parse(await wikipediaTool.func({ query: "test" }));
    expect(result.foundArticle).toBe(false);
    expect(result.notification).toContain("Search failed");
  });

  test("returns timeout notification on search timeout", async () => {
    resetMocks();
    pageFailCount = 1;
    searchThrow = true;
    searchTimeout = true;
    const result = JSON.parse(await wikipediaTool.func({ query: "test" }));
    expect(result.notification).toContain("timed out");
  });

  test("handles summary fetch failure", async () => {
    resetMocks();
    summaryThrow = true;
    const result = JSON.parse(await wikipediaTool.func({ query: "Python" }));
    expect(result.foundArticle).toBe(false);
    expect(result.notification).toBeDefined();
  });

  test("handles content fetch failure", async () => {
    resetMocks();
    contentThrow = true;
    const result = JSON.parse(await wikipediaTool.func({ query: "Python" }));
    expect(result.foundArticle).toBe(false);
    expect(result.notification).toBeDefined();
  });
});
