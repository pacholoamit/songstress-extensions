import { contrast, mix, withAlpha } from './color'
import { PARTS, pressedFill, shortfalls } from './rules'
import { apart, nearestTone, seedRoots } from './seed'
import {
  THEME_TOKENS,
  type RawVariant,
  type ThemeAppearance,
  type ThemeColors,
  type ThemeToken,
  type ThemeVariant,
} from './tokens'

/*
 * Fills what a variant's file left out. A token comes from, in order: the
 * file; a colour derived from the file's own (its seed, or a sibling token);
 * the base theme of the same appearance. So a file of one colour is a whole
 * theme, and a file written before a token existed keeps working.
 *
 * A colour is derived only from one the file gave or one derived from those:
 * a file that names no background keeps the base's surfaces untouched. The
 * second colour of a mix may be the base's.
 *
 * A seed stands for three colours (seed.ts): the accent, and a stage and a
 * text colour tinted with its hue. A colour the file wrote wins over each.
 *
 * A filled accent starts from the accent as the file wrote it (its `accent`,
 * else its seed), not from the accent as it was fitted to the stage: a yellow
 * that had to darken to read as a label on a light stage still fills a
 * button as yellow, under a dark label. It moves only where no label reads on
 * it, at rest or under its press, or where it would be lost in the stage (a
 * navy seed on a dark stage): it must be seen on the background and the
 * surface, by its tone (3:1, a part's rule) or, where the tones are near, by
 * its colour, as the yellow is on white. That is the resolver's own care: a
 * fill the file writes is held to its label alone (rules.ts).
 *
 * Its press (`accent.fill.pressed`) is the fill 16% toward black where the
 * file names none (rules.ts), moved, like any colour filled in, until a label
 * reads on it.
 *
 * What the resolver filled in itself it also fits to the contrast rules
 * (rules.ts): a quieter text, an accent, a filled accent or a status colour
 * the file did not name moves to its nearest tone that passes on the stage
 * the file did name. A colour the file wrote is never moved: where it fails,
 * the validator refuses the variant and says so.
 */

type Own = Partial<ThemeColors>
type Derive = (own: Own, base: ThemeColors) => string | undefined

/** The two labels a filled accent may carry where its file names none. */
const LABELS = ['#ffffff', '#0a0a0a'] as const

/** How a label reads on a fill at its worst: at rest, or under a press. */
const labelContrast = (label: string, fill: string, pressed: string) => Math.min(contrast(label, fill), contrast(label, pressed))

/** How far apart in colour (seed.ts's `apart`) a fill whose tone is near
 * the stage's must be to be seen there: about the tone gap that gives 3:1. */
const COLOUR_APART = 40

/** Whether a fill is seen on a ground: by its tone, or by its colour. */
const seenOn = (fill: string, ground: string) => contrast(fill, ground) >= PARTS || apart(fill, ground) >= COLOUR_APART

/** Whichever label reads best on `fill` at its worst, `pressed` its press. */
const labelOn = (fill: string, pressed: string): string =>
  labelContrast(LABELS[0], fill, pressed) >= labelContrast(LABELS[1], fill, pressed) ? LABELS[0] : LABELS[1]

/** A fill's press: the look's own, else the fill darkened (rules.ts). */
const pressOf = (own: Own, fill: string): string => own['accent.fill.pressed'] ?? pressedFill(fill)

/** A token's colour from the file's own colours, or undefined. */
const DERIVE: Partial<Record<ThemeToken, Derive>> = {
  surface: (own, base) => own.background && mix(own.background, own.text ?? base.text, 0.08),
  sidebar: (own) => own.surface,
  'surface.raised': (own, base) => own.surface && mix(own.surface, own.text ?? base.text, 0.06),
  'surface.hover': (own) => own.text && withAlpha(own.text, 0.08),
  border: (own, base) => own.surface && mix(own.surface, own.text ?? base.text, 0.12),
  'text.muted': (own, base) => own.text && mix(own.text, own.background ?? base.background, 0.3),
  'text.faint': (own, base) => own.text && mix(own.text, own.background ?? base.background, 0.5),
  'accent.fill.pressed': (own) => own['accent.fill'] && pressedFill(own['accent.fill']),
  'accent.onFill': (own) => own['accent.fill'] && labelOn(own['accent.fill'], pressOf(own, own['accent.fill'])),
}

/** The stage and the text on it are never moved: they are what the rest is
 * fitted to, and each is the file's, a seed's (whose tones pass by
 * themselves) or the base's. */
const FIXED: ReadonlySet<ThemeToken> = new Set<ThemeToken>([
  'background',
  'text',
  'surface',
  'sidebar',
  'surface.raised',
  'surface.hover',
  'border',
])

/** A colour the resolver filled in, moved to its nearest tone that passes
 * the rules on the colours resolved before it (THEME_TOKENS' order puts a
 * colour's grounds first). */
function fitted(token: ThemeToken, color: string, colors: ThemeColors, named: Own, appearance: ThemeAppearance): string {
  if (FIXED.has(token)) return color
  const passes = (at: ThemeToken, value: Own) => shortfalls({ ...colors, ...value }, appearance, at).length === 0
  const labels = named['accent.onFill'] ? [named['accent.onFill']] : LABELS
  const labelled = (value: Own) => labels.some((label) => passes('accent.onFill', { ...value, 'accent.onFill': label }))
  if (token === 'accent.fill') {
    // A fill passes where it is seen on the stage and a label reads on it, at rest and under its press.
    const seen = (fill: string) => seenOn(fill, colors.background) && seenOn(fill, colors.surface)
    const pressed = (fill: string) => named['accent.fill.pressed'] ?? pressedFill(fill)
    return nearestTone(color, (candidate) => seen(candidate) && labelled({ 'accent.fill': candidate, 'accent.fill.pressed': pressed(candidate) }))
  }
  // A press passes where a label reads on it (and on the fill it presses).
  if (token === 'accent.fill.pressed') return nearestTone(color, (candidate) => labelled({ 'accent.fill.pressed': candidate }))
  return nearestTone(color, (candidate) => passes(token, { [token]: candidate }))
}

/** The variant with every token filled (see above). `base` is the client's
 * own theme of the same appearance. */
export function resolveVariant(raw: RawVariant, base: ThemeVariant): ThemeVariant {
  const named = raw.colors
  const written = named.accent ?? raw.seed
  const own: Own = {
    ...(raw.seed ? seedRoots(raw.seed, raw.appearance) : {}),
    ...(written ? { 'accent.fill': written } : {}),
    ...named,
  }
  const colors = { ...base.colors }
  // In THEME_TOKENS' order, so a derived colour can feed the next one.
  for (const token of THEME_TOKENS) {
    own[token] ??= DERIVE[token]?.(own, base.colors) || undefined
    const filled = own[token] ?? base.colors[token]
    colors[token] = named[token] ? filled : fitted(token, filled, colors, named, raw.appearance)
    if (own[token]) own[token] = colors[token]
  }
  return {
    name: raw.name,
    appearance: raw.appearance,
    colors,
    glow: raw.glow?.length ? raw.glow.slice(0, 3) : [colors.accent],
  }
}
