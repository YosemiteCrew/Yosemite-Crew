'use strict';

export const DEFAULT_ACCENT_COLOR = '#3b87ec';
export const ACCENT_COLORS = [
  '#3b87ec',
  '#6c5ce7',
  '#e74c3c',
  '#e67e22',
  '#f39c12',
  '#27ae60',
  '#1abc9c',
  '#3498db',
  '#9b59b6',
  '#34495e',
] as const;

export type AccentColor = (typeof ACCENT_COLORS)[number];

export const isValidAccentColor = (color: string): boolean =>
  ACCENT_COLORS.includes(color as AccentColor);

export const isValidFontScale = (scale: number): boolean =>
  typeof scale === 'number' && Number.isFinite(scale) && scale >= 0.5 && scale <= 2;

export const clampFontScale = (scale: number): number =>
  Math.max(0.5, Math.min(2, Math.round(scale * 4) / 4));

export const buildThemeCss = (accentColor: string): string => {
  const validColor = isValidAccentColor(accentColor) ? accentColor : DEFAULT_ACCENT_COLOR;
  return [`:root {`, `  --yc-accent: ${validColor};`, `}`].join('\n');
};

export const applyThemeToWebContents = async (
  webContents: {
    insertCSS: (css: string) => string | Promise<string>;
    setZoomLevel: (level: number) => void;
  },
  accentColor: string,
  fontScale: number
): Promise<string | null> => {
  webContents.setZoomLevel(fontScale - 1);
  const css = buildThemeCss(accentColor);
  try {
    return await webContents.insertCSS(css);
  } catch {
    return null;
  }
};

/*
 * The background Electron paints while a local page is still loading.
 *
 * Preferences and the Document Vault were created with Electron's default
 * white, so on a dark theme the window showed a white rectangle for the frames
 * before the page painted (issue #3298). The value has to match what the page
 * itself paints, which is `--screen` in `src/pages/tokens.css`;
 * tests/theming.test.ts reads that file and fails if the two drift apart.
 */
export const LOCAL_PAGE_BACKGROUND = {
  light: '#f7f3ec',
  dark: '#2f271e',
} as const;

export const localPageBackgroundColor = (prefersDark: boolean): string =>
  prefersDark ? LOCAL_PAGE_BACKGROUND.dark : LOCAL_PAGE_BACKGROUND.light;
