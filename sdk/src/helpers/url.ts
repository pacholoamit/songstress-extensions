// Addresses, as a server entry reads and builds them. Its sandbox has no URL
// and no URLSearchParams (sandbox.d.ts): these read an absolute http or
// https address, one of its query's parameters, a reference found on a page
// against the page's address, and write a query.

/** An absolute http or https address, in its parts. */
export interface ParsedUrl {
  /** `http` or `https`, in lowercase. */
  scheme: 'http' | 'https'
  /** The host, in lowercase, with its port when the address writes one (`example.com:8080`). */
  host: string
  /** The path, from its first slash: `/` when the address has none. */
  path: string
  /** The query, without its `?`: empty when there is none. */
  query: string
}

const ABSOLUTE = /^(https?):\/\/([^/?#]+)([^?#]*)(?:\?([^#]*))?(?:#.*)?$/i

/** An absolute http or https address, in its parts; null for anything else.
 * An address that writes a user or a password before its host is none.
 * @param text - The address.
 * @returns Its parts, or null.
 * @example
 * ```ts
 * import { parseUrl } from 'songstress/server'
 *
 * parseUrl('https://Music.Example.com/album/42?l=en#top')
 * // { scheme: 'https', host: 'music.example.com', path: '/album/42', query: 'l=en' }
 * parseUrl('example.com/album/42') // null: not absolute
 * ```
 */
export function parseUrl(text: string): ParsedUrl | null {
  const match = ABSOLUTE.exec(text.trim())
  if (!match || match[2]!.includes('@')) return null
  return {
    scheme: match[1]!.toLowerCase() as ParsedUrl['scheme'],
    host: match[2]!.toLowerCase(),
    path: match[3] || '/',
    query: match[4] ?? '',
  }
}

/** Percent-decoding that never throws: text that does not decode is null. */
function decoded(text: string): string | null {
  try {
    return decodeURIComponent(text.replace(/\+/g, ' '))
  } catch {
    return null
  }
}

/** A parameter of an address's query, decoded (`+` is a space); "" when the
 * query has no such parameter, or its value does not decode. The first one
 * counts when it is there twice.
 * @param url - The address, as text or as `parseUrl` read it. Null reads as no address.
 * @param name - The parameter's name.
 * @returns Its value, or "".
 * @example
 * ```ts
 * import { urlParam } from 'songstress/server'
 *
 * urlParam('https://music.example.com/album/42?i=1440&l=en', 'i') // "1440"
 * urlParam('https://music.example.com/search?q=sigur+r%C3%B3s', 'q') // "sigur rós"
 * ```
 */
export function urlParam(url: string | ParsedUrl | null, name: string): string {
  const query = typeof url === 'string' ? (parseUrl(url)?.query ?? '') : (url?.query ?? '')
  for (const part of query.split('&')) {
    const at = part.indexOf('=')
    if (decoded(at === -1 ? part : part.slice(0, at)) !== name) continue
    return at === -1 ? '' : (decoded(part.slice(at + 1)) ?? '')
  }
  return ''
}

/** A path's segments with `.` and `..` resolved, a browser's way: `..` never climbs past the root. */
function resolvedPath(base: string, reference: string): string {
  const segments = base.split('/').slice(0, -1)
  for (const segment of reference.split('/')) {
    if (segment === '..') {
      if (segments.length > 1) segments.pop()
    } else if (segment !== '.') {
      segments.push(segment)
    }
  }
  const joined = segments.join('/')
  return joined.startsWith('/') ? joined : `/${joined}`
}

/** A reference found at an address, resolved against it as a browser
 * resolves a link: one that is absolute stays as it is, one that starts
 * `//` takes the base's scheme, one that starts `/` its host, and any other
 * is read from the base's folder, with `./` and `../`. "" when the base is
 * not an absolute http or https address.
 * @param reference - The reference, as the page writes it.
 * @param base - The address it was found at.
 * @returns The absolute address, or "".
 * @example
 * ```ts
 * import { resolveUrl } from 'songstress/server'
 *
 * const playlist = 'https://cdn.example.com/hls/42/index.m3u8'
 * resolveUrl('segment-1.aac', playlist) // "https://cdn.example.com/hls/42/segment-1.aac"
 * resolveUrl('../keys/k1', playlist) // "https://cdn.example.com/hls/keys/k1"
 * resolveUrl('/art/42.jpg', playlist) // "https://cdn.example.com/art/42.jpg"
 * ```
 */
export function resolveUrl(reference: string, base: string): string {
  const ref = reference.trim()
  if (/^https?:\/\//i.test(ref)) return ref
  const at = parseUrl(base)
  if (!at) return ''
  if (ref.startsWith('//')) return `${at.scheme}:${ref}`
  const origin = `${at.scheme}://${at.host}`
  if (ref.startsWith('/')) return origin + ref
  // A query or a fragment alone keeps the base's path, and a fragment its query too.
  if (ref === '' || ref.startsWith('#')) return `${origin}${at.path}${at.query ? `?${at.query}` : ''}${ref}`
  if (ref.startsWith('?')) return origin + at.path + ref
  const cut = ref.search(/[?#]/)
  return cut < 0 ? origin + resolvedPath(at.path, ref) : origin + resolvedPath(at.path, ref.slice(0, cut)) + ref.slice(cut)
}

/** A query, written from its parameters in their order: each name and
 * value percent-encoded, and a parameter whose value is undefined or ""
 * left out. No leading `?`.
 * @param params - The parameters, by name.
 * @returns The query.
 * @example
 * ```ts
 * import { queryString } from 'songstress/server'
 *
 * declare const text: string
 *
 * const url = `https://api.example.com/search?${queryString({ q: text, limit: 25, offset: undefined })}`
 * // with text "sigur rós": https://api.example.com/search?q=sigur%20r%C3%B3s&limit=25
 * ```
 */
export function queryString(params: Readonly<Record<string, string | number | boolean | undefined>>): string {
  const parts: string[] = []
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '') continue
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
  }
  return parts.join('&')
}
