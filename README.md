# AliceWiki

A terminal AI agent that fetches information from Wikipedia API using LangChain.

## Installation

```bash
npm install -g alicewiki
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

# Add default provider
DEFAULT_PROVIDER=openai  # openai, anthropic, google
```

> **Note:** Place your `.env` file in the directory by doing `npm config get prefix` and then go to lib/node_modules/alicewiki/ and place your .env there

## Usage

```bash
# Interactive mode
aw

# One-liner mode
aw who is mary sue?
```

## Commands (Interactive Mode)

- `/help` - Show help
- `/switch <provider>` - Switch LLM provider
- `/quit` - Exit

## Requirements

- Node.js 18+
- npm
- An API key for OpenAI, Anthropic, or Google

