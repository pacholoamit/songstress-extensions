import type { ThemeAppearance, ThemeColors, ThemeVariant } from './tokens'

/*
 * Songstress's own look as theme tokens: what a look's missing colours are
 * filled from where nothing of its own derives them, what the rules were
 * written against. Under this look the full player keeps Songstress's own
 * dark design in either appearance; a theme's look themes it.
 *
 * These are the phones' values (apps/native src/ui/theme.ts: darkPalette,
 * lightPalette, brand; the hover washes are palette.fill as tokens write
 * them, the press brand.fillPressed). `info` is the web's signal blue
 * (packages/app index.css `--color-info`) on dark, and the same hue at a
 * tone that reads on light. When the phones fill a look from this package,
 * a test there holds ui/theme.ts to these.
 */

const DARK: ThemeColors = {
  background: '#000000',
  text: '#fafafa',
  surface: '#18181b',
  sidebar: '#18181b',
  'surface.raised': '#1c1c1e',
  'surface.hover': '#ffffff14',
  border: '#27272a',
  'text.muted': '#a1a1aa',
  'text.faint': '#71717a',
  accent: '#ff464a',
  'accent.fill': '#e50043',
  'accent.fill.pressed': '#c10037',
  'accent.onFill': '#ffffff',
  success: '#4ade80',
  warning: '#fbbf24',
  danger: '#ff6369',
  info: '#77c9f3',
}

const LIGHT: ThemeColors = {
  background: '#ffffff',
  text: '#0a0a0a',
  surface: '#f2f2f7',
  sidebar: '#f2f2f7',
  'surface.raised': '#ffffff',
  'surface.hover': '#3c3c431a',
  border: '#d1d1d6',
  'text.muted': '#3c3c43',
  'text.faint': '#8e8e93',
  accent: '#e50043',
  'accent.fill': '#e50043',
  'accent.fill.pressed': '#c10037',
  'accent.onFill': '#ffffff',
  success: '#34c759',
  warning: '#ff9500',
  danger: '#d70015',
  info: '#007399',
}

/** Songstress's own looks, by appearance. */
export const SONGSTRESS: Record<ThemeAppearance, ThemeVariant> = {
  dark: { name: 'Songstress', appearance: 'dark', colors: DARK, glow: [DARK.accent] },
  light: { name: 'Songstress Light', appearance: 'light', colors: LIGHT, glow: [LIGHT.accent] },
}
