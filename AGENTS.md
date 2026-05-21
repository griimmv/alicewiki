# AliceWiki

Terminal AI agent that fetches Wikipedia articles through the Wikipedia REST API using LangChain — no browser required.

## Architecture

```
src/
  index.ts        Entry point. Routes to CLI or one-shot mode.
  cli.ts          Readline-based interactive REPL (also handles /switch, /help, /quit).
  llm.ts          LLM factory: builds ChatOpenAI / ChatAnthropic / ChatGoogleGenerativeAI.
  agent.ts        Agent orchestrator: decides whether to hit Wikipedia, runs the LLM.
  tools/
    wikipedia.ts  Wikipedia tool using the `wikipedia` npm package.
```

## Flow

1. **Input received** from CLI or CLI argument.
2. **Wikipedia detection**: `agent.ts:10` — keywords like `who`, `what`, `where`, `explain`, `describe` trigger Wikipedia lookup.
3. **Wikipedia fetch** (`tools/wikipedia.ts`):
   - Uses the `wikipedia` npm package to fetch article summaries via `wiki.summary()`.
   - Returns title, summary extract, and optional thumbnail URL.
4. **LLM synthesis**: Retrieved extract is passed to the configured LLM which produces a natural-language answer.
5. **Output** printed to terminal.

## Providers

Configured in `.env` (see `.env.example`). Supported: `openai`, `anthropic`, `google`. Switch at runtime with `/switch <name>`.

## Tool Details

### `wikipediaTool` (`tools/wikipedia.ts`)

- **Name**: `wikipedia`
- **Input**: Free-text topic (e.g. `"Python programming language"`, `"Marie Curie"`)
- **Output**: Title + summary extract + optional thumbnail URL
- Uses the `wikipedia` npm package for API access

## Design Goals

- **Lightweight**: minimal dependencies (`langchain`, `zod`, `dotenv`, `wikipedia` only).
- **Resource-efficient**: no browser automation, no heavy frameworks. Single-threaded Node.js process.
- **Modest RAM**: runs comfortably in <50 MB.

## Quirk

General chat queries containing trigger keywords ("how", "what", etc.) will be routed to Wikipedia even when the user is just greeting the assistant. This is a known consequence of the keyword-based detection heuristic.
