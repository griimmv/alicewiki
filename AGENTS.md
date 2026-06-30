# AliceWiki

Terminal AI Chatbot that fetches Wikipedia articles through the Wikipedia REST API using LangChain — no browser required.

## Architecture

```
src/
├── index.ts          # Entry point. Initializes SQLite (initDB), routes to
│                       one-liner (CLI args) or interactive TUI.
├── tui.tsx           # React root via @opentui/react. Full-screen TUI with sidebar, header,
│                       scrollable messages, input bar, keybinding hints, token tracking,
│                       persistent sessions (saveTurn), and setup modal (SetupModal).
├── one-liner.ts      # Bypasses the LLM: extracts topic, invokes wikipediaTool.func(),
│                       parses result, prints title, extract, and URL.
├── llm.ts            # Builds LangChain ChatModels per provider (openai/anthropic/google).
│                       Reads API keys from SQLite via getCredential() instead of env vars.
├── agent.ts          # Agent orchestrator: manual tool-calling loop (max 2), invokes LLM
│                       with system prompt + conversation history, parses JSON output,
│                       returns { content, tokens }. Uses LangChain SDK's built-in retry
│                       logic (no custom retry loop). LLM invoke has 30s timeout,
│                       tool calls have 20s timeout — both via Promise.race.
├── db.ts             # SQLite database (bun:sqlite) for credentials, sessions, and turn history.
│                       Tables: credentials, sessions, turns. Stores API keys at rest in ~/.alicewiki/.
├── components/
│   ├── Header.tsx        # ASCII art logo + current provider name in a heavy-bordered box.
│   ├── Sidebar.tsx       # Session stats (queries, articles, token count), fetched articles list,
│   │                       and keybinding hints. Stateless — receives all data as props.
│   ├── Messages.tsx      # ScrollBox container with sticky-scroll mapping over message turns.
│   ├── MessageTurn.tsx   # Renders one user+assistant exchange. User query in rounded box with
│   │                       spinner; response with summary/quotes/sources in bordered boxes;
│   │                       error in red box; help in green box. Sequential typewriter
│   │                       animation via onComplete callbacks.
│   ├── InputBar.tsx      # <input> + status line (provider · model). Remounts on Alt+D to
│   │                       regain focus. Detaches onSubmit during processing (input guard).
│   ├── SetupModal.tsx    # Full-screen overlay modal for entering API keys at runtime.
│   │                       Shows provider info, link to key page, and a MaskedInput field.
│   │                       Escape to dismiss, Enter to save — persisted via setCredential().
│   ├── SessionModal.tsx  # Full-screen overlay modal for managing sessions (list, switch,
│   │                       create, rename, delete). Keyboard-driven with n/r/d/Enter/Esc.
│   ├── MaskedInput.tsx   # Reusable masked text input showing • characters. Supports paste
│   │                       via usePaste (decodePasteBytes), backspace, Escape, and Enter.
│   └── TypewriterText.tsx # Char-by-char text reveal via useState + useEffect interval
│                            (8ms summary, 5ms quotes/sources).
└── tools/
    └── wikipedia.ts    # Wikipedia tool built with @langchain/core/tool() and Zod schema.
                          Uses the `wikipedia` npm package, returns JSON string.
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
  (session name, queries/articles/tokens on separate lines), fetched articles (deduplicated by App state),
  and keybinding hints. Toggled with `Ctrl+B`.
   - **MainColumn** = `[Header | Messages | InputBar]`:
     - **Header**: ASCII art logo + current provider name.
     - **Messages**: `<scrollbox>`, sticky-scroll to bottom, max 50 turns.
     - **InputBar**: `<input>` with placeholder, plus model status line.
3. **User input**: on Enter, value sent to `handleSubmit()` in App.
   - Commands (`/help`, `/switch`, `/model`, `/setKey`, `/sessions`, `/quit`) are handled inline with `return`.
   - Responses to `/help`, `/switch`, and `/model` render in a green-bordered `HELP` box.
   - `/setKey <provider>` opens a `SetupModal` overlay for entering an API key via `MaskedInput`.
   - `/sessions` opens a `SessionModal` overlay for managing sessions (switch, create, rename, delete).
4. **Input guard**: while processing, `onSubmit` on the `<input>` is set to `undefined` so Enter does nothing. Press `Escape` during processing to abort the in-flight LLM request instantly via `AbortController`. The input bar is also disabled when a modal (SetupModal or SessionModal) is open.
5. **Lazy agent init**: the agent (`createAgent(createLLM(...))`) is created on the first query, not at startup — so the TUI starts even without a configured API key.
6. **LLM tool calling** (`agent.ts`): conversation history + system prompt sent to LLM with the wikipedia tool registered. The LLM decides whether to invoke the tool. Runs up to 2 loops.
7. **Wikipedia fetch**: when the LLM calls the tool, `wikipediaTool` fetches the page and returns structured JSON (`title`, `extract`, `fullContent`, `url`, `thumbnail`, `foundArticle`).
8. **LLM synthesis**: the tool result is fed back to the LLM, which produces structured JSON response (`summary`, `quotes`, `sources`). Falls back to raw text if JSON parsing fails.
9. **Token tracking**: each LLM invocation's `usage_metadata` is accumulated and displayed in the sidebar as `Tokens: N`.
10. **Output**: rendered inside the TUI as bordered boxes for user query, summary, direct quotes, and sources. Sidebar stats and fetched articles list are updated. A processing spinner animates in the user query box while waiting.
11. **Persistence**: each turn is saved to SQLite via `saveTurn()` (session ID, query, summary, quotes, sources, tokens, errors). Session is created at startup in `initDB()`.
12. **Session switching**: switching sessions (via `/sessions` or `handleSessionSwitch()`) loads the previous conversation history from the DB and reconstructs the `conversationHistoryRef` so the LLM retains context across queries within the same session. The agent is recreated if the provider or model differs.
13. **Animation & release**: typewriter animation reveals the response char-by-char. `isProcessing` stays `true` until the last animation step completes (last source text, or last quote, or summary if no quotes/sources). Then `handleTurnAnimationComplete()` releases the input guard and hides the warning box. Errors release immediately (no animation).

## Providers

Supported: `openai`, `anthropic`, `google`. Switch at runtime with `/switch <name>`. Provider and model preferences persist across sessions via SQLite.

API keys are read from the SQLite database (`~/.alicewiki/alicewiki.db`) via `getCredential()` in `llm.ts`. Set keys at runtime with `/setKey <provider>`, which opens a `SetupModal` overlay with a `MaskedInput` (shows ••• characters). Keys are persisted via `setCredential()`.

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
| `Ctrl+C` | Quit the application |
| `Ctrl+click` | Open links |
| `Escape` | Close setup modal / Cancel in-flight LLM request |
| `/quit` | Exit the application |
| (Session modal) `n` | Create new session |
| (Session modal) `r` | Rename selected session |
| (Session modal) `d` | Delete selected session |
| (Session modal) `Enter` | Switch to selected session |

## Tool Details

### `wikipediaTool` (`tools/wikipedia.ts`)

- **Name**: `wikipedia`
- **Input**: Object with `query` property (e.g. `{ query: "Python programming language" }`, `{ query: "Mary Sue" }`)
- **Output**: JSON string with `title`, `url`, `extract`, `fullContent`, `thumbnail`, `foundArticle`, and optional `notification`
- **Implementation**:
  - Built with `@langchain/core/tools` `tool()` factory and Zod schema.
  - Uses `wiki.page(input, { preload: true })` to fetch page data.
  - Fetches both `page.summary()` and `page.content()` in parallel.
  - Full content truncated at 8000 chars with `[...content truncated]` suffix.
  - Falls back to fuzzy search (`wiki.search()`) when direct page lookup fails; appends a `notification` field when using a fuzzy match.
  - Returns `foundArticle: false` with a `notification` if no article is found at all or if the search errors out.
- Uses the `wikipedia` npm package for API access.

- All Wikipedia API calls (`wiki.page()`, `page.summary()`, `page.content()`, `wiki.search()`) are wrapped with a 15s timeout via `Promise.race`.

### `extractWikiTopic` (`agent.ts:16`)

Used in one-liner mode. Strips leading keywords (`who is`, `what is`, `tell me about`, `explain`, `describe`, `the`, `a`, `an`) from the query before passing to Wikipedia.

### `runAgent` (`agent.ts:40`)

Agent orchestrator. Sends conversation + system prompt to LLM with the wikipedia tool registered. Supports up to 2 tool-calling loops (reduced from 5 to prevent token waste). Returns `{ content: string; tokens: TokenUsage }` — token usage extracted from `result.usage_metadata` (input/output/total) and accumulated across invocations.

Retries are handled by the LangChain SDK's built-in logic (no custom retry loop). Each LLM invoke has a 30s outer timeout via `Promise.race`; tool calls have a 20s outer timeout. An optional `AbortSignal` can be passed through to allow instant cancellation (used by Escape in the TUI). The `withTimeout` helper uses a 3-way `Promise.race` (promise, timeout, abort signal) to support both timeout and cancellation for tool calls.

### `createAgent` (`agent.ts:12`)

Creates a minimal agent object `{ llm, tools: [wikipediaTool] }` — no LangChain AgentExecutor wrapper. The agent is initialized lazily on the first query (not at TUI startup) so the UI loads even without a configured API key.

### `TokenUsage` (`agent.ts:23`)

```typescript
interface TokenUsage {
  input: number;
  output: number;
  total: number;
}
```

Returned alongside each `runAgent()` call. Accumulated across all loop iterations and displayed in the sidebar as `Tokens: N`.

### JSON parsing (`agent.ts:91`)

The helper `parseJSONFromText()` extracts JSON from LLM responses, supporting both raw JSON and code-fenced (` ```json `) formats. If neither the LLM response nor the manual loop produces valid JSON, a fallback `{ summary, quotes: [], sources: [] }` shape is returned.

## Typewriter Animation (`src/components/TypewriterText.tsx`)

After the LLM returns a parsed response, the TUI reveals it with a character-by-character typewriter effect instead of flashing all text at once.

### `<TypewriterText>` component

```typescript
function TypewriterText({ text, speed, onComplete, fg })
```

- Uses `useState` for the revealed substring
- `useEffect` with `setInterval` (speed ms, default 8) increments characters
- Calls `onComplete` once when full text is revealed
- `doneRef` prevents double-fires on re-render
- No `renderer.requestLive()/dropLive()` — React reconciler handles frame updates

### Animation order (inside `<MessageTurn>`)

| Step | Content | Speed | Trigger |
|------|---------|-------|--------|
| 1 | Summary text | 8ms/char | On mount (immediate) |
| 2 | Direct Quotes (each) | 5ms/char | `onSummaryDone` → 200ms delay |
| 3 | Sources (each) | 5ms/char | Last quote done → 200ms delay |

The layout (bordered summary/quotes/sources boxes with labels) renders immediately — only the content text animates. `isProcessing` stays `true` during animation so the user cannot submit new input until the full response is revealed. The fallback path (unparseable JSON) also uses `<TypewriterText>` for consistency.

### `isProcessing` lifecycle

| Phase | `isProcessing` | Input bar |
|-------|---------------|-----------|
| Idle | `false` | `onSubmit` attached, Enter works |
| Submit → LLM fetches | `true` | `onSubmit` detached, Enter does nothing |
| LLM response → typewriter animation | `true` | `onSubmit` detached |
| Animation complete | `false` | `onSubmit` reattached |
| Error (no animation) | `false` via `.catch()` | `onSubmit` reattached |

The input is cleared only on successful non-guarded submits (via `inputKey` remount). During processing, typed text accumulates and is preserved.

## Design Goals

- **Resource-efficient**: no browser automation, no heavy frameworks. Single-threaded Node.js process.
- **Rich TUI**: `@opentui/react` provides a full-screen terminal UI with split-panel layout, scrollable content, theming, React components, and keyboard input handling.

