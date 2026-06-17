# AliceWiki

Terminal AI Chatbot that fetches Wikipedia articles through the Wikipedia REST API using LangChain — no browser required.

## Architecture

```
src/
  index.ts        Entry point. Routes to one-liner mode (CLI args) or interactive mode (TUI).
  tui.ts          Interactive mode via @opentui/core. Full-screen TUI with sidebar, header,
                  scrollable messages, and input bar. Contains the Sidebar class inline.
  one-liner.ts    Bypasses the LLM: fetches Wikipedia directly, prints title, extract, and URL.
  llm.ts          Builds and routes LLM models to their API keys.
  agent.ts        Agent orchestrator: runs LLM with tool calling, parses structured JSON output.
  tools/
    wikipedia.ts  Wikipedia tool using the `wikipedia` npm package, outputs JSON.
```

## Flow

Two modes depending on invocation:

### One-liner (`alicewiki <query>`)

1. **Input** received from CLI arguments (`index.ts:9`).
2. **Topic extraction** (`one-liner.ts:22`): calls `extractWikiTopic()` to strip leading keywords.
3. **Wikipedia fetch** (`tools/wikipedia.ts`): fetches page summary + full content via `wikipedia` npm package.
4. **Output**: article title, extract, and URL printed directly — no LLM involved.

### Interactive (TUI — `alicewiki` with no args)

1. **TUI startup** (`tui.ts:startTUI`): creates a full-screen terminal UI via `@opentui/core` with an alternate-screen buffer.
2. **Layout**: `rootLayout` → row of `[Sidebar | MainColumn]`.
   - **Sidebar** (class defined inline in `tui.ts`, width 30): shows app title, provider, session stats, current article, and search history. Toggle with `Ctrl+B`.
   - **MainColumn** = `[HeaderBar | MessagesContainer | InputBar]`:
     - **HeaderBar**: ASCII art logo + current provider name.
     - **MessagesContainer**: `ScrollBoxRenderable`, sticky-scroll to bottom, max 50 turns.
     - **InputBar**: `InputRenderable` with placeholder text, plus a status line.
3. **User input**: on Enter, the value is sent to `runAgent()`.
4. **LLM tool calling** (`agent.ts`): conversation history + system prompt are sent to the LLM with the wikipedia tool registered. The LLM decides whether to invoke the tool.
5. **Wikipedia fetch**: when the LLM calls the tool, `wikipediaTool` fetches the page and returns structured JSON (`title`, `extract`, `fullContent`, `url`, `thumbnail`).
6. **LLM synthesis**: the tool result is fed back to the LLM, which produces a structured JSON response (`summary`, `quotes`, `sources`).
7. **Output**: rendered inside the TUI as bordered boxes for user query, summary, direct quotes, and sources. Sidebar stats and history are updated.

## Providers

Configured in `.env` (see `.env.example`). Supported: `openai`, `anthropic`, `google`. Switch at runtime with `/switch <name>`.

Default models per provider:
- `openai` → `gpt-5.4-mini`
- `anthropic` → `claude-haiku-4-5`
- `google` → `gemini-3.5-flash`

## Bin

Installed as both `alicewiki` and `aw` (see `package.json`).

## Key Bindings (TUI mode)

| Key | Action |
|-----|--------|
| `Ctrl+B` | Toggle sidebar visibility |
| `Ctrl+Q` / `/quit` | Exit the application |

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

- **Lightweight**: minimal dependencies (`@opentui/core`, `langchain`, `@langchain/*`, `zod`, `dotenv`, `wikipedia`).
- **Resource-efficient**: no browser automation, no heavy frameworks. Single-threaded Node.js process.
- **Rich TUI**: `@opentui/core` provides a full-screen terminal UI with split-panel layout, scrollable content, theming, and keyboard input handling.
