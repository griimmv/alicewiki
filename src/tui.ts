import {
  createCliRenderer,
  TextRenderable,
  BoxRenderable,
  ScrollBoxRenderable,
  InputRenderable,
  InputRenderableEvents,
  TextAttributes,
  t,
} from "@opentui/core";
import { createAgent, runAgent } from "./agent.ts";
import { createLLM, getDefaultProvider, isValidProvider } from "./llm.ts";
import type { ProviderName } from "./llm.ts";

interface ThemeColors {
  text: string;
  muted: string;
  accent: string;
  success: string;
  border: string;
}

interface Quote {
  text: string;
  source: string;
  url: string;
}

interface Source {
  title: string;
  url: string;
}

interface ParsedResponse {
  summary: string;
  quotes: Quote[];
  sources: Source[];
}

function getThemeColors(isDark: boolean): ThemeColors {
  return isDark
    ? { text: "#c0caf5", muted: "#565f89", accent: "#7aa2f7", success: "#9ece6a", border: "#3b4261" }
    : { text: "#1a1b26", muted: "#9aa0b0", accent: "#2e4a8a", success: "#4d7c2a", border: "#c8ccd4" };
}

function parseJSONResponse(response: string): ParsedResponse | null {
  try {
    let jsonStr = response.trim();
    const match = response.match(/```(?:json)?\n([\s\S]*?)\n```/);
    if (match) jsonStr = match[1];
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

const HELP_TEXT = `
Commands:
  /help                 Show this help message
  /switch <provider>    Switch LLM provider (openai, anthropic, google)
  /quit                 Exit the application
`;

const MAX_TURNS = 50;

export async function startTUI() {
  const renderer = await createCliRenderer({
    exitOnCtrlC: true,
    screenMode: "alternate-screen",
    consoleMode: "disabled",
  });

  const theme = await renderer.waitForThemeMode(1000);
  const isDark = theme !== "light";
  const colors = getThemeColors(isDark);

  let currentProvider: ProviderName = getDefaultProvider();
  let currentLLM = createLLM({ provider: currentProvider });
  let agent = createAgent(currentLLM);
  let conversationHistory: any[] = [];
  let isProcessing = false;
  let turnCounter = 0;
  const turnIds: string[] = [];

  const messagesContainer = new ScrollBoxRenderable(renderer, {
    id: "messages",
    width: "100%",
    flexGrow: 1,
    scrollY: true,
    stickyScroll: true,
    stickyStart: "bottom",
    viewportCulling: true,
  });

  const inputField = new InputRenderable(renderer, {
    id: "chat-input",
    value: "",
    placeholder: "Type a question...  (/help for commands)",
    textColor: colors.text,
    cursorColor: colors.accent,
  });

  const statusText = new TextRenderable(renderer, {
    content: t`${currentProvider}  ·  Ctrl+C to quit`,
    fg: colors.muted,
  });

  const inputBar = new BoxRenderable(renderer, {
    borderStyle: "single",
    borderColor: colors.border,
    paddingLeft: 1,
    paddingRight: 1,
    width: "100%",
    flexDirection: "column",
  });
  inputBar.add(inputField);
  inputBar.add(statusText);

  const headerText = new TextRenderable(renderer, {
    content: t`AliceWiki  —  ${currentProvider}`,
    fg: colors.accent,
    attributes: TextAttributes.BOLD,
  });

  const headerBar = new BoxRenderable(renderer, {
    borderStyle: "single",
    borderColor: colors.border,
    paddingLeft: 1,
    width: "100%",
  });
  headerBar.add(headerText);

  const layout = new BoxRenderable(renderer, {
    flexDirection: "column",
    width: "100%",
    height: "100%",
  });
  layout.add(headerBar);
  layout.add(messagesContainer);
  layout.add(inputBar);
  renderer.root.add(layout);

  inputField.focus();

  function addTurn(turn: BoxRenderable) {
    messagesContainer.add(turn);
    turnIds.push(turn.id);
    if (turnIds.length > MAX_TURNS) {
      const oldestId = turnIds.shift()!;
      messagesContainer.remove(oldestId);
    }
  }

  {
    const turn = new BoxRenderable(renderer, {
      id: "welcome",
      flexDirection: "column",
      width: "100%",
      padding: 1,
    });
    turn.add(new TextRenderable(renderer, {
      id: "welcome-text",
      content: "  AliceWiki  —  Powered by Wikipedia + LangChain",
      fg: colors.accent,
      attributes: TextAttributes.BOLD | TextAttributes.UNDERLINE,
    }));
    addTurn(turn);
  }

  inputField.on(InputRenderableEvents.ENTER, async (value: string) => {
    if (isProcessing) return;
    const trimmed = value.trim();
    inputField.value = "";
    if (!trimmed) return;

    if (trimmed === "/quit" || trimmed === "/exit") {
      renderer.destroy();
      process.exit(0);
    }

    if (trimmed === "/help") {
      const turn = new BoxRenderable(renderer, {
        borderStyle: "single",
        borderColor: colors.accent,
        padding: 1,
        width: "100%",
        flexDirection: "column",
      });
      turn.add(new TextRenderable(renderer, {
        content: "  HELP",
        fg: colors.accent,
        attributes: TextAttributes.BOLD,
      }));
      for (const line of HELP_TEXT.trim().split("\n")) {
        turn.add(new TextRenderable(renderer, {
          content: `  ${line}`,
          fg: colors.text,
        }));
      }
      addTurn(turn);
      return;
    }

    if (trimmed.startsWith("/switch")) {
      const parts = trimmed.split(/\s+/);
      if (parts.length < 2 || !isValidProvider(parts[1])) {
        const turn = new BoxRenderable(renderer, {
          flexDirection: "column",
          width: "100%",
          padding: 1,
        });
        turn.add(new TextRenderable(renderer, {
          content: "  Usage: /switch <provider> (openai, anthropic, google)",
          fg: colors.muted,
          attributes: TextAttributes.ITALIC,
        }));
        addTurn(turn);
        return;
      }
      const provider = parts[1].toLowerCase() as ProviderName;
      try {
        currentProvider = provider;
        currentLLM = createLLM({ provider: currentProvider });
        agent = createAgent(currentLLM);
        conversationHistory = [];
        const turn = new BoxRenderable(renderer, {
          flexDirection: "column",
          width: "100%",
          padding: 1,
        });
        turn.add(new TextRenderable(renderer, {
          content: `  Switched to ${provider}`,
          fg: colors.muted,
          attributes: TextAttributes.ITALIC,
        }));
        addTurn(turn);
        statusText.content = t`${currentProvider}  ·  Ctrl+C to quit`;
        headerText.content = t`AliceWiki  —  ${currentProvider}`;
      } catch (err) {
        const turn = new BoxRenderable(renderer, {
          flexDirection: "column",
          width: "100%",
          padding: 1,
        });
        turn.add(new TextRenderable(renderer, {
          content: `  Error: ${(err as Error).message}`,
          fg: "#ff0000",
        }));
        addTurn(turn);
      }
      return;
    }

    isProcessing = true;
    statusText.content = t`Thinking...`;

    const turn = new BoxRenderable(renderer, {
      flexDirection: "column",
      width: "100%",
    });

    const userBox = new BoxRenderable(renderer, {
      borderStyle: "single",
      borderColor: colors.border,
      padding: 1,
      width: "100%",
      flexDirection: "column",
    });
    userBox.add(new TextRenderable(renderer, {
      content: "  You",
      fg: colors.muted,
      attributes: TextAttributes.BOLD,
    }));
    userBox.add(new TextRenderable(renderer, {
      content: `  ${trimmed}`,
      fg: colors.text,
    }));
    turn.add(userBox);
    addTurn(turn);

    try {
      const response = await runAgent(agent, trimmed, conversationHistory);
      const parsed = parseJSONResponse(response);
      if (parsed) {
        const summaryBox = new BoxRenderable(renderer, {
          borderStyle: "single",
          borderColor: colors.accent,
          padding: 1,
          width: "100%",
          flexDirection: "column",
        });
        summaryBox.add(new TextRenderable(renderer, {
          content: "  SUMMARY",
          fg: colors.accent,
          attributes: TextAttributes.BOLD,
        }));
        summaryBox.add(new TextRenderable(renderer, {
          content: `  ${parsed.summary}`,
          fg: colors.text,
        }));
        turn.add(summaryBox);

        if (parsed.quotes.length > 0) {
          const quotesBox = new BoxRenderable(renderer, {
            borderStyle: "single",
            borderColor: colors.success,
            padding: 1,
            width: "100%",
            flexDirection: "column",
          });
          quotesBox.add(new TextRenderable(renderer, {
            content: "  DIRECT QUOTES",
            fg: colors.success,
            attributes: TextAttributes.BOLD,
          }));
          for (let i = 0; i < parsed.quotes.length; i++) {
            const q = parsed.quotes[i];
            quotesBox.add(new TextRenderable(renderer, {
              content: `  [${i + 1}] "${q.text}"\n       \u2014 ${q.source}\n       ${q.url}`,
              fg: colors.text,
            }));
          }
          turn.add(quotesBox);
        }

        if (parsed.sources.length > 0) {
          const sourcesBox = new BoxRenderable(renderer, {
            borderStyle: "single",
            borderColor: colors.border,
            padding: 1,
            width: "100%",
            flexDirection: "column",
          });
          sourcesBox.add(new TextRenderable(renderer, {
            content: "  SOURCES",
            fg: colors.muted,
            attributes: TextAttributes.BOLD,
          }));
          for (let i = 0; i < parsed.sources.length; i++) {
            const s = parsed.sources[i];
            sourcesBox.add(new TextRenderable(renderer, {
              content: `  [${i + 1}] ${s.title}\n       ${s.url}`,
              fg: colors.text,
            }));
          }
          turn.add(sourcesBox);
        }
      } else {
        turn.add(new TextRenderable(renderer, {
          content: `  ${response}`,
          fg: colors.text,
        }));
      }

      conversationHistory.push({ role: "user", content: trimmed });
      conversationHistory.push({ role: "assistant", content: response });
      if (conversationHistory.length > 20) {
        conversationHistory = conversationHistory.slice(-20);
      }
    } catch (err) {
      const errorBox = new BoxRenderable(renderer, {
        borderStyle: "single",
        borderColor: "#ff0000",
        padding: 1,
        width: "100%",
        flexDirection: "column",
      });
      errorBox.add(new TextRenderable(renderer, {
        content: "  ERROR",
        fg: "#ff0000",
        attributes: TextAttributes.BOLD,
      }));
      errorBox.add(new TextRenderable(renderer, {
        content: `  ${(err as Error).message}`,
        fg: colors.text,
      }));
      turn.add(errorBox);
    }

    statusText.content = t`${currentProvider}  ·  Ctrl+C to quit`;
    isProcessing = false;
  });
}
