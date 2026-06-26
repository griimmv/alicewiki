import type { ThemeColors } from "../tui.tsx";
import type { ProviderName } from "../llm.ts";

interface InputBarProps {
  colors: ThemeColors;
  currentProvider: ProviderName;
  currentModel: string;
  isProcessing: boolean;
  isFocused: boolean;
  onSubmit: (value: string) => void;
  inputKey: number;
}

export function InputBar({ colors, currentProvider, currentModel, isProcessing, isFocused, onSubmit, inputKey }: InputBarProps) {
  return (
    <box borderStyle="heavy" borderColor={colors.border} paddingLeft={1} paddingRight={1} width="100%" flexDirection="column" flexShrink={0}>
      <input
        key={inputKey}
        placeholder="Type a question...  (/help for commands)"
        textColor={colors.text}
        cursorColor={colors.accent}
        onSubmit={isProcessing ? undefined : onSubmit}
        focused={isFocused}
      />
      <text fg={colors.muted}>{currentProvider} · {currentModel}</text>
    </box>
  );
}
