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
    wikipedia.ts  Wikipedia tool using the REST API directly (bypasses the `wikipedia` npm package's broken `Api-User-Agent` header).
```

## Flow

1. **Input received** from CLI or CLI argument.
2. **Wikipedia detection**: `agent.ts:10` — keywords like `who`, `what`, `where`, `explain`, `describe` trigger Wikipedia lookup.
3. **Wikipedia fetch** (`tools/wikipedia.ts`):
   - Attempts `GET /api/rest_v1/page/summary/<title>`.
   - On 404, falls back to `GET /w/api.php?action=query&list=search` and retries with the first result.
   - Uses a proper `User-Agent` header (Wikipedia blocks `Api-User-Agent` used by the old npm package).
4. **LLM synthesis**: Retrieved extract is passed to the configured LLM which produces a natural-language answer.
5. **Output** printed to terminal.

## Providers

Configured in `.env` (see `.env.example`). Supported: `openai`, `anthropic`, `google`. Switch at runtime with `/switch <name>`.

## Tool Details

### `wikipediaTool` (`tools/wikipedia.ts`)

- **Name**: `wikipedia`
- **Input**: Free-text topic (e.g. `"Python programming language"`, `"Marie Curie"`)
- **Output**: Title + summary extract + optional thumbnail URL
- **Falls back** to search when exact title is not found
- Uses native `fetch()` — no external HTTP library needed

## Design Goals

- **Lightweight**: minimal dependencies (`langchain`, `zod`, `dotenv` only). Uses native `fetch` instead of `axios` for Wikipedia requests.
- **Resource-efficient**: no browser automation, no heavy frameworks. Single-threaded Node.js process.
- **Modest RAM**: runs comfortably in <50 MB.

## Quirk

General chat queries containing trigger keywords ("how", "what", etc.) will be routed to Wikipedia even when the user is just greeting the assistant. This is a known consequence of the keyword-based detection heuristic.
