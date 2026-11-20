import { checkPlayer, checkVariant, type ThemeProblem } from './check'
import { SONGSTRESS } from './base'
import { resolveVariant } from './resolve'
import { THEME_TOKENS, type ThemeAppearance, type ThemeColors } from './tokens'

/*
 * A theme's look as an extension writes it (SPEC.md section 12 of the SDK: a
 * look's `colors`, `seed` and `glow`), held to the rules as an app holds it
 * before showing it: the look filled from Songstress's own of its
 * appearance, on the stage and on the full player's floor, which a theme's
 * look themes as it does every screen. `songstress check` runs this. What is
 * Songstress's own whatever the theme (its logo and icon, Wrapped and share
 * cards, the first run, the supporters' medals) no look reaches.
 */

/** A look as its manifest or theme file writes it, already held to the
 * schema's shape and each colour in its one form, `#rrggbb` or `#rrggbbaa`
 * (the SDK's normalizeLook, songstress/theme, makes it so): its colours hold
 * tokens by name. */
export interface WrittenLook {
  seed?: string
  colors?: object
  glow?: readonly string[]
}

/** The tokens of this version a map names. */
function tokensOf(colors: object | undefined): Partial<ThemeColors> {
  const named = (colors ?? {}) as Readonly<Record<string, unknown>>
  const out: Partial<ThemeColors> = {}
  for (const token of THEME_TOKENS) {
    const value = named[token]
    if (typeof value === 'string') out[token] = value
  }
  return out
}

/** Every problem of a look, on the stage and on the player, each problem's
 * `at` the look's appearance: `dark` or `light`. None, for a look an app shows. */
export function checkLook(appearance: ThemeAppearance, written: WrittenLook): ThemeProblem[] {
  const raw = { name: appearance, appearance, seed: written.seed, colors: tokensOf(written.colors), glow: written.glow }
  const look = resolveVariant(raw, SONGSTRESS[appearance])
  return [...checkVariant(look), ...checkPlayer(look)]
}
