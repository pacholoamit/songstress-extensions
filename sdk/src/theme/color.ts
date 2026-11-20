// A theme's colours (SPEC.md, section 12, "Colours"): hex of three, four, six
// or eight digits, or CSS's rgb(), rgba(), hsl() and hsla(), their parts
// between commas or between spaces. Each is read to one form, `#rrggbb`, or
// `#rrggbbaa` when it is translucent, and that form is all the apps' engine,
// the rules a look is held to and the server ever see. The Go server reads
// them by the same steps (apps/pocketbase/internal/extensions/manifest,
// color.go); corpus/colors.json holds the two to the same answers.

/** A colour, read. */
export interface ParsedColor {
  /** Its one form: `#rrggbb`, or `#rrggbbaa` when it is translucent, in lower case. */
  hex: string
  /** From 0 to 1, as the form keeps it (in steps of 1/255): 1 for an opaque colour. */
  alpha: number
}

/** The longest colour a theme may write. */
export const MAX_COLOR_LENGTH = 64

const HEX = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/
const CALL = /^(rgba?|hsla?)\(([^()]*)\)$/
/** A number as CSS writes one, with no exponent, and its unit. */
const PART = /^([+-]?(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+))(%|deg|grad|rad|turn)?$/
/** CSS's whitespace, and no other. */
const SPACE = /[ \t\n\r\f]+/
const EDGES = /^[ \t\n\r\f]+|[ \t\n\r\f]+$/g

type Unit = '' | '%' | 'deg' | 'grad' | 'rad' | 'turn'

interface Part {
  value: number
  unit: Unit
}

function partOf(text: string): Part | undefined {
  const found = PART.exec(text)
  if (!found) return undefined
  const value = Number(found[1])
  return Number.isFinite(value) ? { value, unit: (found[2] ?? '') as Unit } : undefined
}

const trimmed = (text: string) => text.replace(EDGES, '')

/** A call's three parts and its alpha, if it writes one; `legacy` for parts between commas. */
interface Arguments {
  parts: string[]
  alpha?: string
  legacy: boolean
}

/** The parts between commas: three, or four with the alpha, and no slash. */
function commaArguments(text: string): Arguments | undefined {
  if (text.includes('/')) return undefined
  const parts = text.split(',').map(trimmed)
  if (parts.length < 3 || parts.length > 4 || parts.some((part) => part === '' || SPACE.test(part))) return undefined
  return { parts: parts.slice(0, 3), alpha: parts[3], legacy: true }
}

/** The parts between spaces: three, then the alpha after a slash. */
function spaceArguments(text: string): Arguments | undefined {
  const [channels = '', alpha, ...more] = text.split('/')
  const parts = trimmed(channels).split(SPACE)
  if (more.length > 0 || parts.length !== 3 || parts.includes('')) return undefined
  if (alpha === undefined) return { parts, legacy: false }
  const written = trimmed(alpha)
  return written === '' || SPACE.test(written) ? undefined : { parts, alpha: written, legacy: false }
}

function argumentsOf(inside: string): Arguments | undefined {
  const text = trimmed(inside)
  return text.includes(',') ? commaArguments(text) : spaceArguments(text)
}

const inRange = (value: number, top: number) => value >= 0 && value <= top

/** A channel or an alpha as a percentage, as a byte. */
const percentByte = (value: number) => (inRange(value, 100) ? Math.round((value * 255) / 100) : undefined)

/** One of rgb()'s channels as a byte: 0 to 255, or 0% to 100%. */
function channelOf(part: Part): number | undefined {
  if (part.unit === '%') return percentByte(part.value)
  return inRange(part.value, 255) ? Math.round(part.value) : undefined
}

/** rgb()'s three channels as bytes; between commas all of one kind. */
function rgbBytes(parts: readonly string[], legacy: boolean): number[] | undefined {
  const read = parts.map(partOf)
  const channels = read.filter((part): part is Part => part !== undefined && (part.unit === '' || part.unit === '%'))
  if (channels.length !== 3) return undefined
  if (legacy && channels.some((part) => part.unit !== channels[0]?.unit)) return undefined
  const bytes = channels.map(channelOf)
  return bytes.every((byte) => byte !== undefined) ? bytes : undefined
}

/** A hue in degrees: a number, or an angle in deg, grad, rad or turn. */
function degreesOf(part: Part): number | undefined {
  switch (part.unit) {
    case '':
    case 'deg':
      return part.value
    case 'grad':
      return (part.value * 360) / 400
    case 'rad':
      return (part.value * 180) / Math.PI
    case 'turn':
      return part.value * 360
    default:
      return undefined
  }
}

/** A saturation or a lightness, 0% to 100%, as a fraction; between spaces a number of percent will do. */
function fractionOf(part: Part, legacy: boolean): number | undefined {
  if (part.unit !== '%' && (legacy || part.unit !== '')) return undefined
  return inRange(part.value, 100) ? part.value / 100 : undefined
}

/** CSS Color 4's hslToRgb, one channel (n: 0 for red, 8 for green, 4 for blue), from 0 to 1. */
function hslChannel(n: number, degrees: number, saturation: number, lightness: number): number {
  let hue = degrees % 360
  if (hue < 0) hue += 360
  const k = (n + hue / 30) % 12
  const a = saturation * Math.min(lightness, 1 - lightness)
  return lightness - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
}

const channelByte = (fraction: number) => Math.min(255, Math.max(0, Math.round(fraction * 255)))

/** hsl()'s three parts as bytes. */
function hslBytes(parts: readonly string[], legacy: boolean): number[] | undefined {
  const [hue, saturation, lightness] = parts.map(partOf)
  if (hue === undefined || saturation === undefined || lightness === undefined) return undefined
  const degrees = degreesOf(hue)
  const s = fractionOf(saturation, legacy)
  const l = fractionOf(lightness, legacy)
  if (degrees === undefined || s === undefined || l === undefined) return undefined
  return [0, 8, 4].map((n) => channelByte(hslChannel(n, degrees, s, l)))
}

/** An alpha as a byte: 0 to 1, or 0% to 100%; 255 when none is written. */
function alphaByte(text: string | undefined): number | undefined {
  if (text === undefined) return 255
  const part = partOf(text)
  if (part === undefined) return undefined
  if (part.unit === '%') return percentByte(part.value)
  return part.unit === '' && inRange(part.value, 1) ? Math.round(part.value * 255) : undefined
}

function hexBytes(value: string): number[] {
  const digits = value.slice(1).toLowerCase()
  const full = digits.length <= 4 ? [...digits].map((digit) => digit + digit).join('') : digits
  return [0, 2, 4, 6].map((at) => (at < full.length ? Number.parseInt(full.slice(at, at + 2), 16) : 255))
}

function callBytes(value: string): number[] | undefined {
  const call = CALL.exec(value)
  if (!call) return undefined
  const [, name = '', inside = ''] = call
  const args = argumentsOf(inside)
  if (args === undefined) return undefined
  const channels = name.startsWith('rgb') ? rgbBytes(args.parts, args.legacy) : hslBytes(args.parts, args.legacy)
  const alpha = alphaByte(args.alpha)
  return channels === undefined || alpha === undefined ? undefined : [...channels, alpha]
}

const hexOf = (byte: number) => byte.toString(16).padStart(2, '0')

/** Reads a colour as a theme writes it; nothing for a value that is not one of a theme's forms (SPEC.md,
 * section 12): a name, `currentColor`, `var()`, a gradient, a part out of its range, more than 64 characters. */
export function parseColor(value: string): ParsedColor | undefined {
  if (value.length > MAX_COLOR_LENGTH) return undefined
  const bytes = HEX.test(value) ? hexBytes(value) : callBytes(value)
  if (bytes === undefined) return undefined
  const [red = 0, green = 0, blue = 0, alpha = 255] = bytes
  return { hex: `#${hexOf(red)}${hexOf(green)}${hexOf(blue)}${alpha < 255 ? hexOf(alpha) : ''}`, alpha: alpha / 255 }
}

/** A colour in its one form, `#rrggbb` or `#rrggbbaa`; nothing for a value that is not a colour. */
export function normalizeColor(value: string): string | undefined {
  return parseColor(value)?.hex
}

/** What is wrong with a colour where a look writes it: `form`, a value that is not one of a theme's colours;
 * `translucent`, a colour with an alpha below 1 where its place may not have one. Nothing when it may stand. */
export function colorFault(value: string, translucent: boolean): 'form' | 'translucent' | undefined {
  const color = parseColor(value)
  if (color === undefined) return 'form'
  return color.alpha < 1 && !translucent ? 'translucent' : undefined
}
