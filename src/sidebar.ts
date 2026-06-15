import {
  type RenderContext,
  TextRenderable,
  BoxRenderable,
  ScrollBoxRenderable,
  TextAttributes,
  t,
} from "@opentui/core";

interface ThemeColors {
  text: string;
  muted: string;
  accent: string;
  success: string;
  border: string;
}

export class Sidebar {
  private container: BoxRenderable;
  private providerText: TextRenderable;
  private statsText: TextRenderable;
  private articleText: TextRenderable;
  private historyBox: ScrollBoxRenderable;
  private ctx: RenderContext;
  private colors: ThemeColors;
  private _visible: boolean = true;

  constructor(ctx: RenderContext, colors: ThemeColors, isDark: boolean) {
    this.ctx = ctx;
    this.colors = colors;
    const sidebarBg = isDark ? "#24283b" : "#d5d6db";

    const label = (text: string) => new TextRenderable(ctx, {
      content: ` ${text}`,
      fg: colors.muted,
      attributes: TextAttributes.BOLD,
    });

    const spacer = () => new TextRenderable(ctx, {
      content: " ",
      fg: colors.text,
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

    const providerLabel = label("PROVIDER");
    this.providerText = new TextRenderable(ctx, {
      content: t` openai`,
      fg: colors.accent,
    });

    const statsLabel = label("SESSION STATS");
    this.statsText = new TextRenderable(ctx, {
      content: t` Queries: 0  ·  Articles: 0`,
      fg: colors.text,
    });

    const articleLabel = label("CURRENT ARTICLE");
    this.articleText = new TextRenderable(ctx, {
      content: " \u2014",
      fg: colors.text,
    });

    const historyLabel = label("SEARCH HISTORY");
    this.historyBox = new ScrollBoxRenderable(ctx, {
      flexGrow: 1,
      scrollY: true,
      viewportCulling: true,
    });

    this.container = new BoxRenderable(ctx, {
      borderStyle: "single",
      borderColor: colors.border,
      backgroundColor: sidebarBg,
      paddingLeft: 1,
      paddingRight: 1,
      width: 30,
      flexDirection: "column",
      flexShrink: 0,
    });

    this.container.add(titleText);
    this.container.add(separator);
    this.container.add(spacer());
    this.container.add(providerLabel);
    this.container.add(this.providerText);
    this.container.add(spacer());
    this.container.add(statsLabel);
    this.container.add(this.statsText);
    this.container.add(spacer());
    this.container.add(articleLabel);
    this.container.add(this.articleText);
    this.container.add(spacer());
    this.container.add(historyLabel);
    this.container.add(this.historyBox);
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

  setProvider(name: string) {
    this.providerText.content = t` ${name}`;
  }

  updateStats(queries: number, articles: number) {
    this.statsText.content = t` Queries: ${queries}  ·  Articles: ${articles}`;
  }

  setCurrentArticle(title: string | null) {
    if (title) {
      const truncated = title.length > 26 ? title.slice(0, 26) + "\u2026" : title;
      this.articleText.content = t` ${truncated}`;
    } else {
      this.articleText.content = " \u2014";
    }
  }

  addHistoryEntry(title: string) {
    const display = title.length > 26 ? title.slice(0, 26) + "\u2026" : title;
    const entry = new TextRenderable(this.ctx, {
      content: t` ${display}`,
      fg: this.colors.text,
    });
    this.historyBox.add(entry);
  }
}
