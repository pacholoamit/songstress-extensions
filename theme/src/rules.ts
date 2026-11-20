import { contrast, mix } from './color'
import type { ThemeAppearance, ThemeColors, ThemeToken } from './tokens'

/*
 * The contrast a theme is held to, as data: the validator refuses a variant
 * that falls short (validate.ts), and the resolver moves a colour it filled
 * in itself until it does not (resolve.ts). One list, so the two never
 * disagree about what passes.
 *
 * WCAG 2.2 names two levels: 4.5:1 for words that are read (1.4.3) and 3:1
 * for an interface part or a glyph (1.4.11).
 * - Words: `text`, `text.muted`, the label on a filled accent (on its
 *   pressed fill too, `accent.fill.pressed`),
 *   `danger` (Delete, Sign Out), and the status colours, which draw short
 *   captions as well as dots.
 * - Parts: `text.faint` (placeholders, chevrons, captions that repeat what is
 *   said beside them).
 * - A filled accent is held to its label alone. Its shape against the stage
 *   is not a rule here (a button whose label reads is a button), but the
 *   resolver never derives a fill that is lost in the stage (resolve.ts).
 * - `accent` is words on the background and a part on a surface: a client
 *   turns an accent label there to the text colour while the accent is under
 *   4.5:1, and the accent then draws the glyph alone (the phones'
 *   `brand.tintOnSurface`, as Songstress Red does on its light grouped grey).
 *
 * A light variant is held to less in three places, and they are measured, not
 * chosen: iOS's own light palette, which Songstress Light is. System green
 * gives 2.22:1 on white and 1.99:1 on the grouped grey, system orange 2.20:1
 * and 1.97:1, system grey 2.92:1 on the grouped grey. WCAG 2's ratio rates a
 * saturated mid-tone on a light ground low, and a rule above these figures
 * would refuse the look the phones ship. Light variants show on iOS alone.
 */

const WORDS = 4.5
/** WCAG's least for an interface part or a glyph. */
export const PARTS = 3
const LIGHT_FAINT_ON_SURFACE = 2.9
const LIGHT_STATUS = 1.9

/** How far a filled accent darkens when pressed (the phone's #e50043 to #c10037). */
const PRESSED_SHADE = 0.16

/** A filled accent as it shows under a press, where a look names no
 * `accent.fill.pressed` of its own. */
export const pressedFill = (fill: string): string => mix(fill, '#000000', PRESSED_SHADE)

interface Rule {
  fg: ThemeToken
  on: readonly ThemeToken[]
  min: number
  /** The least a light variant is held to, where that is less. */
  light?: number
}

const STAGE: readonly ThemeToken[] = ['background', 'surface']
const RULES: readonly Rule[] = [
  { fg: 'text', on: ['background', 'surface', 'surface.raised', 'sidebar'], min: WORDS },
  { fg: 'text.muted', on: STAGE, min: WORDS },
  { fg: 'text.faint', on: ['background'], min: PARTS },
  { fg: 'text.faint', on: ['surface'], min: PARTS, light: LIGHT_FAINT_ON_SURFACE },
  { fg: 'accent', on: ['background'], min: WORDS },
  { fg: 'accent', on: ['surface'], min: PARTS },
  { fg: 'success', on: STAGE, min: WORDS, light: LIGHT_STATUS },
  { fg: 'warning', on: STAGE, min: WORDS, light: LIGHT_STATUS },
  { fg: 'danger', on: STAGE, min: WORDS },
  { fg: 'info', on: STAGE, min: WORDS },
  { fg: 'accent.onFill', on: ['accent.fill', 'accent.fill.pressed'], min: WORDS },
]

/** One pair that falls short: `fg` on `on` reaches `got`, under `min`. */
export interface Shortfall {
  fg: ThemeToken
  on: ThemeToken
  got: number
  min: number
}

/**
 * Where a variant's colours fall short of the rules: nothing, for one a
 * client may show. With `only`, the rules of that one colour.
 */
export function shortfalls(colors: ThemeColors, appearance: ThemeAppearance, only?: ThemeToken): Shortfall[] {
  const found: Shortfall[] = []
  for (const rule of RULES) {
    if (only && rule.fg !== only) continue
    const min = appearance === 'light' ? (rule.light ?? rule.min) : rule.min
    for (const on of rule.on) {
      const got = contrast(colors[rule.fg], colors[on])
      if (got < min) found.push({ fg: rule.fg, on, got, min })
    }
  }
  return found
}
