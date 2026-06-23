![AliceWiki Banner](assets/alicewiki5.png)
# AliceWiki

A terminal AI chatbot that fetches information from Wikipedia API using LangChain.

## Requirements

- [Bun](https://bun.sh) 1.2+
- An API key for OpenAI, Anthropic, or Google

## Installation

```bash
bun install -g alicewiki
```

## Configuration

Bun automatically loads `.env` from the current directory. Create a `.env` file:

```bash
# Required - at least one API key
OPENAI_API_KEY=your_key
ANTHROPIC_API_KEY=your_key
GOOGLE_API_KEY=your_key

# Add default provider
DEFAULT_PROVIDER=openai  # openai, anthropic, google
```

## Usage

```bash
# Chatbot/Agentic mode (need llm api key)
aw

# One-liner mode (doesn't need llm api key)
aw who is mary sue?
```

## Commands (Interactive Mode)

- `/help` - Show help
- `/switch <provider>` - Switch LLM provider
- `/quit` - Exit

## Architecture

```
src/
  index.ts        Entry point. Routes to one-liner (CLI args) or interactive TUI.
  tui.ts          Full-screen TUI via @opentui/core. Layout:
                  rootLayout (row)
                    sidebar
                    mainColumn (column)
                      headerBar      — ASCII logo + model name
                      messages       — ScrollBoxRenderable, sticky-bottom
                      inputBar       — InputRenderable + status line
                  Contains Sidebar class inline with:
                    session stats, fetched articles (deduped), keybinding hints
  one-liner.ts    Bypasses LLM: fetches Wikipedia directly, prints title+extract+URL
  llm.ts          Creates LangChain models per provider (openai/anthropic/google)
  agent.ts        Agent orchestrator: runs LLM with tool calling, parses JSON output
  tools/
    wikipedia.ts  Fetches Wikipedia via `wikipedia` npm package, returns JSON
```

