# AliceWiki

Terminal AI Chatbot that fetches Wikipedia articles through the Wikipedia REST API using LangChain — no browser required.

## Architecture

```
src/
  index.ts          Entry point. Routes to one-liner mode (CLI args) or interactive mode (TUI).
  tui.tsx           React root via @opentui/react. Full-screen TUI with sidebar, header,
                    scrollable messages, input bar, keybinding hints, and token tracking.
  one-liner.ts      Bypasses the LLM: fetches Wikipedia directly, prints title, extract, and URL.
  llm.ts            Builds and routes LLM models to their API keys.
  agent.ts          Agent orchestrator: runs LLM with tool calling (max 2 loops),
                    parses structured JSON output, returns token usage metadata.
  components/
    Header.tsx        ASCII art logo + current provider name in a heavy-bordered box.
    Sidebar.tsx       Session stats (queries, articles, token count), fetched articles list,
                      and keybinding hints. Stateless — receives all data as props.
    Messages.tsx      ScrollBox container mapping over message turns.
    MessageTurn.tsx   Renders one user+assistant exchange. User query in rounded box,
                      response with summary/quotes/sources in bordered boxes. Sequential
                      typewriter animation via onComplete callbacks.
    InputBar.tsx      InputRenderable + status line (provider · model). Remounts on
                      Alt+D to regain focus. Detaches onSubmit handler during
                      processing (input guard) so users cannot spam queries.
    TypewriterText.tsx Char-by-char text reveal via useState + useEffect interval
                      (15ms summary, 10ms quotes/sources). Replaces imperative typeText().
  tools/
    wikipedia.ts    Wikipedia tool using the `wikipedia` npm package, outputs JSON.
```

## Flow

Two modes depending on invocation:

### One-liner (`alicewiki <query>`)

1. **Input** received from CLI arguments (`index.ts:9`).
2. **Topic extraction** (`one-liner.ts:22`): calls `extractWikiTopic()` to strip leading keywords.
3. **Wikipedia fetch** (`tools/wikipedia.ts`): fetches page summary + full content via `wikipedia` npm package.
4. **Output**: article title, extract, and URL printed directly — no LLM involved.

### Interactive (TUI — `alicewiki` with no args)

1. **TUI startup** (`tui.tsx:startTUI`): creates `createCliRenderer`, detects theme, calls `createRoot(renderer).render(<App />)`.
2. **Layout**: `<box flexDirection="row">` → `[Sidebar | column → [Header | Messages | InputBar]]`.
   - **Sidebar** (`src/components/Sidebar.tsx`, width 30): shows app title, session stats
  (queries/articles/tokens on separate lines), fetched articles (deduplicated by App state),
  and keybinding hints. Toggled with `Ctrl+B`.
   - **MainColumn** = `[Header | Messages | InputBar]`:
     - **Header**: ASCII art logo + current provider name.
     - **Messages**: `<scrollbox>`, sticky-scroll to bottom, max 50 turns.
     - **InputBar**: `<input>` with placeholder, plus model status line.
3. **User input**: on Enter, value sent to `handleSubmit()` in App.
   - Commands (`/help`, `/switch`, `/model`, `/quit`) are handled inline with `return`.
   - Responses to `/help`, `/switch`, and `/model` render in a green-bordered `HELP` box.
4. **Input guard**: while processing, `onSubmit` on the `<input>` is set to `undefined` so Enter does nothing. A yellow-bordered "hold on, alice is still speaking" box floats at the bottom-right of the terminal.
5. **LLM tool calling** (`agent.ts`): conversation history + system prompt sent to LLM with the wikipedia tool registered. The LLM decides whether to invoke the tool. Runs up to 2 loops.
6. **Wikipedia fetch**: when the LLM calls the tool, `wikipediaTool` fetches the page and returns structured JSON (`title`, `extract`, `fullContent`, `url`, `thumbnail`).
7. **LLM synthesis**: the tool result is fed back to the LLM, which produces structured JSON response (`summary`, `quotes`, `sources`).
8. **Token tracking**: each LLM invocation's `usage_metadata` is accumulated and displayed in the sidebar as `Tokens: N`.
9. **Output**: rendered inside the TUI as bordered boxes for user query, summary, direct quotes, and sources. Sidebar stats and fetched articles list are updated.
10. **Animation & release**: typewriter animation reveals the response char-by-char. `isProcessing` stays `true` until the last animation step completes (last source text, or last quote, or summary if no quotes/sources). Then `handleTurnAnimationComplete()` releases the input guard and hides the warning box.

## Providers

Configured in `.env` (see `.env.example`). Supported: `openai`, `anthropic`, `google`. Switch at runtime with `/switch <name>`.

Default models per provider:
- `openai` → `gpt-5.4-mini`
- `anthropic` → `claude-haiku-4-5`
- `google` → `gemini-3.5-flash`

Change the model for the current provider with `/model <name>`. Validated against a known models list; invalid names show an error with available options.

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

### `runAgent` (`agent.ts:27`)

Agent orchestrator. Sends conversation + system prompt to LLM with the wikipedia tool registered. Supports up to 2 tool-calling loops (reduced from 5 to prevent token waste). Returns `{ content: string; tokens: TokenUsage }` — token usage extracted from `result.usage_metadata` (input/output/total) and accumulated across invocations.

### `TokenUsage` (`agent.ts:1`)

```typescript
interface TokenUsage {
  input: number;
  output: number;
  total: number;
}
```

Returned alongside each `runAgent()` call. Accumulated across all loop iterations and displayed in the sidebar as `Tokens: N`.

## Typewriter Animation (`src/components/TypewriterText.tsx`)

After the LLM returns a parsed response, the TUI reveals it with a character-by-character typewriter effect instead of flashing all text at once.

### `<TypewriterText>` component

```typescript
function TypewriterText({ text, speed, onComplete, fg })
```

- Uses `useState` for the revealed substring
- `useEffect` with `setInterval` (speed ms) increments characters
- Calls `onComplete` once when full text is revealed
- `doneRef` prevents double-fires on re-render
- No `renderer.requestLive()/dropLive()` — React reconciler handles frame updates

### Animation order (inside `<MessageTurn>`)

| Step | Content | Speed | Trigger |
|------|---------|-------|--------|
| 1 | Summary text | 15ms/char | On mount (immediate) |
| 2 | Direct Quotes (each) | 10ms/char | `onSummaryDone` → 200ms delay |
| 3 | Sources (each) | 10ms/char | Last quote done → 200ms delay |

The layout (bordered summary/quotes/sources boxes with labels) renders immediately — only the content text animates. `isProcessing` stays `true` during animation so the user cannot submit new input until the full response is revealed. The fallback path (unparseable JSON) also uses `<TypewriterText>` for consistency.

### `isProcessing` lifecycle

| Phase | `isProcessing` | Input bar | Warning box |
|-------|---------------|-----------|-------------|
| Idle | `false` | `onSubmit` attached, Enter works | Hidden |
| Submit → LLM fetches | `true` | `onSubmit` detached, Enter does nothing | Visible |
| LLM response → typewriter animation | `true` | `onSubmit` detached | Visible |
| Animation complete | `false` | `onSubmit` reattached | Hidden |
| Error (no animation) | `false` via `.catch()` | `onSubmit` reattached | Hidden |

The input is cleared only on successful non-guarded submits (via `inputKey` remount). During processing, typed text accumulates and is preserved.

## Design Goals

- **Resource-efficient**: no browser automation, no heavy frameworks. Single-threaded Node.js process.
- **Rich TUI**: `@opentui/react` provides a full-screen terminal UI with split-panel layout, scrollable content, theming, React components, and keyboard input handling.
