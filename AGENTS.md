# AliceWiki

Terminal AI Chatbot that fetches Wikipedia articles through the Wikipedia REST API using LangChain — no browser required.

## Architecture

```
src/
  index.ts        Entry point. Routes to one-liner mode (CLI args) or interactive mode (TUI).
   tui.ts          Interactive mode via @opentui/core. Full-screen TUI with sidebar, header,
                   scrollable messages, input bar, and keybinding hints. Contains Sidebar class inline.
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
   - **Sidebar** (class defined inline in `tui.ts`, width 30, `flexShrink: 0`): shows app title, session stats
  (queries/articles on separate lines), fetched articles (deduplicated via `articleCache: Set<string>`),
  and keybinding hints (Ctrl+B toggle, Alt+D focus, Ctrl+C quit, Ctrl+click open link).
  Toggle with `Ctrl+B`.
   - **MainColumn** = `[HeaderBar | MessagesContainer | InputBar]`:
     - **HeaderBar**: ASCII art logo + current provider name.
     - **MessagesContainer**: `ScrollBoxRenderable`, sticky-scroll to bottom, max 50 turns.
     - **InputBar**: `InputRenderable` with placeholder text, plus a status line.
3. **User input**: on Enter, the value is sent to `runAgent()`.
4. **LLM tool calling** (`agent.ts`): conversation history + system prompt are sent to the LLM with the wikipedia tool registered. The LLM decides whether to invoke the tool.
5. **Wikipedia fetch**: when the LLM calls the tool, `wikipediaTool` fetches the page and returns structured JSON (`title`, `extract`, `fullContent`, `url`, `thumbnail`).
6. **LLM synthesis**: the tool result is fed back to the LLM, which produces a structured JSON response (`summary`, `quotes`, `sources`).
7. **Output**: rendered inside the TUI as bordered boxes for user query, summary, direct quotes, and sources. Sidebar stats (queries/articles on separate lines) and fetched articles list are updated.

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
| `Alt+D` | Focus the input bar |
| `/quit` | Exit the application |

Keybinding hints are also displayed at the bottom of the sidebar for quick reference.

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

## Typewriter Animation (`tui.ts`)

After the LLM returns a parsed response, the TUI reveals it with a character-by-character typewriter effect instead of flashing all text at once.

### `typeText` (`tui.ts:59`)

```typescript
async function typeText(
  renderer: any,
  tr: TextRenderable,
  text: string,
  speedMs: number = 15,
): Promise<void>
```

Animates the `content` of a `TextRenderable` one character at a time:
- Calls `renderer.requestLive()` at the start for a smooth continuous render loop
- Iterates from `i = 1` to `text.length`, slicing the string and updating `tr.content`
- Calls `renderer.dropLive()` when done

### Animation order

| Step | Content | Speed | After |
|------|---------|-------|-------|
| 1 | Summary text | 15ms/char | — |
| 2 | Direct Quotes (each) | 10ms/char | 200ms pause |
| 3 | Sources (each) | 10ms/char | 200ms pause |

The layout (bordered summary/quotes/sources boxes with labels) renders immediately — only the content text animates. `isProcessing` stays `true` during animation so the user cannot submit new input until the full response is revealed. The fallback path (unparseable JSON) also uses `typeText` for consistency.

## Design Goals

- **Resource-efficient**: no browser automation, no heavy frameworks. Single-threaded Node.js process.
- **Rich TUI**: `@opentui/core` provides a full-screen terminal UI with split-panel layout, scrollable content, theming, and keyboard input handling.
