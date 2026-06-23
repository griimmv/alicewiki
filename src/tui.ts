import {
  createCliRenderer,
  TextRenderable,
  BoxRenderable,
  ScrollBoxRenderable,
  InputRenderable,
  InputRenderableEvents,
  TextAttributes,
  type RenderContext,
  t,
} from "@opentui/core";
import type { KeyEvent } from "@opentui/core";
import { createAgent, runAgent } from "./agent.ts";
import { createLLM, getDefaultProvider, isValidProvider, DEFAULT_MODELS } from "./llm.ts";
import type { ProviderName } from "./llm.ts";

// ── File map ──────────────────────────────────────────────
// 64-72   ThemeColors interface
// 73-78   Quote interface
// 79-82   Source interface
// 84-88   ParsedResponse interface
// 90-94   getThemeColors()
// 96-105  parseJSONResponse()
// 107-120 typeText()
// 122-126 PAGGA_ART (ASCII logo)
// 128-133 HELP_TEXT
// 135     MAX_TURNS
// 137-673 startTUI()
//   138-142   createCliRenderer
//   144-146   theme detection
//   UI Components:
//   148-164   Header (headerText, headerBar)
//   166-297   Sidebar class (inline)
//             173 articleCache: Set<string> (dedup)
//             205-206 queriesText, articlesText (split from single statsText)
//             213-221  statsBox wrapper (flexShrink: 0)
//             229     kbHint helper
//             233-241 kbBox wrapper (flexShrink: 0) with 4 keybind hints
//             238     Ctrl+B to hide sidebar
//             239     Alt+D to focus input bar
//             240     Ctrl+C to quit
//             241     Ctrl+click to open links
//             258-259 spacer×2 before FETCHED ARTICLES
//             283-284 updateStats() sets two separate texts
//             288-289 addHistoryEntry() deduplicates via articleCache
//   299-310   Sidebar init + state vars
//   312-322   messagesContainer
//   323-348   Input Bar (inputField, statusText, inputBar)
//   349-367   UI Layout:
//           rootLayout (row)
//             sidebar
//             mainColumn (column)
//               headerBar
//               messages
//               inputBar
//   369-375   Alt+D (focus input) + Ctrl+B (toggle sidebar) keybindings
//   377       inputField.focus()
//   379-386   addTurn() — capped at MAX_TURNS
//   388-401   Welcome message turn
//   403-672   Input handler (ENTER)
//     409-412   /quit
//     414-435   /help
//     437-485   /switch <provider>
//     487-668   Main query handler
//       489-512   User query box
//       514-521   Spinner
//       523-649   Agent run + response rendering
//         527-545   Summary box
//         547-571   Quotes boxes
//         573-597   Sources boxes
//         599-634   Typewriter animation (summary · quotes · sources · raw fallback)
//         636-649   Conversation history + sidebar update
//       650-668   Error handling
//     670-672   Cleanup (spinner stop, isProcessing = false)

interface ThemeColors {
  text: string;
  muted: string;
  accent: string;
  border: string;
  source: string;
  quote: string;
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
    ? { text: "#c0caf5", muted: "#565f89", accent: "#7aa2f7", border: "#3b4261", source: "#ffffff", quote: "#e0af68" }
    : { text: "#1a1b26", muted: "#9aa0b0", accent: "#2e4a8a", border: "#c8ccd4", source: "#383c5a", quote: "#c89a3c" };
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

async function typeText(
  renderer: any,
  tr: TextRenderable,
  text: string,
  speedMs: number = 15,
): Promise<void> {
  if (!text) return;
  renderer.requestLive();
  for (let i = 1; i <= text.length; i++) {
    tr.content = text.slice(0, i);
    await new Promise((r) => setTimeout(r, speedMs));
  }
  renderer.dropLive();
}

const PAGGA_ART = [
  "░█▀█░█░░░▀█▀░█▀▀░█▀▀░█░█░▀█▀░█░█░▀█▀░",
  "░█▀█░█░░░░█░░█░░░█▀▀░█▄█░░█░░█▀▄░░█░░",
  "░▀░▀░▀▀▀░▀▀▀░▀▀▀░▀▀▀░▀░▀░▀▀▀░▀░▀░▀▀▀░",
];

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

  // ── Header ──
  let currentProvider: ProviderName = getDefaultProvider();

  const headerText = new TextRenderable(renderer, {
    content: t`${PAGGA_ART[0]}\n${PAGGA_ART[1]}  Current provider: ${currentProvider}\n${PAGGA_ART[2]}`,
    fg: colors.accent,
    attributes: TextAttributes.BOLD,
  });

  const headerBar = new BoxRenderable(renderer, {
    borderStyle: "heavy",
    borderColor: colors.border,
    paddingLeft: 1,
    width: "100%",
    flexShrink: 0,
  });
  headerBar.add(headerText);

  // ── Sidebar class ──
  class Sidebar {
    private container: BoxRenderable;
    private queriesText: TextRenderable;
    private articlesText: TextRenderable;
    private historyBox: ScrollBoxRenderable;
    private ctx: RenderContext;
    private colors: ThemeColors;
    private _visible: boolean = true;
    private articleCache: Set<string> = new Set();

    constructor(ctx: RenderContext, colors: ThemeColors, isDark: boolean) {
      this.ctx = ctx;
      this.colors = colors;
      const sidebarBg = isDark ? "#24283b" : "#d5d6db";

      const label = (text: string) => new TextRenderable(ctx, {
        content: ` ${text}`,
        fg: colors.muted,
        attributes: TextAttributes.BOLD,
      });

      const spacer = () => new BoxRenderable(ctx, {
        height: 1,
        width: "100%",
      });

      const titleText = new TextRenderable(ctx, {
        content: " ALICEWIKI",
        fg: colors.accent,
        attributes: TextAttributes.BOLD,
      });

      const separator = new TextRenderable(ctx, {
        content: " " + "─".repeat(26),
        fg: colors.muted,
      });

      const statsLabel = label("SESSION STATS");
      this.queriesText = new TextRenderable(ctx, {
        content: ` Queries: 0`,
        fg: colors.text,
      });
      this.articlesText = new TextRenderable(ctx, {
        content: ` Articles: 0`,
        fg: colors.text,
      });
      const statsBox = new BoxRenderable(ctx, {
        flexDirection: "column",
        width: "100%",
        flexShrink: 0,
      });
      statsBox.add(statsLabel);
      statsBox.add(this.queriesText);
      statsBox.add(this.articlesText);

      const historyLabel = label("FETCHED ARTICLES");
      this.historyBox = new ScrollBoxRenderable(ctx, {
        flexGrow: 1,
        scrollY: true,
        viewportCulling: true,
      });

      const kbHint = (text: string) => new TextRenderable(ctx, {
        content: ` ${text}`,
        fg: colors.text,
      });
      const kbBox = new BoxRenderable(ctx, {
        flexDirection: "column",
        width: "100%",
        flexShrink: 0,
      });
      kbBox.add(kbHint("Ctrl+B to hide sidebar"));
      kbBox.add(kbHint("Alt+D to focus input bar"));
      kbBox.add(kbHint("Ctrl+C to quit"));
      kbBox.add(kbHint("Ctrl+click to open links"));

      this.container = new BoxRenderable(ctx, {
        borderStyle: "single",
        borderColor: colors.border,
        backgroundColor: sidebarBg,
        paddingLeft: 1,
        paddingRight: 1,
        paddingTop: 1,
        paddingBottom: 1,
        width: 30,
        flexDirection: "column",
        flexShrink: 0,
      });

      this.container.add(titleText);
      this.container.add(separator);
      this.container.add(spacer());
      this.container.add(statsBox);
      this.container.add(spacer());
      this.container.add(spacer());
      this.container.add(historyLabel);
      this.container.add(this.historyBox);
      this.container.add(spacer());
      this.container.add(kbBox);
    }

    getContainer(): BoxRenderable {
      return this.container;
    }

    toggle(): boolean {
      this._visible = !this._visible;
      this.container.visible = this._visible;
      return this._visible;
    }

    isVisible(): boolean {
      return this._visible;
    }

    updateStats(queries: number, articles: number) {
      this.queriesText.content = ` Queries: ${queries}`;
      this.articlesText.content = ` Articles: ${articles}`;
    }

    addHistoryEntry(title: string) {
      if (this.articleCache.has(title)) return;
      this.articleCache.add(title);
      const display = title.length > 26 ? title.slice(0, 26) + "\u2026" : title;
      const entry = new TextRenderable(this.ctx, {
        content: t` ${display}`,
        fg: this.colors.text,
      });
      this.historyBox.add(entry);
    }
  }

  // ── Sidebar init ──
  const sidebar = new Sidebar(renderer, colors, isDark);
  let queryCount = 0;
  let articleFetchCount = 0;

  let currentLLM = createLLM({ provider: currentProvider });
  let agent = createAgent(currentLLM);
  let conversationHistory: any[] = [];
  let isProcessing = false;
  let turnCounter = 0;
  const turnIds: string[] = [];

  // ── Messages Container ──
  const messagesContainer = new ScrollBoxRenderable(renderer, {
    id: "messages",
    width: "100%",
    flexGrow: 1,
    scrollY: true,
    stickyScroll: true,
    stickyStart: "bottom",
    viewportCulling: true,
  });

  // ── Input Bar ──
  const inputField = new InputRenderable(renderer, {
    id: "chat-input",
    value: "",
    placeholder: "Type a question...  (/help for commands)",
    textColor: colors.text,
    cursorColor: colors.accent,
  });

  const statusText = new TextRenderable(renderer, {
    content: t`${DEFAULT_MODELS[currentProvider]}`,
    fg: colors.muted,
  });

  const inputBar = new BoxRenderable(renderer, {
    borderStyle: "heavy",
    borderColor: colors.border,
    paddingLeft: 1,
    paddingRight: 1,
    width: "100%",
    flexDirection: "column",
    flexShrink: 0,
  });
  inputBar.add(inputField);
  inputBar.add(statusText);

  // ── UI Layout ──
  const mainColumn = new BoxRenderable(renderer, {
    flexDirection: "column",
    flexGrow: 1,
    width: "100%",
    height: "100%",
  });
  mainColumn.add(headerBar);
  mainColumn.add(messagesContainer);
  mainColumn.add(inputBar);

  const rootLayout = new BoxRenderable(renderer, {
    flexDirection: "row",
    width: "100%",
    height: "100%",
  });
  rootLayout.add(sidebar.getContainer());
  rootLayout.add(mainColumn);
  renderer.root.add(rootLayout);

  renderer.keyInput.on("keypress", (key: KeyEvent) => {
    if (key.meta && key.name === "d") {
      inputField.focus();
    }
    if (key.ctrl && key.name === "b") {
      sidebar.toggle();
    }
  });

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
      content: "  Welcome to AliceWiki! A place where you can go deep dive into a topic using Wikipedia API as the source. \n  Start asking question on the input box below \n\n  Have fun deep diving! or should i call it.. Down the rabbit hole!",
      fg: colors.text,
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
        statusText.content = t`${DEFAULT_MODELS[currentProvider]}`;
        headerText.content = t`${PAGGA_ART[0]}\n${PAGGA_ART[1]}  Current provider: ${currentProvider}\n${PAGGA_ART[2]}\n`;
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

    const turn = new BoxRenderable(renderer, {
      flexDirection: "column",
      width: "100%",
    });

    const userBox = new BoxRenderable(renderer, {
      borderStyle: "rounded",
      borderColor: colors.border,
      titleColor: colors.source,
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

    const spinnerFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
    let spinnerIdx = 0;
    // Initial frame — prevents blank gap before first interval tick
    userBox.bottomTitle = ` ${spinnerFrames[0]} Thinking `;
    const spinnerInterval = setInterval(() => {
      spinnerIdx = (spinnerIdx + 1) % spinnerFrames.length;
      userBox.bottomTitle = ` ${spinnerFrames[spinnerIdx]} Thinking `;
    }, 80);

    try {
      const response = await runAgent(agent, trimmed, conversationHistory);
      const parsed = parseJSONResponse(response);
      if (parsed) {
        // ── Summary ──
        const summaryBox = new BoxRenderable(renderer, {
          borderStyle: "rounded",
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
        const summaryText = new TextRenderable(renderer, {
          content: "",
          fg: colors.text,
        });
        summaryBox.add(summaryText);
        turn.add(summaryBox);

        // ── Quotes (boxes built now, animated later) ──
        const quoteTexts: TextRenderable[] = [];
        if (parsed.quotes.length > 0) {
          const quotesBox = new BoxRenderable(renderer, {
            borderStyle: "single",
            borderColor: colors.quote,
            padding: 1,
            width: "100%",
            flexDirection: "column",
          });
          quotesBox.add(new TextRenderable(renderer, {
            content: "  DIRECT QUOTES",
            fg: colors.quote,
            attributes: TextAttributes.BOLD,
          }));
          for (let i = 0; i < parsed.quotes.length; i++) {
            const qt = new TextRenderable(renderer, {
              content: "",
              fg: colors.text,
            });
            quotesBox.add(qt);
            quoteTexts.push(qt);
          }
          turn.add(quotesBox);
        }

        // ── Sources (boxes built now, animated later) ──
        const sourceTexts: TextRenderable[] = [];
        if (parsed.sources.length > 0) {
          const sourcesBox = new BoxRenderable(renderer, {
            borderStyle: "single",
            borderColor: colors.source,
            padding: 1,
            width: "100%",
            flexDirection: "column",
          });
          sourcesBox.add(new TextRenderable(renderer, {
            content: "  SOURCES",
            fg: colors.source,
            attributes: TextAttributes.BOLD,
          }));
          for (let i = 0; i < parsed.sources.length; i++) {
            const st = new TextRenderable(renderer, {
              content: "",
              fg: colors.text,
            });
            sourcesBox.add(st);
            sourceTexts.push(st);
          }
          turn.add(sourcesBox);
        }

        // ── Typewriter animation ──
        await typeText(renderer, summaryText, `  ${parsed.summary}`, 15);

        if (parsed.quotes.length > 0) {
          await new Promise((r) => setTimeout(r, 200));
          for (let i = 0; i < parsed.quotes.length; i++) {
            const q = parsed.quotes[i];
            await typeText(
              renderer,
              quoteTexts[i],
              `  [${i + 1}] "${q.text}"\n       \u2014 ${q.source}\n       ${q.url}`,
              10,
            );
          }
        }

        if (parsed.sources.length > 0) {
          await new Promise((r) => setTimeout(r, 200));
          for (let i = 0; i < parsed.sources.length; i++) {
            const s = parsed.sources[i];
            await typeText(
              renderer,
              sourceTexts[i],
              `  [${i + 1}] ${s.title}\n       ${s.url}`,
              10,
            );
          }
        }
      } else {
        const rawText = new TextRenderable(renderer, {
          content: "",
          fg: colors.text,
        });
        turn.add(rawText);
        await typeText(renderer, rawText, `  ${response}`, 15);
      }

      conversationHistory.push({ role: "user", content: trimmed });
      conversationHistory.push({ role: "assistant", content: response });
      if (conversationHistory.length > 20) {
        conversationHistory = conversationHistory.slice(-20);
      }

      queryCount++;
      if (parsed?.sources?.length > 0) {
        const firstSource = parsed.sources[0];
        sidebar.addHistoryEntry(firstSource.title);
        articleFetchCount++;
      }
      sidebar.updateStats(queryCount, articleFetchCount);

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

    clearInterval(spinnerInterval);
    userBox.bottomTitle = "";
    isProcessing = false;
  });
}
