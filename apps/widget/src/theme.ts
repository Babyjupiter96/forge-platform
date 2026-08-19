import type { ThemeTokens } from "@forge/shared";
import type { CSSProperties } from "react";

// Matches the Forge Digital brand tokens seeded in packages/db/prisma/seed.ts —
// used only until the real `/api/widget-config` response arrives, so the
// widget never flashes an unstyled or wrong-brand state.
export const DEFAULT_THEME: ThemeTokens = {
  bg: "#060606",
  panel: "#0E0E0E",
  panelAlt: "#131313",
  ink: "#EDEFF4",
  inkSoft: "#B7BCC8",
  muted: "#7B8394",
  accent: "#C1443A",
  steel: "#8FB3D4",
  rule: "rgba(143,179,212,0.16)",
  ruleStrong: "rgba(193,68,58,0.35)",
  fontHeadline: "'Cormorant Garamond', Georgia, serif",
  fontLabel: "'Cinzel', serif",
  fontBody: "'Jost', sans-serif",
};

export function themeToCssVars(theme: ThemeTokens): CSSProperties {
  return {
    "--fw-bg": theme.bg,
    "--fw-panel": theme.panel,
    "--fw-panel-alt": theme.panelAlt,
    "--fw-ink": theme.ink,
    "--fw-ink-soft": theme.inkSoft,
    "--fw-muted": theme.muted,
    "--fw-accent": theme.accent,
    "--fw-steel": theme.steel,
    "--fw-rule": theme.rule,
    "--fw-rule-strong": theme.ruleStrong,
    "--fw-font-headline": theme.fontHeadline,
    "--fw-font-label": theme.fontLabel,
    "--fw-font-body": theme.fontBody,
  } as CSSProperties;
}
