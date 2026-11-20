/*
 * Colour maths for themes: WCAG 2 contrast, and the mixes the resolver derives
 * a missing colour with. Colours are `#RRGGBB`, or `#RRGGBBAA` where a token
 * may be translucent. Pure, and shared by every client.
 */

interface Rgba {
  r: number
  g: number
  b: number
  /** 0 to 1. */
  a: number
}

const HEX = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})?$/i

function parse(hex: string): Rgba {
  const m = HEX.exec(hex)
  if (!m) throw new Error(`not a colour: ${hex}`)
  const [r, g, b] = [m[1], m[2], m[3]].map((pair) => parseInt(pair ?? '00', 16))
  return { r: r ?? 0, g: g ?? 0, b: b ?? 0, a: m[4] ? parseInt(m[4], 16) / 255 : 1 }
}

const pair = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0')

function format({ r, g, b, a }: Rgba): string {
  return `#${pair(r)}${pair(g)}${pair(b)}${a < 1 ? pair(a * 255) : ''}`
}

/** `from` moved `amount` (0 to 1) of the way to `to`; both opaque. */
export function mix(from: string, to: string, amount: number): string {
  const a = parse(from)
  const b = parse(to)
  const at = (x: number, y: number) => x + (y - x) * amount
  return format({ r: at(a.r, b.r), g: at(a.g, b.g), b: at(a.b, b.b), a: 1 })
}

/** The colour at `alpha` (0 to 1), as `#RRGGBBAA`. */
export function withAlpha(hex: string, alpha: number): string {
  return format({ ...parse(hex), a: alpha })
}

/** A translucent colour as it shows over an opaque one. */
export function over(top: string, under: string): string {
  const t = parse(top)
  return mix(under, format({ ...t, a: 1 }), t.a)
}

const linear = (channel: number) => {
  const c = channel / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

/** WCAG 2 relative luminance of an opaque colour, 0 (black) to 1 (white). */
export function luminance(hex: string): number {
  const { r, g, b } = parse(hex)
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)
}

/** WCAG 2 contrast ratio of two opaque colours, 1 to 21. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05)
}
