// Bytes, as a server entry reads them. Its sandbox has no atob and no
// TextDecoder (sandbox.d.ts), so base64 and UTF-8 are read here: a token's
// claims, a body asked for as base64, a source's own binary answers.

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
/** Each base64 character's six bits, by its code: both alphabets, `+/` and the URL-safe `-_`. */
const SIXES = new Uint8Array(128)
for (let at = 0; at < ALPHABET.length; at++) SIXES[ALPHABET.charCodeAt(at)] = at
SIXES[45] = 62 // -
SIXES[95] = 63 // _

const sixes = (text: string, at: number): number => SIXES[text.charCodeAt(at)]!

/** The bytes base64 text holds, written in either alphabet (`+/` or the
 * URL-safe `-_`), with or without its `=` padding. Anything else in the text
 * (a line break, a space) is passed over.
 * @param text - The base64 text.
 * @returns The bytes it holds.
 * @example
 * ```ts
 * import { base64Bytes, songstress } from 'songstress/server'
 *
 * const answer = await songstress.net.fetch('https://example.com/cover.jpg', { responseEncoding: 'base64' })
 * const bytes = base64Bytes(answer.body)
 * console.log(bytes.length) // the picture's size in bytes
 * ```
 */
export function base64Bytes(text: string): Uint8Array {
  // The sandbox runs JavaScript slowly: what is not base64 goes first, in one
  // native pass, so the loop reads four characters at a time with no test.
  const clean = text.replace(/[^A-Za-z0-9+/_-]+/g, '')
  const n = clean.length
  const out = new Uint8Array(Math.floor((n * 3) / 4))
  let size = 0
  let at = 0
  for (; at + 4 <= n; at += 4) {
    const quad =
      (SIXES[clean.charCodeAt(at)]! << 18) |
      (SIXES[clean.charCodeAt(at + 1)]! << 12) |
      (SIXES[clean.charCodeAt(at + 2)]! << 6) |
      SIXES[clean.charCodeAt(at + 3)]!
    out[size++] = quad >> 16
    out[size++] = (quad >> 8) & 0xff
    out[size++] = quad & 0xff
  }
  // Two or three characters left are one or two bytes; one is none.
  if (n - at >= 2) out[size++] = ((sixes(clean, at) << 2) | (sixes(clean, at + 1) >> 4)) & 0xff
  if (n - at === 3) out[size++] = ((sixes(clean, at + 1) << 4) | (sixes(clean, at + 2) >> 2)) & 0xff
  return out.subarray(0, size)
}

const REPLACEMENT = 0xfffd

/** How many bytes the UTF-8 sequence a byte starts is long: 0 when it starts none. */
function sequenceLength(lead: number): number {
  if (lead < 0x80) return 1
  if (lead < 0xc0) return 0
  if (lead < 0xe0) return 2
  if (lead < 0xf0) return 3
  return lead < 0xf8 ? 4 : 0
}

/** The least code point a sequence of each length may spell: a smaller one
 * written longer (an overlong form, `C0 80` for U+0000) is not UTF-8. */
const LEAST = [0, 0, 0x80, 0x800, 0x10000]

const isSurrogate = (code: number) => code >= 0xd800 && code <= 0xdfff

/** The code point at `at`, and how many bytes it took: U+FFFD, and the bytes
 * up to the first that does not belong, when they are not UTF-8. */
function codePointAt(bytes: ArrayLike<number>, at: number): readonly [code: number, size: number] {
  const lead = bytes[at]!
  const size = sequenceLength(lead)
  if (size === 1) return [lead, 1]
  if (size === 0 || at + size > bytes.length) return [REPLACEMENT, 1]
  let code = lead & (0xff >> (size + 1))
  for (let next = 1; next < size; next++) {
    const byte = bytes[at + next]!
    if ((byte & 0xc0) !== 0x80) return [REPLACEMENT, next]
    code = (code << 6) | (byte & 0x3f)
  }
  return code > 0x10ffff || isSurrogate(code) || code < LEAST[size]! ? [REPLACEMENT, size] : [code, size]
}

/** Bytes read as UTF-8 text. What is not UTF-8 reads as U+FFFD, and never throws.
 * @param bytes - The bytes: a `Uint8Array`, or an array of numbers from 0 to 255.
 * @returns The text they spell.
 * @example
 * ```ts
 * import { utf8Text } from 'songstress/server'
 *
 * utf8Text([0x41, 0x6d, 0xc3, 0xa9, 0x6c, 0x69, 0x65]) // "Amélie"
 * ```
 */
export function utf8Text(bytes: ArrayLike<number>): string {
  const parts: string[] = []
  let codes: number[] = []
  for (let at = 0; at < bytes.length; ) {
    const [code, size] = codePointAt(bytes, at)
    codes.push(code)
    at += size
    if (codes.length < 8192) continue
    parts.push(String.fromCodePoint(...codes))
    codes = []
  }
  parts.push(String.fromCodePoint(...codes))
  return parts.join('')
}

/** Base64 text, decoded, read as UTF-8: what `atob` and a `TextDecoder`
 * would give together. A JSON Web Token's claims, for one.
 * @param text - The base64 text, in either alphabet.
 * @returns The text it holds.
 * @example
 * ```ts
 * import { base64Text } from 'songstress/server'
 *
 * declare const token: string // a JSON Web Token a source handed out
 *
 * const claims = JSON.parse(base64Text(token.split('.')[1] ?? '')) as { exp?: number }
 * console.log(claims.exp) // when it stops working, in seconds since 1970
 * ```
 */
export function base64Text(text: string): string {
  return utf8Text(base64Bytes(text))
}

/** Bytes as text one character a byte, the fastest the sandbox reads them:
 * what is not ASCII reads wrongly, so it serves a search for something
 * written in ASCII (a token, an id, an address). */
export function byteText(bytes: Uint8Array): string {
  const parts: string[] = []
  for (let at = 0; at < bytes.length; at += 8192) parts.push(String.fromCharCode(...bytes.subarray(at, at + 8192)))
  return parts.join('')
}
