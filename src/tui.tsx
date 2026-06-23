import { createCliRenderer } from "@opentui/core";
import type { KeyEvent } from "@opentui/core";
import { createRoot, useKeyboard, useRenderer, useSelectionHandler } from "@opentui/react";
import { useState, useRef, useEffect } from "react";
import { createAgent, runAgent } from "./agent.ts";
import { createLLM, getDefaultProvider, isValidProvider, DEFAULT_MODELS } from "./llm.ts";
import type { ProviderName } from "./llm.ts";
import { Header } from "./components/Header.tsx";
import { Sidebar } from "./components/Sidebar.tsx";
import { InputBar } from "./components/InputBar.tsx";
import { Messages } from "./components/Messages.tsx";
import type { TurnData } from "./components/MessageTurn.tsx";

export interface ThemeColors {
  text: string;
  muted: string;
  accent: string;
  border: string;
  source: string;
  quote: string;
}

export interface Quote {
  text: string;
  source: string;
  url: string;
}

export interface Source {
  title: string;
  url: string;
}

export interface ParsedResponse {
  summary: string;
  quotes: Quote[];
  sources: Source[];
}

export function getThemeColors(isDark: boolean): ThemeColors {
  return isDark
    ? { text: "#c0caf5", muted: "#565f89", accent: "#7aa2f7", border: "#3b4261", source: "#ffffff", quote: "#e0af68" }
    : { text: "#1a1b26", muted: "#9aa0b0", accent: "#2e4a8a", border: "#c8ccd4", source: "#383c5a", quote: "#c89a3c" };
}

export function parseJSONResponse(response: string): ParsedResponse | null {
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
const WELCOME_TEXT = "  Welcome to AliceWiki! A place where you can go deep dive into a topic using Wikipedia API as the source. \n  Start asking question on the input box below \n\n  Have fun deep diving! or should i call it.. Down the rabbit hole!";

interface AppProps {
  colors: ThemeColors;
  isDark: boolean;
}

function App({ colors, isDark }: AppProps) {
  const renderer = useRenderer();
  const [currentProvider, setCurrentProvider] = useState<ProviderName>(getDefaultProvider());
  const [isProcessing, setIsProcessing] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [messages, setMessages] = useState<TurnData[]>([{ id: "welcome", query: "", raw: WELCOME_TEXT }]);
  const [queryCount, setQueryCount] = useState(0);
  const [articleFetchCount, setArticleFetchCount] = useState(0);
  const [articles, setArticles] = useState<string[]>([]);
  const [inputKey, setInputKey] = useState(0);

  const agentRef = useRef(createAgent(createLLM({ provider: getDefaultProvider() })));
  const conversationHistoryRef = useRef<any[]>([]);
  const articleCacheRef = useRef<Set<string>>(new Set());
  const isProcessingRef = useRef(false);

  useSelectionHandler((selection) => {
    const text = selection.getSelectedText();
    if (text) {
      renderer.copyToClipboardOSC52(text);
    }
  });

  useKeyboard((key: KeyEvent) => {
    if (key.meta && key.name === "d") {
      setInputKey((k) => k + 1);
    }
    if (key.ctrl && key.name === "b") {
      setSidebarVisible((v) => !v);
    }
  });

  function handleSubmit(value: string) {
    if (isProcessingRef.current) return;
    const trimmed = value.trim();
    if (!trimmed) return;

    if (trimmed === "/quit" || trimmed === "/exit") {
      renderer.destroy();
      process.exit(0);
    }

    if (trimmed === "/help") {
      const id = crypto.randomUUID();
      const lines = HELP_TEXT.trim().split("\n").map((l) => `  ${l}`).join("\n");
      setMessages((prev) => [...prev.slice(-(MAX_TURNS - 1)), { id, query: "", raw: lines }]);
      return;
    }

    if (trimmed.startsWith("/switch")) {
      const parts = trimmed.split(/\s+/);
      if (parts.length < 2 || !isValidProvider(parts[1])) {
        const id = crypto.randomUUID();
        setMessages((prev) => [...prev.slice(-(MAX_TURNS - 1)), { id, query: "", raw: "  Usage: /switch <provider> (openai, anthropic, google)" }]);
        return;
      }
      const provider = parts[1].toLowerCase() as ProviderName;
      try {
        const newLLM = createLLM({ provider });
        const newAgent = createAgent(newLLM);
        setCurrentProvider(provider);
        agentRef.current = newAgent;
        conversationHistoryRef.current = [];
        const id = crypto.randomUUID();
        setMessages((prev) => [...prev.slice(-(MAX_TURNS - 1)), { id, query: "", raw: `  Switched to ${provider}` }]);
      } catch (err) {
        const id = crypto.randomUUID();
        setMessages((prev) => [...prev.slice(-(MAX_TURNS - 1)), { id, query: "", raw: `  Error: ${(err as Error).message}`, error: (err as Error).message }]);
      }
      return;
    }

    isProcessingRef.current = true;
    setIsProcessing(true);

    const turnId = crypto.randomUUID();
    const turn: TurnData = { id: turnId, query: trimmed, isProcessing: true };
    setMessages((prev) => [...prev.slice(-(MAX_TURNS - 1)), turn]);

    runAgent(agentRef.current, trimmed, conversationHistoryRef.current)
      .then((response) => {
        const parsed = parseJSONResponse(response);
        if (parsed) {
          setMessages((prev) =>
            prev.map((t) =>
              t.id === turnId
                ? { ...t, isProcessing: false, summary: parsed!.summary, quotes: parsed!.quotes, sources: parsed!.sources }
                : t
            )
          );
          setQueryCount((prev) => prev + 1);
          if (parsed.sources.length > 0) {
            const title = parsed.sources[0].title;
            if (!articleCacheRef.current.has(title)) {
              articleCacheRef.current.add(title);
              setArticles((prev) => [...prev, title]);
            }
            setArticleFetchCount((prev) => prev + 1);
          }
        } else {
          setMessages((prev) =>
            prev.map((t) =>
              t.id === turnId
                ? { ...t, isProcessing: false, raw: response }
                : t
            )
          );
        }
        conversationHistoryRef.current.push({ role: "user", content: trimmed });
        conversationHistoryRef.current.push({ role: "assistant", content: response });
        if (conversationHistoryRef.current.length > 20) {
          conversationHistoryRef.current = conversationHistoryRef.current.slice(-20);
        }
      })
      .catch((err) => {
        setMessages((prev) =>
          prev.map((t) =>
            t.id === turnId
              ? { ...t, isProcessing: false, error: (err as Error).message }
              : t
          )
        );
      })
      .finally(() => {
        isProcessingRef.current = false;
        setIsProcessing(false);
      });
  }

  return (
    <box flexDirection="row" width="100%" height="100%">
      {sidebarVisible && (
        <Sidebar
          colors={colors}
          isDark={isDark}
          queryCount={queryCount}
          articleCount={articleFetchCount}
          articles={articles}
        />
      )}
      <box flexDirection="column" flexGrow={1} width="100%" height="100%">
        <Header currentProvider={currentProvider} colors={colors} />
        <Messages messages={messages} colors={colors} />
        <InputBar
          colors={colors}
          currentProvider={currentProvider}
          isProcessing={isProcessing}
          onSubmit={handleSubmit}
          inputKey={inputKey}
        />
      </box>
    </box>
  );
}

export async function startTUI() {
  const renderer = await createCliRenderer({
    exitOnCtrlC: true,
    screenMode: "alternate-screen",
    consoleMode: "disabled",
  });

  const theme = await renderer.waitForThemeMode(1000);
  const isDark = theme !== "light";
  const colors = getThemeColors(isDark);

  createRoot(renderer).render(<App colors={colors} isDark={isDark} />);
}
