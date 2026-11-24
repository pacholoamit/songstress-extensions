// A theme's look in the one form the apps' engine reads (SPEC.md, section
// 12): every colour as `#rrggbb`, or `#rrggbbaa` for a translucent token.

import type { ThemeColors, ThemeLook } from '../manifest/types.generated'
import { colorFault, normalizeColor } from './color'
import { THEME_TOKENS, TRANSLUCENT_TOKENS, type ThemeToken } from './tokens'

const TRANSLUCENT: ReadonlySet<string> = new Set(TRANSLUCENT_TOKENS)

/** At most this many glow colours. */
const MAX_GLOW = 3

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** A colour in its one form where its place may hold it; nothing otherwise. */
function standing(value: unknown, translucent: boolean): string | undefined {
  if (typeof value !== 'string' || colorFault(value, translucent) !== undefined) return undefined
  return normalizeColor(value)
}

function colorsOf(value: unknown): ThemeColors | undefined {
  if (!isRecord(value)) return undefined
  const colors: Partial<Record<ThemeToken, string>> = {}
  for (const token of THEME_TOKENS) {
    const color = standing(value[token], TRANSLUCENT.has(token))
    if (color !== undefined) colors[token] = color
  }
  return Object.keys(colors).length > 0 ? colors : undefined
}

/** A look with each colour in its one form, `#rrggbb` or `#rrggbbaa`, and nothing a look may not hold: a value
 * that is not one of a theme's colours, a translucent one where its place is opaque, a token this version does
 * not name, glow past the third. What is left out an app fills in, as it fills any token a look leaves out.
 * Nothing, for a value with no colour left in it. A look that passed `songstress/manifest`'s checks loses
 * nothing here: it only changes form.
 * @param look - A look as a theme file holds it.
 * @returns The look in its one form, or undefined.
 * @example
 * ```ts
 * import { normalizeLook } from 'songstress/theme'
 *
 * declare const look: unknown // a look as a theme file holds it
 *
 * const normal = normalizeLook(look)
 * console.log(normal?.colors?.background) // '#rrggbb', whatever form the file wrote
 * ```
 */
export function normalizeLook(look: unknown): ThemeLook | undefined {
  if (!isRecord(look)) return undefined
  const out: ThemeLook = {}
  const seed = standing(look.seed, false)
  if (seed !== undefined) out.seed = seed
  const colors = colorsOf(look.colors)
  if (colors !== undefined) out.colors = colors
  const glow = (Array.isArray(look.glow) ? look.glow : []).map((color) => standing(color, false)).filter((color) => color !== undefined)
  if (glow.length > 0) out.glow = glow.slice(0, MAX_GLOW)
  return Object.keys(out).length > 0 ? out : undefined
}
