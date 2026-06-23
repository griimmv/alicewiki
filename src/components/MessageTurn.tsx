import { useState, useEffect, useRef } from "react";
import { TypewriterText } from "./TypewriterText.tsx";
import type { ThemeColors, Quote, Source } from "../tui.tsx";

interface TurnData {
  id: string;
  query: string;
  isProcessing?: boolean;
  summary?: string;
  quotes?: Quote[];
  sources?: Source[];
  raw?: string;
  error?: string;
}

interface MessageTurnProps {
  turn: TurnData;
  colors: ThemeColors;
}

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

function Spinner() {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setFrame((prev) => (prev + 1) % SPINNER_FRAMES.length);
    }, 80);
    return () => clearInterval(interval);
  }, []);

  return <span>{SPINNER_FRAMES[frame]}</span>;
}

export function MessageTurn({ turn, colors }: MessageTurnProps) {
  const [quotesStage, setQuotesStage] = useState(-1);
  const [sourcesStage, setSourcesStage] = useState(-1);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  function delayed(fn: () => void, ms: number) {
    setTimeout(() => {
      if (mountedRef.current) fn();
    }, ms);
  }

  function onSummaryDone() {
    if (turn.quotes && turn.quotes.length > 0) {
      delayed(() => setQuotesStage(0), 200);
    } else if (turn.sources && turn.sources.length > 0) {
      delayed(() => setSourcesStage(0), 200);
    }
  }

  function onQuoteDone(index: number) {
    const qlen = turn.quotes?.length ?? 0;
    if (index < qlen - 1) {
      delayed(() => setQuotesStage(index + 1), 200);
    } else if (turn.sources && turn.sources.length > 0) {
      delayed(() => setSourcesStage(0), 200);
    }
  }

  function onSourceDone(index: number) {
    const slen = turn.sources?.length ?? 0;
    if (index < slen - 1) {
      delayed(() => setSourcesStage(index + 1), 200);
    }
  }

  const isSpinning = turn.isProcessing;
  const hasParsed = turn.summary !== undefined;
  const hasRaw = turn.raw !== undefined;

  return (
    <box flexDirection="column" width="100%">
      {turn.query && (
        <box
          borderStyle="rounded"
          borderColor={colors.border}
          padding={1}
          width="100%"
          flexDirection="column"
          bottomTitle={isSpinning ? " Thinking " : undefined}
        >
          <text fg={colors.muted}><b>  You</b></text>
          <text fg={colors.text} selectable>  {turn.query}</text>
          {isSpinning && (
            <text fg={colors.muted}>  <Spinner /></text>
          )}
        </box>
      )}

      {turn.error && (
        <box borderStyle="single" borderColor="#ff0000" padding={1} width="100%" flexDirection="column">
          <text fg="#ff0000"><b>  ERROR</b></text>
          <text fg={colors.text} selectable>  {turn.error}</text>
        </box>
      )}

      {hasParsed && !turn.error && (
        <>
          <box borderStyle="rounded" borderColor={colors.accent} padding={1} width="100%" flexDirection="column">
            <text fg={colors.accent}><b>  SUMMARY</b></text>
            <TypewriterText text={`  ${turn.summary ?? ""}`} speed={15} onComplete={onSummaryDone} fg={colors.text} />
          </box>

          {quotesStage >= 0 && turn.quotes && turn.quotes.length > 0 && (
            <box borderStyle="single" borderColor={colors.quote} padding={1} width="100%" flexDirection="column">
              <text fg={colors.quote}><b>  DIRECT QUOTES</b></text>
              {turn.quotes.map((q, i) =>
                i <= quotesStage ? (
                  <TypewriterText
                    key={i}
                    text={`  [${i + 1}] "${q.text}"\n       \u2014 ${q.source}\n       ${q.url}`}
                    speed={10}
                    onComplete={() => onQuoteDone(i)}
                    fg={colors.text}
                  />
                ) : null
              )}
            </box>
          )}

          {sourcesStage >= 0 && turn.sources && turn.sources.length > 0 && (
            <box borderStyle="single" borderColor={colors.source} padding={1} width="100%" flexDirection="column">
              <text fg={colors.source}><b>  SOURCES</b></text>
              {turn.sources.map((s, i) =>
                i <= sourcesStage ? (
                  <TypewriterText
                    key={i}
                    text={`  [${i + 1}] ${s.title}\n       ${s.url}`}
                    speed={10}
                    onComplete={() => onSourceDone(i)}
                    fg={colors.text}
                  />
                ) : null
              )}
            </box>
          )}
        </>
      )}

      {hasRaw && !turn.error && (
        <TypewriterText text={`  ${turn.raw}`} speed={15} fg={colors.text} />
      )}
    </box>
  );
}

export type { TurnData };
