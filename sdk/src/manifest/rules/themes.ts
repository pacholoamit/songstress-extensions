// THEME_LOOKS: a theme holds exactly the looks its appearance names, a dark
// one, a light one or both, written in the manifest or in its theme file and
// never in both. THEME_COLOR and THEME_COLOR_ALPHA: each colour a look writes
// is one of a theme's forms (songstress/theme's parseColor), and only border
// and surface.hover are translucent. A theme file's own looks are held to the
// same when the file is read (themes.ts beside validate.ts); these rules see
// the manifest alone.

import { colorFault } from '../../theme/color'
import { TRANSLUCENT_TOKENS } from '../../theme/tokens'
import type { Report } from '../codes'
import { child, pointerOf } from '../pointer'
import type { Theme, ThemeLook } from '../types.generated'
import type { Rule } from './rule'

/** One of a theme's two looks. */
export type Look = 'dark' | 'light'

const LOOKS: readonly Look[] = ['dark', 'light']

/** The looks a theme's appearance names. */
function named(appearance: Theme['appearance']): readonly Look[] {
  return appearance === 'both' ? LOOKS : [appearance]
}

/** Holds the looks a theme or its file holds (`has`) to those its appearance
 * names. A look it lacks is reported at `at`, and one it should not have at
 * that look's own pointer under `at`. `where` ends the sentence: where the
 * missing look belongs. */
export function holdLooks(appearance: Theme['appearance'], has: (look: Look) => boolean, at: string, where: string, report: Report): void {
  const wanted = named(appearance)
  for (const look of LOOKS) {
    if (wanted.includes(look) && !has(look)) {
      report('THEME_LOOKS', at, `The theme's appearance is "${appearance}": it needs its ${look} look ${where}.`)
    }
    if (!wanted.includes(look) && has(look)) {
      report('THEME_LOOKS', child(at, look), `A theme whose appearance is "${appearance}" has no ${look} look.`)
    }
  }
}

/** A theme whose looks are in its file writes none here. */
function filed(theme: Theme, at: string, report: Report): void {
  for (const look of LOOKS) {
    if (theme[look] === undefined) continue
    report('THEME_LOOKS', child(at, look), `The theme's looks are in "${theme.path}": write them there or here, not in both.`)
  }
}

const TRANSLUCENT: ReadonlySet<string> = new Set(TRANSLUCENT_TOKENS)

/** One colour of a look, held to its place: `what` names the place in the sentence. */
function holdColor(value: string, translucent: boolean, at: string, what: string, report: Report): void {
  const fault = colorFault(value, translucent)
  if (fault === 'form') {
    report(
      'THEME_COLOR',
      at,
      `${JSON.stringify(value)} is not a colour a theme can write: write #RGB, #RGBA, #RRGGBB or #RRGGBBAA, or rgb(), rgba(), hsl() or hsla(), each part in its range.`,
    )
  }
  if (fault === 'translucent') report('THEME_COLOR_ALPHA', at, `${what} is translucent: only border and surface.hover may be.`)
}

/** Holds every colour of a look (at `at`) to THEME_COLOR and THEME_COLOR_ALPHA. */
export function holdColors(look: ThemeLook | undefined, at: string, report: Report): void {
  if (look === undefined) return
  if (look.seed !== undefined) holdColor(look.seed, false, child(at, 'seed'), 'The seed', report)
  for (const [index, color] of (look.glow ?? []).entries()) holdColor(color, false, child(child(at, 'glow'), index), 'A glow colour', report)
  for (const [token, color] of Object.entries(look.colors ?? {})) {
    if (color !== undefined) holdColor(color, TRANSLUCENT.has(token), child(child(at, 'colors'), token), JSON.stringify(token), report)
  }
}

export const themeColors: Rule = (manifest, report) => {
  for (const [i, theme] of (manifest.contributes?.themes ?? []).entries()) {
    const at = pointerOf('contributes', 'themes', i)
    for (const look of LOOKS) holdColors(theme[look], child(at, look), report)
  }
}

export const themeLooks: Rule = (manifest, report) => {
  for (const [i, theme] of (manifest.contributes?.themes ?? []).entries()) {
    const at = pointerOf('contributes', 'themes', i)
    if (theme.path === undefined) holdLooks(theme.appearance, (look) => theme[look] !== undefined, at, 'here, or a path to its theme file', report)
    else filed(theme, at, report)
  }
}
