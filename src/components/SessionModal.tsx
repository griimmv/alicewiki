import { RGBA } from "@opentui/core";
import { useKeyboard } from "@opentui/react";
import { useState, useRef, useEffect } from "react";
import type { ThemeColors } from "../tui.tsx";
import type { SessionInfo } from "../db.ts";

interface SessionModalProps {
  visible: boolean;
  colors: ThemeColors;
  isDark: boolean;
  currentSessionId: number | null;
  sessions: SessionInfo[];
  onSwitch: (id: number) => void;
  onCreate: (name: string) => void;
  onRename: (id: number, name: string) => void;
  onDelete: (id: number) => void;
  onClose: () => void;
}

type Mode = "list" | "new" | "rename" | "deleteConfirm";

export function SessionModal({ visible, colors, isDark, currentSessionId, sessions, onSwitch, onCreate, onRename, onDelete, onClose }: SessionModalProps) {
  const [mode, setMode] = useState<Mode>("list");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [inputValue, setInputValue] = useState("");

  const inputValueRef = useRef(inputValue);
  inputValueRef.current = inputValue;
  const selectedIndexRef = useRef(selectedIndex);
  selectedIndexRef.current = selectedIndex;
  const sessionsRef = useRef(sessions);
  sessionsRef.current = sessions;
  const modeRef = useRef(mode);
  modeRef.current = mode;

  useEffect(() => {
    if (visible) {
      setMode("list");
      setSelectedIndex(0);
      setInputValue("");
    }
  }, [visible]);

  useEffect(() => {
    if (selectedIndex >= sessions.length) {
      setSelectedIndex(Math.max(0, sessions.length - 1));
    }
  }, [sessions.length, selectedIndex]);

  useKeyboard((key) => {
    const m = modeRef.current;

    if (m === "list") {
      if (key.name === "up") {
        setSelectedIndex((i) => Math.max(0, i - 1));
        return;
      }
      if (key.name === "down") {
        setSelectedIndex((i) => Math.min(sessionsRef.current.length - 1, i + 1));
        return;
      }
      if (key.name === "enter" || key.name === "return") {
        const idx = selectedIndexRef.current;
        if (idx >= 0 && idx < sessionsRef.current.length) {
          onSwitch(sessionsRef.current[idx].id);
        }
        return;
      }
      if (key.sequence === "n") {
        setMode("new");
        setInputValue("");
        return;
      }
      if (key.sequence === "r") {
        const idx = selectedIndexRef.current;
        if (idx >= 0 && idx < sessionsRef.current.length) {
          setInputValue(sessionsRef.current[idx].name);
          setMode("rename");
        }
        return;
      }
      if (key.sequence === "d") {
        const idx = selectedIndexRef.current;
        if (idx >= 0 && idx < sessionsRef.current.length && sessionsRef.current.length > 1) {
          setMode("deleteConfirm");
        }
        return;
      }
      if (key.name === "escape") {
        onClose();
        return;
      }
      return;
    }

    if (m === "new" || m === "rename") {
      if (key.name === "enter" || key.name === "return") {
        const name = inputValueRef.current.trim();
        if (name) {
          if (m === "new") {
            onCreate(name);
          } else {
            const idx = selectedIndexRef.current;
            if (idx >= 0 && idx < sessionsRef.current.length) {
              onRename(sessionsRef.current[idx].id, name);
            }
          }
        }
        setMode("list");
        return;
      }
      if (key.name === "escape") {
        setMode("list");
        return;
      }
      if (key.name === "backspace") {
        setInputValue((v) => v.slice(0, -1));
        return;
      }
      if (key.sequence && key.sequence.length === 1) {
        setInputValue((v) => v + key.sequence);
        return;
      }
      return;
    }

    if (m === "deleteConfirm") {
      if (key.sequence === "y") {
        const idx = selectedIndexRef.current;
        if (idx >= 0 && idx < sessionsRef.current.length) {
          onDelete(sessionsRef.current[idx].id);
        }
        setMode("list");
        return;
      }
      if (key.sequence === "n" || key.name === "escape") {
        setMode("list");
        return;
      }
      return;
    }
  });

  if (!visible) return null;

  const modalBg = isDark ? "#1a1b26" : "#ffffff";
  const selBg = isDark ? "#3b4261" : "#c8ccd4";

  return (
    <box position="absolute" top={0} left={0} right={0} bottom={0} width="100%" height="100%" flexDirection="column" justifyContent="center" alignItems="center">
      <box position="absolute" top={0} left={0} right={0} bottom={0} width="100%" height="100%" backgroundColor={RGBA.fromValues(0, 0, 0, 0.6)} />
      <box width={70} maxHeight="80%" borderStyle="single" borderColor={colors.accent} padding={1} flexDirection="column" backgroundColor={modalBg}>
        <text fg={colors.accent}><b>  SESSIONS</b></text>
        <text fg={colors.muted}>  {"\u2500".repeat(64)}</text>
        <box height={1} />

        <scrollbox flexGrow={1} viewportCulling paddingLeft={1} paddingRight={1}>
          {sessions.length === 0 ? (
            <text fg={colors.muted}>  No sessions yet.</text>
          ) : (
            sessions.map((s, i) => {
              const isActive = s.id === currentSessionId;
              const isSel = i === selectedIndex && mode === "list";
              const prefix = isActive ? "\u25b6" : " ";
              const date = s.createdAt.slice(0, 10);
              const label = `${s.provider} \u00b7 ${s.turnCount} turns \u00b7 ${date}`;
              const rowFg = isActive ? colors.accent : isSel ? colors.text : colors.muted;

              return (
                <box key={s.id} flexDirection="row" width="100%" backgroundColor={isSel ? selBg : undefined}>
                  <text fg={rowFg}>
                    {prefix} {isActive ? <b>{s.name}</b> : s.name}
                  </text>
                  <box flexGrow={1} />
                  <text fg={colors.muted}>{label}</text>
                </box>
              );
            })
          )}
        </scrollbox>

        <text fg={colors.muted}>  {"\u2500".repeat(64)}</text>
        <box height={1} />

        {mode === "new" && (
          <box flexDirection="row">
            <text fg={colors.accent}>  New session name: </text>
            <text fg={colors.text}>{inputValue || "\u2588"}</text>
          </box>
        )}
        {mode === "rename" && (
          <box flexDirection="row">
            <text fg={colors.accent}>  Rename to: </text>
            <text fg={colors.text}>{inputValue || "\u2588"}</text>
          </box>
        )}
        {mode === "deleteConfirm" && (
          <text fg="#ff0000">  Delete session "{sessions[selectedIndex]?.name ?? ""}"? (y/n)</text>
        )}
        {mode === "list" && (
          <text fg={colors.muted}>  Enter: switch  n: new  r: rename  d: delete  Esc: close</text>
        )}
      </box>
    </box>
  );
}
