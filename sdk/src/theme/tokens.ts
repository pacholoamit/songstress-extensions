// The colour tokens a theme's look may set (SPEC.md, section 12), in the
// schema's order. They are written here rather than read from the schema so
// that songstress/theme carries no schema into an app; a test holds them to
// the schema's themeColors and to the apps' engine (@songstress/theme).

import type { ThemeColors } from '../manifest/types.generated'

export const THEME_TOKENS = [
  'background',
  'surface',
  'surface.raised',
  'surface.hover',
  'sidebar',
  'border',
  'text',
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
] as const satisfies readonly (keyof ThemeColors)[]

/** A colour token a theme's look may set. */
export type ThemeToken = (typeof THEME_TOKENS)[number]

/** The tokens that may be translucent: every other colour of a theme is opaque. */
export const TRANSLUCENT_TOKENS = ['surface.hover', 'border'] as const satisfies readonly ThemeToken[]
