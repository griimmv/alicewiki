import { createCliRenderer } from "@opentui/core";
import type { KeyEvent } from "@opentui/core";
import { createRoot, useKeyboard, useRenderer, useSelectionHandler } from "@opentui/react";
import { useState, useRef, useEffect } from "react";
import { createAgent, runAgent } from "./agent.ts";
import { createLLM, getDefaultProvider, isValidProvider, isValidModel, DEFAULT_MODELS, KNOWN_MODELS } from "./llm.ts";
import type { ProviderName } from "./llm.ts";
import { Header } from "./components/Header.tsx";
import { Sidebar } from "./components/Sidebar.tsx";
import { InputBar } from "./components/InputBar.tsx";
import { Messages } from "./components/Messages.tsx";
import type { TurnData } from "./components/MessageTurn.tsx";
import { getCurrentSessionId, saveTurn, updateSessionProvider, setCredential, getSessionProvider, createSession, listSessions, switchSession, renameSession, deleteSession, getSessionTurns } from "./db.ts";
import type { SessionInfo, SessionTurn } from "./db.ts";
import { SetupModal } from "./components/SetupModal.tsx";
import { SessionModal } from "./components/SessionModal.tsx";

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

// Parse LLM response and validate if it matches the expected ParsedResponse shape
export function parseJSONResponse(response: string): ParsedResponse | null {
  try {
    let jsonStr = response.trim();
    const match = response.match(/```(?:json)?\n([\s\S]*?)\n```/);
    if (match) jsonStr = match[1];
    const parsed: unknown = JSON.parse(jsonStr);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as any).summary === "string" &&
      Array.isArray((parsed as any).quotes) &&
      Array.isArray((parsed as any).sources)
    ) {
      return parsed as ParsedResponse;
    }
    return null;
  } catch {
    return null;
  }
}

const HELP_TEXT = `
Commands:
  /help                 Show this help message
  /sessions             Open session manager
  /switch <provider>    Switch LLM provider (openai, anthropic, google)
  /model <name>         Change model for current provider
  /quit                 Exit the application

Keybindings:
  Ctrl+B                Toggle sidebar visibility
  Alt+D                 Focus the input bar
  Ctrl+C                Quit
  Ctrl+click            Open links
`;

const MAX_TURNS = 50;
const WELCOME_TEXT = "  Welcome to AliceWiki! A place where you can go deep dive into a topic using Wikipedia as the source. \n  Start asking question on the input box below \n\n  Have fun deep diving! or should i call it.. Down the rabbit hole!";

interface AppProps {
  colors: ThemeColors;
  isDark: boolean;
}

function App({ colors, isDark }: AppProps) {
  const renderer = useRenderer();
  const [currentProvider, setCurrentProvider] = useState<ProviderName>(getDefaultProvider());
  const [currentModel, setCurrentModel] = useState(() => {
    const session = getSessionProvider();
    return session?.model ?? DEFAULT_MODELS[currentProvider];
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [messages, setMessages] = useState<TurnData[]>([{ id: "welcome", query: "", raw: WELCOME_TEXT }]);
  const [queryCount, setQueryCount] = useState(0);
  const [articleFetchCount, setArticleFetchCount] = useState(0);
  const [articles, setArticles] = useState<string[]>([]);
  const [totalTokens, setTotalTokens] = useState(0);
  const [inputKey, setInputKey] = useState(0);

  const agentRef = useRef<any>(null);
  const conversationHistoryRef = useRef<any[]>([]);
  const articleCacheRef = useRef<Set<string>>(new Set());
  const isProcessingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const turnIndexRef = useRef(0); // sequential turn number used when saving turns/messageTurn(s) to SQLite
  const [setupModal, setSetupModal] = useState<{ visible: boolean; provider: ProviderName | null }>({ visible: false, provider: null });
  const setupModalRef = useRef(setupModal);
  setupModalRef.current = setupModal;
  const [sessionModal, setSessionModal] = useState(false);
  const [sessionsList, setSessionsList] = useState<SessionInfo[]>([]);
  const sessionModalRef = useRef(sessionModal);
  sessionModalRef.current = sessionModal;

  useEffect(() => {
    setSessionsList(listSessions());
    return () => abortControllerRef.current?.abort();
  }, []);

  useSelectionHandler((selection) => {
    const text = selection.getSelectedText();
    if (text) {
      renderer.copyToClipboardOSC52(text);
    }
  });

  useKeyboard((key: KeyEvent) => {
    if (key.name === "escape" && setupModalRef.current.visible) {
      setSetupModal({ visible: false, provider: null });
      return;
    }
    if (key.name === "escape" && sessionModalRef.current) {
      setSessionModal(false);
      return;
    }
    if (key.name === "escape" && isProcessingRef.current) {
      abortControllerRef.current?.abort();
      return;
    }
    if (key.meta && key.name === "d") {
      setInputKey((k) => k + 1);
    }
    if (key.ctrl && key.name === "b") {
      setSidebarVisible((v) => !v);
    }
  });

  function handleTurnAnimationComplete() {
    isProcessingRef.current = false;
    setIsProcessing(false);
  }

  function refreshSessionsList() {
    setSessionsList(listSessions());
  }

  function handleSessionSwitch(id: number) {
    const session = switchSession(id);
    if (!session) return;

    const newProvider = session.provider as ProviderName;
    const newModel = session.model ?? DEFAULT_MODELS[newProvider];
    // Avoid recreating agent when provider/model haven't changed
    if (newProvider !== currentProvider || newModel !== currentModel) {
      agentRef.current = null;
    }
    setCurrentProvider(newProvider);
    setCurrentModel(newModel);

    const rawTurns = getSessionTurns(id);
    const loadedTurns: TurnData[] = rawTurns.map((t: SessionTurn) => ({
      id: `turn-${t.id}`,
      query: t.query,
      summary: t.summary ?? undefined,
      quotes: t.quotes ? (JSON.parse(t.quotes) as Quote[]) : undefined,
      sources: t.sources ? (JSON.parse(t.sources) as Source[]) : undefined,
      raw: t.raw ?? undefined,
      error: t.error ?? undefined,
      help: t.help === 1,
    }));
    setMessages(loadedTurns.length > 0 ? loadedTurns : [{ id: "welcome", query: "", raw: WELCOME_TEXT }]);

    // Reconstruct conversation history from DB so the agent has context on next query
    const history: { role: string; content: string }[] = [];
    for (const t of rawTurns) {
      if (t.error || !t.query) continue;
      history.push({ role: "user", content: t.query });
      // Use raw (unparseable) response, or reconstruct JSON from stored summary/quotes/sources
      if (t.raw) {
        history.push({ role: "assistant", content: t.raw });
      } else if (t.summary) {
        history.push({
          role: "assistant",
          content: JSON.stringify({
            summary: t.summary,
            quotes: t.quotes ? JSON.parse(t.quotes) : [],
            sources: t.sources ? JSON.parse(t.sources) : [],
          }),
        });
      }
    }
    conversationHistoryRef.current = history;
    turnIndexRef.current = rawTurns.length;
    setQueryCount(rawTurns.filter((t) => t.query).length);
    const articleSet = new Set<string>();
    let articleCount = 0;
    for (const t of rawTurns) {
      if (t.sources) {
        const parsed = JSON.parse(t.sources) as Source[];
        if (parsed.length > 0) {
          articleCount++;
          articleSet.add(parsed[0].title);
        }
      }
    }
    setArticles(Array.from(articleSet));
    articleCacheRef.current = articleSet;
    setArticleFetchCount(articleCount);
    setTotalTokens(0);
    setSessionModal(false);
    refreshSessionsList();
  }

  function handleSessionCreate(name: string) {
    const id = createSession(name);
    const session = switchSession(id);
    setCurrentProvider(session.provider as ProviderName);
    setCurrentModel(session.model ?? DEFAULT_MODELS[session.provider as ProviderName]);
    setMessages([{ id: "welcome", query: "", raw: WELCOME_TEXT }]);
    conversationHistoryRef.current = [];
    agentRef.current = null;
    turnIndexRef.current = 0;
    setQueryCount(0);
    setArticleFetchCount(0);
    setArticles([]);
    articleCacheRef.current = new Set();
    setTotalTokens(0);
    refreshSessionsList();
  }

  function handleSessionRename(id: number, name: string) {
    renameSession(id, name);
    refreshSessionsList();
  }

  function handleSessionDelete(id: number) {
    const wasCurrent = id === getCurrentSessionId();
    deleteSession(id);
    const remaining = listSessions();
    if (remaining.length === 0) {
      const newId = createSession("default");
      const session = switchSession(newId);
      setCurrentProvider(session.provider as ProviderName);
      setCurrentModel(session.model ?? DEFAULT_MODELS[session.provider as ProviderName]);
      setMessages([{ id: "welcome", query: "", raw: WELCOME_TEXT }]);
      conversationHistoryRef.current = [];
      agentRef.current = null;
      turnIndexRef.current = 0;
      setQueryCount(0);
      setArticleFetchCount(0);
      setArticles([]);
      articleCacheRef.current = new Set();
      setTotalTokens(0);
    } else if (wasCurrent) {
      handleSessionSwitch(remaining[0].id);
    }
    refreshSessionsList();
  }

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
      setMessages((prev) => [...prev.slice(-(MAX_TURNS - 1)), { id, query: "", raw: lines, help: true }]);
      return;
    }

    if (trimmed.startsWith("/switch")) {
      const parts = trimmed.split(/\s+/);
      if (parts.length < 2 || !isValidProvider(parts[1])) {
        const id = crypto.randomUUID();
        setMessages((prev) => [...prev.slice(-(MAX_TURNS - 1)), { id, query: "", raw: "  Usage: /switch <provider> (openai, anthropic, google)", help: true }]);
        return;
      }
      const provider = parts[1].toLowerCase() as ProviderName;
      setCurrentProvider(provider);
      setCurrentModel(DEFAULT_MODELS[provider]);
      agentRef.current = null;
      conversationHistoryRef.current = [];
      const id = crypto.randomUUID();
      setMessages((prev) => [...prev.slice(-(MAX_TURNS - 1)), { id, query: "", raw: `  Switched to ${provider} (model: ${DEFAULT_MODELS[provider]})`, help: true }]);
      updateSessionProvider(provider, DEFAULT_MODELS[provider]);
      return;
    }

    if (trimmed.startsWith("/setKey")) {
      const parts = trimmed.split(/\s+/);
      if (parts.length < 2 || !isValidProvider(parts[1])) {
        const id = crypto.randomUUID();
        setMessages((prev) => [...prev.slice(-(MAX_TURNS - 1)), { id, query: "", raw: "  Usage: /setKey <provider>\n  Providers: openai, anthropic, google", help: true }]);
        return;
      }
      const provider = parts[1].toLowerCase() as ProviderName;
      setSetupModal({ visible: true, provider });
      return;
    }

    if (trimmed.startsWith("/model")) {
      const parts = trimmed.split(/\s+/);
      if (parts.length < 2) {
        const id = crypto.randomUUID();
        setMessages((prev) => [...prev.slice(-(MAX_TURNS - 1)), { id, query: "", raw: `  Usage: /model <model_name>\n  Known models for ${currentProvider}: ${KNOWN_MODELS[currentProvider].join(", ")}`, help: true }]);
        return;
      }
      const modelName = parts.slice(1).join(" ");
      if (!isValidModel(currentProvider, modelName)) {
        const id = crypto.randomUUID();
        setMessages((prev) => [...prev.slice(-(MAX_TURNS - 1)), { id, query: "", raw: `  Unknown model "${modelName}" for ${currentProvider}.\n  Known models: ${KNOWN_MODELS[currentProvider].join(", ")}`, help: true }]);
        return;
      }
      setCurrentModel(modelName);
      agentRef.current = null;
      conversationHistoryRef.current = [];
      const id = crypto.randomUUID();
      setMessages((prev) => [...prev.slice(-(MAX_TURNS - 1)), { id, query: "", raw: `  Switched model to ${modelName}`, help: true }]);
      updateSessionProvider(currentProvider, modelName);
      return;
    }

    if (trimmed.startsWith("/sessions")) {
      setSessionsList(listSessions());
      setSessionModal(true);
      return;
    }

    setInputKey((k) => k + 1);

    // init agent lazily so the TUI starts even without a configured API key
    if (!agentRef.current) {
      try {
        agentRef.current = createAgent(createLLM({ provider: currentProvider, modelName: currentModel }));
      } catch (err) {
        const id = crypto.randomUUID();
        setMessages((prev) => [...prev.slice(-(MAX_TURNS - 1)), { id, query: trimmed, error: (err as Error).message }]);
        return;
      }
    }

    isProcessingRef.current = true;
    setIsProcessing(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const turnId = crypto.randomUUID();
    const turn: TurnData = { id: turnId, query: trimmed, isProcessing: true };
    setMessages((prev) => [...prev.slice(-(MAX_TURNS - 1)), turn]);

    runAgent(agentRef.current, trimmed, conversationHistoryRef.current, controller.signal)
      .then(({ content: response, tokens }) => {
        setTotalTokens((prev) => prev + tokens.total);
        const parsed = parseJSONResponse(response);
        setQueryCount((prev) => prev + 1);

        if (parsed) {
          setMessages((prev) =>
            prev.map((t) =>
              t.id === turnId
                ? { ...t, isProcessing: false, summary: parsed!.summary, quotes: parsed!.quotes, sources: parsed!.sources }
                : t
            )
          );
          if (parsed.sources.length > 0) {
            const title = parsed.sources[0].title;
            if (!articleCacheRef.current.has(title)) {
              articleCacheRef.current.add(title);
              setArticles((prev) => [...prev, title]);
            }
            setArticleFetchCount((prev) => prev + 1);
          }
          const sessionId = getCurrentSessionId();
          if (sessionId !== null) {
            turnIndexRef.current += 1;
            saveTurn(sessionId, {
              query: trimmed,
              turnIndex: turnIndexRef.current,
              summary: parsed.summary,
              quotes: JSON.stringify(parsed.quotes),
              sources: JSON.stringify(parsed.sources),
              inputTokens: tokens.input,
              outputTokens: tokens.output,
            });
          }
        } else {
          setMessages((prev) =>
            prev.map((t) =>
              t.id === turnId
                ? { ...t, isProcessing: false, raw: response }
                : t
            )
          );
          const sessionId = getCurrentSessionId();
          if (sessionId !== null) {
            turnIndexRef.current += 1;
            saveTurn(sessionId, {
              query: trimmed,
              turnIndex: turnIndexRef.current,
              raw: response,
              inputTokens: tokens.input,
              outputTokens: tokens.output,
            });
          }
        }
        conversationHistoryRef.current.push({ role: "user", content: trimmed });
        conversationHistoryRef.current.push({ role: "assistant", content: response });
        if (conversationHistoryRef.current.length > 20) {
          conversationHistoryRef.current = conversationHistoryRef.current.slice(-20);
        }
      })
      .catch((err: unknown) => {
        const error = err as Error;
        setMessages((prev) =>
          prev.map((t) =>
            t.id === turnId
              ? { ...t, isProcessing: false, error: error.message }
              : t
          )
        );
        const sessionId = getCurrentSessionId();
        if (sessionId !== null) {
          turnIndexRef.current += 1;
          saveTurn(sessionId, {
            query: trimmed,
            turnIndex: turnIndexRef.current,
            error: error.message,
          });
        }
        handleTurnAnimationComplete();
      })
      .finally(() => {
        abortControllerRef.current = null;
      });
  }

  const currentSessionName = sessionsList.find((s) => s.id === getCurrentSessionId())?.name ?? "default";

  return (
    <box flexDirection="row" width="100%" height="100%">
      {sidebarVisible && (
        <Sidebar
          colors={colors}
          isDark={isDark}
          queryCount={queryCount}
          articleCount={articleFetchCount}
          articles={articles}
          totalTokens={totalTokens}
          currentSessionName={currentSessionName}
        />
      )}
      <box flexDirection="column" flexGrow={1} width="100%" height="100%">
        <Header currentProvider={currentProvider} colors={colors} />
        <Messages messages={messages} colors={colors} onAnimationComplete={handleTurnAnimationComplete} />
        <InputBar
          colors={colors}
          currentProvider={currentProvider}
          currentModel={currentModel}
          isProcessing={isProcessing}
          isFocused={!setupModal.visible && !sessionModal}
          onSubmit={handleSubmit}
          inputKey={inputKey}
        />
      </box>
      {setupModal.visible && setupModal.provider && (
        <SetupModal
          visible={true}
          provider={setupModal.provider}
          colors={colors}
          isDark={isDark}
          onSave={(provider, key) => {
            setCredential(provider, key);
            agentRef.current = null;
            setSetupModal({ visible: false, provider: null });
          }}
          onClose={() => setSetupModal({ visible: false, provider: null })}
        />
      )}
      {sessionModal && (
        <SessionModal
          visible={true}
          colors={colors}
          isDark={isDark}
          currentSessionId={getCurrentSessionId()}
          sessions={sessionsList}
          onSwitch={handleSessionSwitch}
          onCreate={handleSessionCreate}
          onRename={handleSessionRename}
          onDelete={handleSessionDelete}
          onClose={() => setSessionModal(false)}
        />
      )}
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
