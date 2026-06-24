import type { ThemeColors } from "../tui.tsx";
import type { ProviderName } from "../llm.ts";

interface HeaderProps {
  currentProvider: ProviderName;
  colors: ThemeColors;
}

const PAGGA_ART = [
  "░█▀█░█░░░▀█▀░█▀▀░█▀▀░█░█░▀█▀░█░█░▀█▀░",
  "░█▀█░█░░░░█░░█░░░█▀▀░█▄█░░█░░█▀▄░░█░░",
  "░▀░▀░▀▀▀░▀▀▀░▀▀▀░▀▀▀░▀░▀░▀▀▀░▀░▀░▀▀▀░",
];

export function Header({ currentProvider, colors }: HeaderProps) {
  return (
    <box borderStyle="heavy" borderColor={colors.border} paddingLeft={1} width="100%" flexShrink={0}>
      <text fg={colors.accent}>
        <b>
          {PAGGA_ART[0]}{"\n"}
          {PAGGA_ART[1]}  Current provider: {currentProvider}{"\n"}
          {PAGGA_ART[2]}
        </b>
      </text>
    </box>
  );
}
