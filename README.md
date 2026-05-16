# AliceWiki

A terminal AI agent that fetches information from Wikipedia API using LangChain.

## Installation

```bash
npm install -g alicewiki
```

## Usage

```bash
# Interactive mode
aw

# One-liner mode
aw "Who is Batman?"
```

## Configuration

Create a `.env` file in your project directory:

```bash
# Required - at least one API key
OPENAI_API_KEY=your_key
# or
ANTHROPIC_API_KEY=your_key
# or
GOOGLE_API_KEY=your_key

# Optional
DEFAULT_PROVIDER=openai  # openai, anthropic, google, opencode
```

> **Note:** Place your `.env` file in the directory returned by `npm config get prefix` and then go to /lib/node_modules/alicewiki/

## Commands (Interactive Mode)

- `/help` - Show help
- `/switch <provider>` - Switch LLM provider
- `/quit` - Exit

## Requirements

- Node.js 18+
- npm
- An API key for OpenAI, Anthropic, Google, or OpenCode

## Troubleshooting

Find where global packages are installed:
```bash
npm config get prefix
```
