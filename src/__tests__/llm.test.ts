import { mock, test, expect, beforeAll, describe } from "bun:test";

let capturedConfigs: Record<string, any> = {};

mock.module("@langchain/openai", () => ({
  ChatOpenAI: class MockChatOpenAI {
    constructor(config: any) { capturedConfigs.openai = config; }
  },
}));

mock.module("@langchain/anthropic", () => ({
  ChatAnthropic: class MockChatAnthropic {
    constructor(config: any) { capturedConfigs.anthropic = config; }
  },
}));

mock.module("@langchain/google-genai", () => ({
  ChatGoogleGenerativeAI: class MockChatGoogleGenerativeAI {
    constructor(config: any) { capturedConfigs.google = config; }
  },
}));

let createLLM: any;
let DEFAULT_MODELS: any;
let getDefaultProvider: any;
let isValidProvider: any;
let KNOWN_MODELS: any;
let isValidModel: any;
let dbInit: any;
let dbSetCredential: any;

function clearCredentials() {
  dbSetCredential("openai", "");
  dbSetCredential("anthropic", "");
  dbSetCredential("google", "");
}

beforeAll(async () => {
  const db = await import("../db.ts");
  dbInit = db.initDB;
  dbSetCredential = db.setCredential;
  dbInit(":memory:");

  const mod = await import("../llm.ts");
  createLLM = mod.createLLM;
  DEFAULT_MODELS = mod.DEFAULT_MODELS;
  getDefaultProvider = mod.getDefaultProvider;
  isValidProvider = mod.isValidProvider;
  KNOWN_MODELS = mod.KNOWN_MODELS;
  isValidModel = mod.isValidModel;
});

describe("createLLM", () => {
  describe("with credentials", () => {
    test("creates ChatOpenAI with correct config", () => {
      capturedConfigs = {};
      clearCredentials();
      dbSetCredential("openai", "sk-openai-test");
      createLLM({ provider: "openai" });
      expect(capturedConfigs.openai).toBeDefined();
      expect(capturedConfigs.openai.model).toBe("gpt-5.4-mini");
      expect(capturedConfigs.openai.apiKey).toBe("sk-openai-test");
      expect(capturedConfigs.openai.temperature).toBe(0.0);
    });

    test("creates ChatAnthropic with correct config", () => {
      capturedConfigs = {};
      clearCredentials();
      dbSetCredential("anthropic", "sk-anthropic-test");
      createLLM({ provider: "anthropic" });
      expect(capturedConfigs.anthropic).toBeDefined();
      expect(capturedConfigs.anthropic.model).toBe("claude-haiku-4-5");
      expect(capturedConfigs.anthropic.anthropicApiKey).toBe("sk-anthropic-test");
      expect(capturedConfigs.anthropic.temperature).toBe(0.0);
    });

    test("creates ChatGoogleGenerativeAI with correct config", () => {
      capturedConfigs = {};
      clearCredentials();
      dbSetCredential("google", "sk-google-test");
      createLLM({ provider: "google" });
      expect(capturedConfigs.google).toBeDefined();
      expect(capturedConfigs.google.model).toBe("gemini-3.5-flash");
      expect(capturedConfigs.google.apiKey).toBe("sk-google-test");
      expect(capturedConfigs.google.temperature).toBe(0.0);
    });

    test("uses custom modelName when provided", () => {
      capturedConfigs = {};
      clearCredentials();
      dbSetCredential("openai", "sk-test");
      createLLM({ provider: "openai", modelName: "gpt-4o" });
      expect(capturedConfigs.openai.model).toBe("gpt-4o");
    });

    test("uses custom temperature when provided", () => {
      capturedConfigs = {};
      clearCredentials();
      dbSetCredential("openai", "sk-test");
      createLLM({ provider: "openai", temperature: 0.7 });
      expect(capturedConfigs.openai.temperature).toBe(0.7);
    });
  });

  describe("without credentials", () => {
    test("throws when API key is not set for openai", () => {
      clearCredentials();
      expect(() => createLLM({ provider: "openai" })).toThrow(
        "OpenAI API key is not set"
      );
    });

    test("throws when API key is not set for anthropic", () => {
      clearCredentials();
      expect(() => createLLM({ provider: "anthropic" })).toThrow(
        "Anthropic API key is not set"
      );
    });

    test("throws when API key is not set for google", () => {
      clearCredentials();
      expect(() => createLLM({ provider: "google" })).toThrow(
        "Google API key is not set"
      );
    });

    test("throws for unknown provider", () => {
      expect(() => createLLM({ provider: "invalid" as any })).toThrow(
        "Unknown provider"
      );
    });
  });
});

describe("DEFAULT_MODELS", () => {
  test("openai defaults to gpt-5.4-mini", () => {
    expect(DEFAULT_MODELS.openai).toBe("gpt-5.4-mini");
  });

  test("anthropic defaults to claude-haiku-4-5", () => {
    expect(DEFAULT_MODELS.anthropic).toBe("claude-haiku-4-5");
  });

  test("google defaults to gemini-3.5-flash", () => {
    expect(DEFAULT_MODELS.google).toBe("gemini-3.5-flash");
  });
});

describe("getDefaultProvider", () => {
  test("returns openai as default", () => {
    expect(getDefaultProvider()).toBe("openai");
  });
});

describe("isValidProvider", () => {
  test("returns true for openai", () => {
    expect(isValidProvider("openai")).toBe(true);
  });

  test("returns true for anthropic", () => {
    expect(isValidProvider("anthropic")).toBe(true);
  });

  test("returns true for google", () => {
    expect(isValidProvider("google")).toBe(true);
  });

  test("returns false for unknown provider", () => {
    expect(isValidProvider("invalid")).toBe(false);
  });
});

describe("KNOWN_MODELS", () => {
  test("openai models include gpt-5.4-mini", () => {
    expect(KNOWN_MODELS.openai).toContain("gpt-5.4-mini");
  });

  test("anthropic models include claude-haiku-4-5", () => {
    expect(KNOWN_MODELS.anthropic).toContain("claude-haiku-4-5");
  });

  test("google models include gemini-3.5-flash", () => {
    expect(KNOWN_MODELS.google).toContain("gemini-3.5-flash");
  });
});

describe("isValidModel", () => {
  test("returns true for known model", () => {
    expect(isValidModel("openai", "gpt-5.4-mini")).toBe(true);
  });

  test("returns false for unknown model", () => {
    expect(isValidModel("openai", "nonexistent-model")).toBe(false);
  });

  test("returns false for valid model in wrong provider", () => {
    expect(isValidModel("openai", "claude-haiku-4-5")).toBe(false);
  });
});
