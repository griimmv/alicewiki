import type { ThemeColors } from "../tui.tsx";

interface SidebarProps {
  colors: ThemeColors;
  isDark: boolean;
  queryCount: number;
  articleCount: number;
  articles: string[];
}

export function Sidebar({ colors, isDark, queryCount, articleCount, articles }: SidebarProps) {
  const sidebarBg = isDark ? "#24283b" : "#d5d6db";

  return (
    <box
      borderStyle="single"
      borderColor={colors.border}
      backgroundColor={sidebarBg}
      paddingLeft={1}
      paddingRight={1}
      paddingTop={1}
      paddingBottom={1}
      width={30}
      flexDirection="column"
      flexShrink={0}
    >
      <text fg={colors.accent}><b> ALICEWIKI</b></text>
      <text fg={colors.muted}> {"─".repeat(26)}</text>
      <box height={1} width="100%" />
      <box flexDirection="column" width="100%" flexShrink={0}>
        <text fg={colors.muted}><b> SESSION STATS</b></text>
        <text fg={colors.text}> Queries: {queryCount}</text>
        <text fg={colors.text}> Articles: {articleCount}</text>
      </box>
      <box height={1} width="100%" />
      <box height={1} width="100%" />
      <text fg={colors.muted}><b> FETCHED ARTICLES</b></text>
      <scrollbox flexGrow={1} scrollY viewportCulling>
        {articles.map((title, i) => {
          const display = title.length > 26 ? title.slice(0, 26) + "\u2026" : title;
          return <text key={i} fg={colors.text}> {display}</text>;
        })}
      </scrollbox>
      <box height={1} width="100%" />
      <box flexDirection="column" width="100%" flexShrink={0}>
        <text fg={colors.text}> Ctrl+B to hide sidebar</text>
        <text fg={colors.text}> Alt+D to focus input bar</text>
        <text fg={colors.text}> Ctrl+C to quit</text>
        <text fg={colors.text}> Ctrl+click to open links</text>
      </box>
    </box>
  );
}
