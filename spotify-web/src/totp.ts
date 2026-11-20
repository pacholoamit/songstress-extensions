// The one-time code Spotify's web player sends for an access token: a
// TOTP (RFC 6238: HMAC-SHA1 over the 30-second counter) on a secret its
// player derives from a published list of bytes. The engine has no
// crypto.subtle, so SHA-1 is written out here (FIPS 180-4).
//
// From the Mornye "spotify-web" extension 1.10.4 (Copyright 2026 zarzet,
// LGPL-3.0-only; see NOTICE): the secrets and their derivation as it wrote
// them.

const SECRETS: Record<number, number[]> = {
  61: [44, 55, 47, 42, 70, 40, 34, 114, 76, 74, 50, 111, 120, 97, 75, 76, 94, 102, 43, 69, 49, 120, 118, 80, 64, 78],
}

export const TOTP_VERSION = 61

function rotate(x: number, n: number): number {
  return (x << n) | (x >>> (32 - n))
}

/** The message padded as SHA-1 pads it: 0x80, zeros, its length in bits. */
function padded(message: readonly number[]): number[] {
  const bytes = [...message, 0x80]
  while (bytes.length % 64 !== 56) bytes.push(0)
  const bits = message.length * 8
  for (let i = 7; i >= 0; i--) bytes.push(i >= 4 ? 0 : (bits >>> (i * 8)) & 0xff)
  return bytes
}

/** One round's function and constant. */
function round(i: number, b: number, c: number, d: number): [number, number] {
  if (i < 20) return [(b & c) | (~b & d), 0x5a827999]
  if (i < 40) return [b ^ c ^ d, 0x6ed9eba1]
  if (i < 60) return [(b & c) | (b & d) | (c & d), 0x8f1bbcdc]
  return [b ^ c ^ d, 0xca62c1d6]
}

/** One 64-byte block into the hash state h. */
function block(bytes: readonly number[], chunk: number, h: number[]): void {
  const w = new Array<number>(80)
  for (let i = 0; i < 16; i++) {
    w[i] = (bytes[chunk + i * 4]! << 24) | (bytes[chunk + i * 4 + 1]! << 16) | (bytes[chunk + i * 4 + 2]! << 8) | bytes[chunk + i * 4 + 3]!
  }
  for (let i = 16; i < 80; i++) w[i] = rotate(w[i - 3]! ^ w[i - 8]! ^ w[i - 14]! ^ w[i - 16]!, 1)
  let [a, b, c, d, e] = h as [number, number, number, number, number]
  for (let i = 0; i < 80; i++) {
    const [f, k] = round(i, b, c, d)
    const t = (rotate(a, 5) + f + e + k + w[i]!) | 0
    ;[e, d, c, b, a] = [d, c, rotate(b, 30), a, t]
  }
  for (const [i, x] of [a, b, c, d, e].entries()) h[i] = (h[i]! + x) | 0
}

/** SHA-1 of bytes. */
function sha1(message: readonly number[]): number[] {
  const bytes = padded(message)
  const h = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0]
  for (let chunk = 0; chunk < bytes.length; chunk += 64) block(bytes, chunk, h)
  return h.flatMap((x) => [(x >>> 24) & 0xff, (x >>> 16) & 0xff, (x >>> 8) & 0xff, x & 0xff])
}

/** HMAC-SHA1 (RFC 2104). */
function hmacSha1(key: readonly number[], message: readonly number[]): number[] {
  let k = key.length > 64 ? sha1(key) : [...key]
  while (k.length < 64) k.push(0)
  const inner = sha1([...k.map((b) => b ^ 0x36), ...message])
  return sha1([...k.map((b) => b ^ 0x5c), ...inner])
}

/** The secret's bytes: each byte XORed with its place, the numbers written
 * out as decimal text, that text's character codes. */
function secretBytes(version: number): number[] {
  const list = SECRETS[version] ?? []
  const joined = list.map((b, i) => String(b ^ ((i % 33) + 9))).join('')
  return [...joined].map((c) => c.charCodeAt(0))
}

/** The six-digit code for the 30 seconds that hold `atMs`. */
export function totp(atMs: number, version = TOTP_VERSION): string {
  return codeFor(secretBytes(version), atMs)
}

/** RFC 6238's code for a key, six digits. */
export function codeFor(key: readonly number[], atMs: number): string {
  let counter = Math.floor(atMs / 1000 / 30)
  const message = new Array<number>(8).fill(0)
  for (let i = 7; i >= 0; i--) {
    message[i] = counter & 0xff
    counter = Math.floor(counter / 256)
  }
  const mac = hmacSha1(key, message)
  const offset = mac[mac.length - 1]! & 0x0f
  const code = ((mac[offset]! & 0x7f) << 24) | (mac[offset + 1]! << 16) | (mac[offset + 2]! << 8) | mac[offset + 3]!
  return String(code % 1_000_000).padStart(6, '0')
}
