import type { ThemeColors } from "../tui.tsx";
import type { ProviderName } from "../llm.ts";

const PROVIDER_INFO: Record<ProviderName, { name: string; url: string; placeholder: string }> = {
  openai: { name: "OpenAI", url: "https://platform.openai.com/api-keys", placeholder: "sk-..." },
  anthropic: { name: "Anthropic", url: "https://console.anthropic.com/", placeholder: "sk-ant-..." },
  google: { name: "Google AI", url: "https://aistudio.google.com/apikey", placeholder: "AIza..." },
};

interface SetupModalProps {
  visible: boolean;
  provider: ProviderName;
  colors: ThemeColors;
  onSave: (provider: ProviderName, key: string) => void;
  onClose: () => void;
}

export function SetupModal({ visible, provider, colors, onSave, onClose }: SetupModalProps) {
  if (!visible) return null;

  const info = PROVIDER_INFO[provider];

  return (
    <>
      <box position="absolute" top={0} left={0} right={0} bottom={0} width="100%" height="100%" backgroundColor="rgba(0,0,0,0.6)" />
      <box position="absolute" top={4} left={4} width={60} borderStyle="single" borderColor={colors.accent} padding={2} flexDirection="column">
        <text fg={colors.accent}><b>  Set {info.name} API Key</b></text>
        <box height={1} />
        <text fg={colors.text}>  Get your API key from:</text>
        <text fg={colors.source} selectable>  {info.url}</text>
        <box height={1} />
        <text fg={colors.muted}>  Paste your key below and press Enter.</text>
        <text fg={colors.muted}>  Press Escape to cancel.</text>
        <box height={1} />
        <input
          placeholder={info.placeholder}
          textColor={colors.text}
          cursorColor={colors.accent}
          focused={true}
          onSubmit={(value) => {
            const trimmed = value.trim();
            if (trimmed) {
              onSave(provider, trimmed);
            }
          }}
        />
        <box height={1} />
        <text fg={colors.muted}>  This key will be stored in ~/.alicewiki/alicewiki.db</text>
      </box>
    </>
  );
}
