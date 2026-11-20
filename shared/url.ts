// Addresses, without the URL class: the extension engine has none (its
// README: "What the host provides"), so the sources read and build theirs
// with these. Only absolute http and https addresses are read.

export interface Address {
  scheme: 'http' | 'https'
  host: string
  /** The path, from its first slash ("/" when there is none). */
  path: string
  /** The query without its "?" ("" when there is none). */
  query: string
}

const ABSOLUTE = /^(https?):\/\/([^/?#]+)([^?#]*)(?:\?([^#]*))?(?:#.*)?$/i

/** An absolute http or https address, or null. One with userinfo is none. */
export function parseAddress(text: string): Address | null {
  const match = ABSOLUTE.exec(text.trim())
  if (!match || match[2]!.includes('@')) return null
  return {
    scheme: match[1]!.toLowerCase() as Address['scheme'],
    host: match[2]!.toLowerCase(),
    path: match[3] || '/',
    query: match[4] ?? '',
  }
}

export function hostOf(text: string): string {
  return parseAddress(text)?.host ?? ''
}

/** The value of a query parameter, decoded; "" when it is not there. */
export function param(address: Address | null, name: string): string {
  if (!address) return ''
  for (const part of address.query.split('&')) {
    const at = part.indexOf('=')
    const key = at === -1 ? part : part.slice(0, at)
    if (decodeURIComponent(key) !== name) continue
    try {
      return decodeURIComponent((at === -1 ? '' : part.slice(at + 1)).replace(/\+/g, ' '))
    } catch {
      return ''
    }
  }
  return ''
}

/** A reference resolved against the absolute address it was found at, as a
 * browser resolves a playlist's lines: absolute, scheme-relative,
 * host-relative or path-relative (with ./ and ../). */
export function resolveAddress(reference: string, base: string): string {
  const ref = reference.trim()
  if (/^https?:\/\//i.test(ref)) return ref
  const at = parseAddress(base)
  if (!at) return ''
  if (ref.startsWith('//')) return `${at.scheme}:${ref}`
  const origin = `${at.scheme}://${at.host}`
  if (ref.startsWith('/')) return origin + ref
  const [refPath, ...rest] = ref.split('?')
  const segments = at.path.split('/').slice(0, -1)
  for (const segment of refPath!.split('/')) {
    if (segment === '..') {
      if (segments.length > 1) segments.pop()
    } else if (segment !== '.') {
      segments.push(segment)
    }
  }
  const joined = segments.join('/')
  return origin + (joined.startsWith('/') ? joined : `/${joined}`) + (rest.length ? `?${rest.join('?')}` : '')
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

/** The bytes of base64 text, the URL-safe alphabet too, with or without
 * its padding. */
export function base64Bytes(text: string): number[] {
  const clean = text.replace(/-/g, '+').replace(/_/g, '/').replace(/[^A-Za-z0-9+/]/g, '')
  const out: number[] = []
  let bits = 0
  let value = 0
  for (const char of clean) {
    value = (value << 6) | ALPHABET.indexOf(char)
    bits += 6
    if (bits >= 8) {
      bits -= 8
      out.push((value >> bits) & 0xff)
    }
  }
  return out
}

/** Bytes read as UTF-8 text. */
export function utf8Text(bytes: number[]): string {
  let out = ''
  for (let i = 0; i < bytes.length; ) {
    const b = bytes[i]!
    const size = b < 0x80 ? 1 : b < 0xe0 ? 2 : b < 0xf0 ? 3 : 4
    let code = size === 1 ? b : b & (0xff >> (size + 1))
    for (let k = 1; k < size; k++) code = (code << 6) | ((bytes[i + k] ?? 0) & 0x3f)
    out += String.fromCodePoint(code)
    i += size
  }
  return out
}

/** Base64 text decoded as UTF-8. */
export function base64Text(text: string): string {
  return utf8Text(base64Bytes(text))
}
