import * as readline from "readline";
import { createAgent, runAgent } from "./agent.js";
import { createLLM, getDefaultProvider, isValidProvider, ProviderName } from "./llm.js";



interface Quote {
  text: string;
  source: string;
  url: string;
}

interface Source {
  title: string;
  url: string;
}

interface ParsedResponse {
  summary: string;
  quotes: Quote[];
  sources: Source[];
}

// json parser 
function parseJSONResponse(response: string): ParsedResponse | null {
  try {
    let jsonStr = response.trim();
    const match = response.match(/```(?:json)?\n([\s\S]*?)\n```/);
    if (match) jsonStr = match[1];
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

function displayFormattedOutput(data: ParsedResponse) {
  console.log("\n" + "═".repeat(50));
  console.log("  SUMMARY");
  console.log("═".repeat(50));
  console.log(data.summary);

  console.log("\n" + "═".repeat(50));
  console.log("  DIRECT QUOTES");
  console.log("═".repeat(50));
  if (data.quotes.length === 0) {
    console.log("(No direct quotes extracted)");
  } else {
    data.quotes.forEach((q, i) => {
      console.log(`\n[${i + 1}] "${q.text}"`);
      console.log(`     — ${q.source}`);
      console.log(`     ${q.url}`);
    });
  }

  console.log("\n" + "═".repeat(50));
  console.log("  SOURCES");
  console.log("═".repeat(50));
  data.sources.forEach((s, i) => {
    console.log(`[${i + 1}] ${s.title}`);
    console.log(`     ${s.url}`);
  });
}

let currentProvider: ProviderName = getDefaultProvider();
let currentLLM: ReturnType<typeof createLLM>;
let _agent: ReturnType<typeof createAgent> | null = null;
let conversationHistory: any[] = [];

/**
 * Getter for lazy load for one liner mode to function properly without an api key.
 * The LLM is only initialized when interactive mode actually needs it.
 */
function getAgent() {
  if (!_agent) {
    currentProvider = getDefaultProvider();
    currentLLM = createLLM({ provider: currentProvider });
    _agent = createAgent(currentLLM);
  }
  return _agent;
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const HELP_TEXT = `
Commands:
  /help               Show this help message
  /switch <provider>  Switch LLM provider (openai, anthropic, google)
  /quit               Exit the application

Examples:
  Who is Mary Sue?
  Tell me about Python programming language
  What is the history of France?
`;

export function printWelcome() {
  console.log();
  console.log(" █████╗ ██╗     ██╗ ██████╗███████╗██╗    ██╗██╗██╗  ██╗██╗");
  console.log("██╔══██╗██║     ██║██╔════╝██╔════╝██║    ██║██║██║ ██╔╝██║");
  console.log("███████║██║     ██║██║     █████╗  ██║ █╗ ██║██║█████╔╝ ██║");
  console.log("██╔══██║██║     ██║██║     ██╔══╝  ██║███╗██║██║██╔═██╗ ██║");
  console.log("██║  ██║███████╗██║╚██████╗███████╗╚███╔███╔╝██║██║  ██╗██║");
  console.log("╚═╝  ╚═╝╚══════╝╚═╝ ╚═════╝╚══════╝ ╚══╝╚══╝ ╚═╝╚═╝  ╚═╝╚═╝");
  console.log();
  console.log("  Powered by Wikipedia + LangChain");
  console.log(`\nCurrent provider: ${currentProvider}`);
  console.log();
  console.log(HELP_TEXT);
  console.log();
}

export async function handleInput(input: string): Promise<void> {
  const trimmed = input.trim();

  if (!trimmed) return;

  if (trimmed === "/quit" || trimmed === "/exit") {
    console.log("Goodbye!");
    process.exit(0);
  }

  if (trimmed === "/help") {
    console.log(HELP_TEXT);
    return;
  }

  if (trimmed.startsWith("/switch ")) {
    const parts = trimmed.split(" ");
    if (parts.length < 2) {
      console.log("Usage: /switch <provider>");
      console.log("Providers: openai, /*opencode*/, anthropic, google");
      return;
    }

    const provider = parts[1].toLowerCase();
    if (!isValidProvider(provider)) {
      console.log(`Invalid provider: ${provider}`);
      console.log("Valid providers: openai, /*opencode*/, anthropic, google");
      return;
    }

    try {
      currentProvider = provider;
      currentLLM = createLLM({ provider: currentProvider });
      _agent = createAgent(currentLLM);
      conversationHistory = [];
      console.log(`Switched to ${provider}`);
    } catch (error) {
      console.log(`Error: ${(error as Error).message}`);
    }
    return;
  }

  console.log("\nThinking...");

  try {
    const response = await runAgent(getAgent(), trimmed, conversationHistory);
    const parsed = parseJSONResponse(response);

    if (parsed) {
      displayFormattedOutput(parsed);
    } else {
      console.log();
      console.log(response);
    }

    conversationHistory.push({ role: "user", content: trimmed });
    conversationHistory.push({ role: "assistant", content: response });

    if (conversationHistory.length > 20) {
      conversationHistory = conversationHistory.slice(-20);
    }
  } catch (error) {
    console.log(`Error: ${(error as Error).message}`);
  }
}

export function startCLI() {
  printWelcome();

  rl.setPrompt("Type a question: ");

  rl.prompt();

  rl.on("line", async (input) => {
    await handleInput(input);
    rl.prompt();
  });

  rl.on("close", () => {
    console.log("\nCtrl+c pressed. Goodbye!");
    process.exit(0);
  });
}
