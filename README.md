![Alice in Wonderland: I'm Late & Down the Rabbit Hole](assets/Alice.gif)
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
# Chatbot/Agentic mode (need llm api key)(still in development)
aw

# One-liner mode (doesn't need llm api key)
aw who is mary sue?
```

## Commands (Interactive Mode)

- `/help` - Show help
- `/switch <provider>` - Switch LLM provider
- `/quit` - Exit

