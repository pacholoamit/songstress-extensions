import { luminance } from './color'
import { shortfalls } from './rules'
import type { ThemeVariant } from './tokens'

/*
 * What a filled look is held to before a client shows it: the background's
 * luminance by appearance, and the contrast rules (rules.ts). A theme is data
 * that reaches a client from outside its build (an extension's package on the
 * server, a link, a file), so every client checks it again before applying
 * it, and `songstress check` holds an extension's looks to the same.
 */

export interface ThemeProblem {
  /** `contrast` or `luminance`. */
  code: string
  /** Which look: its name. */
  at: string
  message: string
}

/** A dark look's background stays under this relative luminance, and a
 * light one's over LIGHT_MIN: the system bars draw light or dark glyphs by
 * the look's appearance, and must read on it. */
const DARK_MAX = 0.1
const LIGHT_MIN = 0.55

const ratio = (n: number) => `${n.toFixed(2)}:1`

/** The contrast rules a look falls short of (rules.ts), as a refusal words them. */
function contrastProblems(variant: ThemeVariant): ThemeProblem[] {
  return shortfalls(variant.colors, variant.appearance).map(({ fg, on, got, min }) => ({
    code: 'contrast',
    at: variant.name,
    message: `${fg} on ${on} is ${ratio(got)}, under ${ratio(min)}.`,
  }))
}

function luminanceProblems(variant: ThemeVariant): ThemeProblem[] {
  const lum = luminance(variant.colors.background)
  if (variant.appearance === 'dark' && lum >= DARK_MAX) {
    return [{ code: 'luminance', at: variant.name, message: `A dark theme's background is too light (${lum.toFixed(2)}).` }]
  }
  if (variant.appearance === 'light' && lum <= LIGHT_MIN) {
    return [{ code: 'luminance', at: variant.name, message: `A light theme's background is too dark (${lum.toFixed(2)}).` }]
  }
  return []
}

/** What is wrong with a filled look: nothing, for one a client may apply. */
export function checkVariant(variant: ThemeVariant): ThemeProblem[] {
  return [...luminanceProblems(variant), ...contrastProblems(variant)]
}
