import { Hct } from '@material/material-color-utilities'
import type { ThemeAppearance, ThemeColors } from './tokens'

/*
 * What a single colour grows into, and how a colour is moved without losing
 * what it is. Both work in HCT (Material's colour space: hue, chroma and a
 * tone that is CIE lightness), where a colour made lighter or darker keeps
 * its hue, which a mix with white or black in RGB does not.
 *
 * The library is pinned at 0.3.0: 0.4.0's entry cannot be loaded by Node (two
 * of its modules import a neighbour with no file extension), and its HCT
 * maths is the same. Only `Hct` is taken from it: the phones' bundler maps
 * the package to that one module (apps/native metro.config.js).
 */

const toArgb = (hex: string): number => (0xff000000 | Number.parseInt(hex.slice(1, 7), 16)) >>> 0
const toHex = (argb: number): string => `#${(argb & 0xffffff).toString(16).padStart(6, '0')}`

/** The most chroma a seed lends the stage and the text on it: Material's
 * neutral palette. A grey seed lends none. */
const NEUTRAL_CHROMA = 6

/** The tones a seed's stage and text take: Material's surface and the text
 * on it, dark and light. */
const TONES: Record<ThemeAppearance, { background: number; text: number }> = {
  dark: { background: 6, text: 92 },
  light: { background: 98, text: 10 },
}

/**
 * The three colours a seed stands for: the accent (the seed as written), and
 * a stage and a text colour carrying a little of its hue. Everything else is
 * derived from these as from any file's colours (resolve.ts), so a file of
 * one colour is a whole theme.
 */
export function seedRoots(seed: string, appearance: ThemeAppearance): Partial<ThemeColors> {
  const { hue, chroma } = Hct.fromInt(toArgb(seed))
  const tint = Math.min(chroma, NEUTRAL_CHROMA)
  const tones = TONES[appearance]
  return {
    background: toHex(Hct.from(hue, tint, tones.background).toInt()),
    text: toHex(Hct.from(hue, tint, tones.text).toInt()),
    accent: seed,
  }
}

/** A colour as a point: its tone, and its chroma out from the centre of
 * HCT's colour wheel at its hue's angle. */
function onWheel(color: string) {
  const { hue, chroma, tone } = Hct.fromInt(toArgb(color))
  const angle = (hue * Math.PI) / 180
  return { tone, x: chroma * Math.cos(angle), y: chroma * Math.sin(angle) }
}

/**
 * How far apart two colours look, in tone steps: by their tones and by their
 * colours at once. A yellow on white is near in tone and far apart in colour;
 * a navy on black is near in both.
 */
export function apart(one: string, other: string): number {
  const a = onWheel(one)
  const b = onWheel(other)
  return Math.hypot(a.tone - b.tone, a.x - b.x, a.y - b.y)
}

/**
 * The colour itself where it passes `ok`, else the nearest tone of it that
 * does: same hue, same chroma where the tone can hold it, lighter or darker
 * by as little as it takes. The colour unchanged where no tone passes.
 */
export function nearestTone(color: string, ok: (candidate: string) => boolean): string {
  if (ok(color)) return color
  const { hue, chroma, tone } = Hct.fromInt(toArgb(color))
  for (let step = 1; step <= 100; step++) {
    for (const at of [tone + step, tone - step]) {
      if (at < 0 || at > 100) continue
      const candidate = toHex(Hct.from(hue, chroma, at).toInt())
      if (ok(candidate)) return candidate
    }
  }
  return color
}
