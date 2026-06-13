# AliceWiki

Terminal AI Chatbot that fetches Wikipedia articles through the Wikipedia REST API using LangChain — no browser required.

## Architecture

```
src/
  index.ts        Entry point. Routes to one-liner mode (CLI args) or interactive mode.
  cli.ts          The interface of interactive mode (handles /switch, /help, /quit).
  one-liner.ts    Bypasses the LLM: fetches Wikipedia directly, prints title, extract, and URL as plain text.
  llm.ts          Builds and route the LLM models to its API key.
  agent.ts        Agent orchestrator: runs LLM with tool calling, parses structured JSON output.
  tools/
    wikipedia.ts  Wikipedia tool using the `wikipedia` npm package and output JSON.
```

## Flow

Two modes depending on invocation:

### One-liner (`alicewiki <query>`)

1. **Input** received from CLI arguments (`index.ts:9`).
2. **Topic extraction** (`one-liner.ts:22`): calls `extractWikiTopic()` to strip leading keywords.
3. **Wikipedia fetch** (`tools/wikipedia.ts`): fetches page summary + full content via `wikipedia` npm package.
4. **Output**: article title, extract, and URL printed directly — no LLM involved.

### Interactive (REPL)

1. **Input** received from readline prompt (`cli.ts`).
2. **LLM tool calling** (`agent.ts`): conversation history + system prompt are sent to the LLM with the wikipedia tool registered. The LLM decides whether to invoke the tool.
3. **Wikipedia fetch**: when the LLM calls the tool, `wikipediaTool` fetches the page and returns structured JSON (title, extract, fullContent, url, thumbnail).
4. **LLM synthesis**: the tool result is fed back to the LLM, which produces a structured JSON response (`summary`, `quotes`, `sources`).
5. **Output** displayed formatted with sections for summary, direct quotes, and sources.

## Providers

Configured in `.env` (see `.env.example`). Supported: `openai`, `anthropic`, `google`. Switch at runtime with `/switch <name>`.

## Bin

Installed as both `alicewiki` and `aw` (see `package.json`).

## Tool Details

### `wikipediaTool` (`tools/wikipedia.ts`)

- **Name**: `wikipedia`
- **Input**: Object with `query` property (e.g. `{ query: "Python programming language" }`, `{ query: "Mary Sue" }`)
- **Output**: JSON with `title`, `url`, `extract`, `fullContent`, `thumbnail`, and optional `notification`
- **Implementation**:
  - Uses ESM import.
  - Fetches both `page.summary()` and `page.content()` in parallel.
  - Full content truncated at 8000 chars with `[...content truncated]` suffix.
  - Falls back to fuzzy search (`wiki.search()`) when direct page lookup fails; appends a `notification` field when using a fuzzy match.
- Uses the `wikipedia` npm package for API access.

### `extractWikiTopic` (`agent.ts:16`)

Used in one-liner mode. Strips leading keywords (`who is`, `what is`, `tell me about`, `explain`, `describe`, `the`, `a`, `an`) from the query before passing to Wikipedia.

## Design Goals

- **Lightweight**: minimal dependencies (`langchain`, `@langchain/*`, `zod`, `dotenv`, `wikipedia`).
- **Resource-efficient**: no browser automation, no heavy frameworks. Single-threaded Node.js process.
