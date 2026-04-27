import * as readline from "readline";
import { createAgent, runAgent } from "./agent.ts";
import { createLLM, getDefaultProvider, isValidProvider, ProviderName } from "./llm.ts";

let currentProvider: ProviderName = getDefaultProvider();
let currentLLM = createLLM({ provider: currentProvider });
let agent = createAgent(currentLLM);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const HELP_TEXT = `
Commands:
  /help               Show this help message
  /switch <provider>  Switch LLM provider (openai, /*opencode*/ anthropic, google)
  /quit               Exit the application

Examples:
  Who is Batman?
  Tell me about Python programming language
  What is the history of France?
`;

export function printWelcome() {
  console.log("=".repeat(50));
  console.log("  AliceWiki - Terminal AI Agent");
  console.log("  Powered by Wikipedia + LangChain");
  console.log("=".repeat(50));
  console.log(`\nCurrent provider: ${currentProvider}`);
  console.log(HELP_TEXT);
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
      agent = createAgent(currentLLM);
      console.log(`Switched to ${provider}`);
    } catch (error) {
      console.log(`Error: ${(error as Error).message}`);
    }
    return;
  }

  console.log("\nThinking...");

  try {
    const response = await runAgent(agent, trimmed);
    console.log("\nAnswer:");
    console.log("-".repeat(40));
    console.log(response);
    console.log("-".repeat(40));
  } catch (error) {
    console.log(`Error: ${(error as Error).message}`);
  }
}

export function startCLI() {
  printWelcome();

  rl.setPrompt("You: ");

  rl.prompt();

  rl.on("line", async (input) => {
    await handleInput(input);
    rl.prompt();
  });

  rl.on("close", () => {
    console.log("\nGoodbye!");
    process.exit(0);
  });
}
