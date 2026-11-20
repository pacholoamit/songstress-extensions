// songstress/theme: a theme's colours as the apps and every check read them
// (SPEC.md, section 12). One reader of a colour for all of them: the apps'
// theme engine, `songstress check` and the manifest's validator. It needs
// nothing but JavaScript and carries no schema, so an app imports it.

export { MAX_COLOR_LENGTH, normalizeColor, parseColor } from './theme/color'
export type { ParsedColor } from './theme/color'
export { normalizeLook } from './theme/look'
export { THEME_TOKENS, TRANSLUCENT_TOKENS } from './theme/tokens'
export type { ThemeToken } from './theme/tokens'
export type { ThemeColors, ThemeLook } from './manifest/types.generated'
