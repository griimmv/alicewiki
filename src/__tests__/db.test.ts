import { expect, test, beforeAll, afterAll } from "bun:test";
import { initDB, closeDB, getCredential, setCredential, createSession, listSessions, switchSession, renameSession, deleteSession, getSessionTurns, getCurrentSessionId, getSessionProvider, saveTurn, updateSessionProvider } from "../db.ts";

beforeAll(() => {
  initDB(":memory:");
});

afterAll(() => {
  closeDB();
});

test("initDB creates a default session", () => {
  const sessions = listSessions();
  expect(sessions.length).toBe(1);
  expect(sessions[0].name).toBe("default");
  expect(sessions[0].provider).toBe("openai");
});

test("getCurrentSessionId returns the active session", () => {
  const id = getCurrentSessionId();
  expect(id).toBe(1);
});

test("getSessionProvider returns the latest session provider", () => {
  const provider = getSessionProvider();
  expect(provider?.provider).toBe("openai");
});

test("createSession creates a new session", () => {
  const id = createSession("test-session");
  expect(id).toBe(2);
  const sessions = listSessions();
  expect(sessions.length).toBe(2);
});

test("switchSession switches to a different session", () => {
  const session = switchSession(2);
  expect(session?.name).toBe("test-session");
  expect(getCurrentSessionId()).toBe(2);
});

test("renameSession renames the session", () => {
  renameSession(2, "renamed-session");
  const session = switchSession(2);
  expect(session?.name).toBe("renamed-session");
});

test("deleteSession removes a session", () => {
  deleteSession(2);
  const sessions = listSessions();
  expect(sessions.length).toBe(1);
});

test("setCredential and getCredential work", () => {
  setCredential("openai", "sk-test-key");
  expect(getCredential("openai")).toBe("sk-test-key");
});

test("setCredential updates existing credential", () => {
  setCredential("openai", "sk-updated-key");
  expect(getCredential("openai")).toBe("sk-updated-key");
});

test("getCredential returns null for unknown provider", () => {
  expect(getCredential("nonexistent")).toBe(null);
});

test("saveTurn saves a turn", () => {
  saveTurn(1, {
    query: "what is Python",
    turnIndex: 0,
    summary: "Python is a programming language",
    inputTokens: 10,
    outputTokens: 20,
  });
  const turns = getSessionTurns(1);
  expect(turns.length).toBe(1);
  expect(turns[0].query).toBe("what is Python");
});

test("saveTurn stores multiple turns", () => {
  saveTurn(1, {
    query: "second query",
    turnIndex: 1,
    inputTokens: 5,
    outputTokens: 10,
  });
  const turns = getSessionTurns(1);
  expect(turns.length).toBe(2);
  expect(turns[0].query).toBe("what is Python");
  expect(turns[1].query).toBe("second query");
});

test("saveTurn with error stores error field", () => {
  saveTurn(1, {
    query: "error query",
    turnIndex: 2,
    error: "Something went wrong",
  });
  const turns = getSessionTurns(1);
  const errorTurn = turns.find((t: any) => t.error);
  expect(errorTurn?.error).toBe("Something went wrong");
});

test("getSessionTurns returns empty array for session with no turns", () => {
  const id = createSession("empty-session");
  const turns = getSessionTurns(id);
  expect(turns).toEqual([]);
});

test("updateSessionProvider updates current session provider", () => {
  switchSession(1);
  updateSessionProvider("anthropic", "claude-haiku-4-5");
  const session = switchSession(1);
  expect(session?.provider).toBe("anthropic");
  expect(session?.model).toBe("claude-haiku-4-5");
});

test("deleteSession cascades to delete turns", () => {
  const id = createSession("cascade-test");
  saveTurn(id, { query: "test", turnIndex: 0 });
  const turnsBefore = getSessionTurns(id);
  expect(turnsBefore.length).toBe(1);
  deleteSession(id);
  const sessions = listSessions();
  expect(sessions.find((s: any) => s.id === id)).toBeUndefined();
  const turnsAfter = getSessionTurns(id);
  expect(turnsAfter).toEqual([]);
});
