<img src="assets/alicewiki5.png" alt="AliceWiki Banner" width="800" />

A terminal AI chatbot that fetches Wikipedia articles through the Wikipedia REST API using LangChain.

## Requirements

- [Bun](https://bun.sh) 1.2+
- An API key for OpenAI, Anthropic, or Google

## Installation

```bash
git clone https://github.com/griimmv/alicewiki.git
cd alicewiki
bun install
bun link
```

## Configuration

API keys are set at runtime inside the TUI with `/setKey <provider>` and stored in `~/.alicewiki/alicewiki.db`. Provider and model preferences persist across sessions automatically.

## Security (important!!)

The security here, how should i say it... a little fragile? It's literally just chmod 700 and 600 for the db and it doesn't work on Windows.
So thats going to the todo list.

it's literally this
<br>
<img src="assets/cheetos.jpg" alt="cheetos holding down a door" width="250" />

## Usage

```bash 
# Interactive TUI mode (starts without an API key; run /setKey before your first LLM query)
aw

# One-liner mode (doesn't need an API key)
aw who is mary sue?
```

## Commands (Interactive Mode)

- `/help` - Show help
- `/switch <provider>` - Switch LLM provider (openai, anthropic, google)
- `/model <name>` - Change model for current provider
- `/setKey <provider>` - Set API key for a provider at runtime
- `/sessions` - Open session manager
- `/quit` - Exit

## Key Bindings

| Key | Action |
|-----|--------|
| `Ctrl+B` | Toggle sidebar visibility |
| `Alt+D` | Focus the input bar |
| `Ctrl+C` | Quit the application |
| `Ctrl+click` | Open links |
| `Escape` | Close setup modal / Cancel in-flight LLM request |

## Architecture

```text
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
