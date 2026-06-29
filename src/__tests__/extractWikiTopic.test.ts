import { expect, test } from "bun:test";
import { extractWikiTopic } from "../agent.ts";

test("strips 'who is' prefix", () => {
  expect(extractWikiTopic("who is Albert Einstein")).toBe("Albert Einstein");
});

test("strips 'what is' prefix", () => {
  expect(extractWikiTopic("what is Python")).toBe("Python");
});

test("strips 'tell me about' prefix", () => {
  expect(extractWikiTopic("tell me about Mars")).toBe("Mars");
});

test("strips 'explain' prefix", () => {
  expect(extractWikiTopic("explain quantum mechanics")).toBe("quantum mechanics");
});

test("strips 'describe' prefix and trailing articles", () => {
  expect(extractWikiTopic("describe the solar system")).toBe("solar system");
});

test("strips article 'the' prefix", () => {
  expect(extractWikiTopic("the moon")).toBe("moon");
});

test("strips article 'a' prefix", () => {
  expect(extractWikiTopic("a cat")).toBe("cat");
});

test("strips article 'an' prefix", () => {
  expect(extractWikiTopic("an apple")).toBe("apple");
});

test("returns original query when no prefix matches", () => {
  expect(extractWikiTopic("Albert Einstein")).toBe("Albert Einstein");
});

test("strips combined who is + the", () => {
  expect(extractWikiTopic("who is the president")).toBe("president");
});

test("handles empty string after stripping", () => {
  expect(extractWikiTopic("who is")).toBe("who is");
});

test("is case insensitive", () => {
  expect(extractWikiTopic("Who Is Albert Einstein")).toBe("Albert Einstein");
});
