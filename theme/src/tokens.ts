/*
 * The theme format's colour tokens, version 1: SPEC.md section 12 of the SDK
 * (packages/extensions), whose schema/theme.v1.json names the same tokens (a
 * test there holds the two lists together). Within version 1 a token is only
 * ever added, with a default that follows from the others, and never renamed.
 */

/** The colour tokens, in the order a missing one is filled (resolve.ts): each
 * colour's grounds come before it. */
export const THEME_TOKENS = [
  'background',
  'text',
  'surface',
  'sidebar',
  'surface.raised',
  'surface.hover',
  'border',
  'text.muted',
  'text.faint',
  'accent',
  'accent.fill',
  'accent.fill.pressed',
  'accent.onFill',
  'success',
  'warning',
  'danger',
  'info',
] as const

export type ThemeToken = (typeof THEME_TOKENS)[number]
export type ThemeAppearance = 'dark' | 'light'
export type ThemeColors = Record<ThemeToken, string>

/** A look with every token filled: what a client applies. */
export interface ThemeVariant {
  name: string
  appearance: ThemeAppearance
  colors: ThemeColors
  /** Up to three colours for the web's ambient backdrop. */
  glow: readonly string[]
}

/** A look as it was written: any token may be missing. */
export interface RawVariant {
  name: string
  appearance: ThemeAppearance
  /** One colour the look grows from where it names no other: the accent, and
   * a stage and a text colour tinted with its hue (seed.ts). */
  seed?: string
  colors: Partial<ThemeColors>
  glow?: readonly string[]
}
