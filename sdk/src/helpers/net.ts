// A source's answers, as a provider reaches them: songstress.net.fetch tried
// a second time when the source did not answer or failed (a 5xx), and the
// source's own words turned into a ProviderFailure Songstress knows what to
// do with: a 429 is `rate-limited`, with the wait it asks for, and a source
// that does not answer is `unavailable`.

import type { NetRequest, NetResponse } from '../api/data'
import { ProviderFailure } from '../api/providers'
import { serverApi as songstress } from '../host'
import { base64Bytes, byteText } from './bytes'
import { findInGzip, GzipError, isGzip } from './gunzip'
import { parseUrl } from './url'

const TRIES = 2
const PAUSE_MS = 300

/** The sandbox's timer (sandbox.d.ts), and a test's: the SDK itself compiles against the language alone. */
const timers = globalThis as unknown as { setTimeout(handler: () => void, ms: number): unknown }
const pause = (ms: number) => new Promise<void>((done) => timers.setTimeout(done, ms))

const hostIn = (url: string) => parseUrl(url)?.host || 'the source'

/** The code of a refusal of the host's own ("limit-exceeded"). Its errors carry a
 * `code` as the SDK's SongstressError does without being that class: the sandbox
 * makes them outside the extension's bundle. "" for an error without one. */
function codeOf(error: unknown): string {
  const code = (error as { code?: unknown } | null)?.code
  return typeof code === 'string' ? code : ''
}

/** The host's refusal of an answer too large to hand over: a `limit-exceeded`
 * that is not its deadline, which it words "no answer in time" (SPEC.md,
 * section 9). Asking again for the same answer packed helps the one, never
 * the other: a call past its time has no time left. */
function tooLarge(error: unknown): boolean {
  return codeOf(error) === 'limit-exceeded' && !/no answer in time/i.test(error instanceof Error ? error.message : String(error))
}

/** Headers with one more, unless they hold that name already in any case. */
function withDefault(headers: Readonly<Record<string, string>> = {}, name: string, value: string): Record<string, string> {
  const named = Object.keys(headers).some((key) => key.toLowerCase() === name)
  return named ? { ...headers } : { ...headers, [name]: value }
}

/** The seconds a Retry-After asks for: a number of them, or a date. */
function retryAfter(response: NetResponse): number | undefined {
  const raw = (response.headers['retry-after'] ?? '').trim()
  if (/^\d+(\.\d+)?$/.test(raw)) return Number(raw)
  const at = Date.parse(raw)
  return Number.isNaN(at) ? undefined : Math.max(0, Math.round((at - Date.now()) / 1000))
}

/** One try: the answer, or why there was none that counts. A refusal of the
 * host's own (a host not granted, an answer too large) and a 429 are thrown:
 * trying again changes nothing. */
async function attempt(url: string, init: NetRequest): Promise<NetResponse | string> {
  let response: NetResponse
  try {
    response = await songstress.net.fetch(url, init)
  } catch (error) {
    const code = codeOf(error)
    if (code !== '' && code !== 'failed') throw error
    // Never the error's own words: they can carry the address, its query and the tokens in it, and a failure's
    // message reaches the server's log and the apps. The host alone, and why in general.
    return 'did not answer'
  }
  if (response.status === 429) {
    throw new ProviderFailure('rate-limited', { message: `${hostIn(url)} asks to slow down`, retryAfterS: retryAfter(response) })
  }
  return response.status >= 500 ? `answered ${response.status}` : response
}

/** The answer at an address, through `songstress.net.fetch` (so under the
 * manifest's `network` permission, and the host's limits), tried a second
 * time, 300 ms later, when the request failed before any answer (the code
 * `failed`, or none) or the source answered with a 5xx. A call past its
 * deadline is not tried again: the host refuses it with `limit-exceeded`,
 * and the call's time is spent. Any other status is answered, for the
 * caller to read.
 * @param url - The address.
 * @param init - The request, as `songstress.net.fetch` takes it.
 * @returns The answer: any status but a 429 or a 5xx.
 * @throws `ProviderFailure` `rate-limited` on a 429, with the wait its `Retry-After` asks for; `unavailable` when both tries went unanswered or answered a 5xx. A refusal of the host's own (`permission-denied`, `limit-exceeded`) is thrown as it comes.
 * @example
 * ```ts
 * import { fetchResponse } from 'songstress/server'
 *
 * const answer = await fetchResponse('https://api.example.com/session', { method: 'POST', body: '{}' })
 * if (answer.status === 401) console.log('signed out')
 * ```
 */
export async function fetchResponse(url: string, init: NetRequest = {}): Promise<NetResponse> {
  let failure = ''
  for (let tries = 0; tries < TRIES; tries++) {
    if (tries > 0) await pause(PAUSE_MS)
    const got = await attempt(url, init)
    if (typeof got !== 'string') return got
    failure = got
  }
  throw new ProviderFailure('unavailable', { message: `${hostIn(url)} ${failure}` })
}

/** A status a source answered that the caller did not take: what
 * `fetchText` and `fetchJson` throw for any answer but a 2xx. A provider
 * reads it to tell "no such thing" (`nullIfMissing`) or "signed out" from a
 * failure.
 * @example
 * ```ts
 * import { fetchJson, HttpStatusError, ProviderFailure } from 'songstress/server'
 *
 * async function profile(token: string): Promise<unknown> {
 *   try {
 *     return await fetchJson('https://api.example.com/me', { headers: { authorization: `Bearer ${token}` } })
 *   } catch (error) {
 *     if (error instanceof HttpStatusError && error.status === 401) throw new ProviderFailure('sign-in-required')
 *     throw error
 *   }
 * }
 * ```
 */
export class HttpStatusError extends Error {
  override readonly name = 'HttpStatusError'

  /** The status, and the address that answered it.
   * @param status - The status the source answered.
   * @param url - The address asked.
   */
  constructor(
    readonly status: number,
    readonly url: string,
  ) {
    super(`${hostIn(url)} answered ${status}`)
  }
}

/** The body of a 2xx answer at an address, as text (`fetchResponse`, so tried twice when that helps).
 * @param url - The address.
 * @param init - The request, as `songstress.net.fetch` takes it.
 * @returns The answer's body.
 * @throws `HttpStatusError` for any other status, and what `fetchResponse` throws.
 * @example
 * ```ts
 * import { fetchText, htmlToText } from 'songstress/server'
 *
 * const page = await fetchText('https://lyrics.example.com/song/42', { headers: { 'accept-language': 'en' } })
 * const title = htmlToText(/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(page)?.[1] ?? '')
 * ```
 */
export async function fetchText(url: string, init: NetRequest = {}): Promise<string> {
  const response = await fetchResponse(url, init)
  if (response.status < 200 || response.status >= 300) throw new HttpStatusError(response.status, url)
  return response.body
}

/** The body of a 2xx answer at an address, read as JSON. It asks for JSON
 * (`accept: application/json`) unless the request names its own `accept`.
 * The type is the caller's word for it: nothing checks it.
 * @param url - The address.
 * @param init - The request, as `songstress.net.fetch` takes it.
 * @returns The answer's body, parsed.
 * @throws `HttpStatusError` for an answer but a 2xx; `ProviderFailure` `unavailable` for a body that is not JSON; and what `fetchResponse` throws.
 * @example
 * ```ts
 * import { fetchJson, queryString } from 'songstress/server'
 *
 * interface Found {
 *   results: { id: string; title: string }[]
 * }
 *
 * const found = await fetchJson<Found>(`https://api.example.com/search?${queryString({ q: 'halo', limit: 10 })}`)
 * console.log(found.results.length)
 * ```
 */
export async function fetchJson<T>(url: string, init: NetRequest = {}): Promise<T> {
  const body = await fetchText(url, { ...init, headers: withDefault(init.headers, 'accept', 'application/json') })
  try {
    return JSON.parse(body) as T
  } catch {
    throw new ProviderFailure('unavailable', { message: `${hostIn(url)} answered something that is not JSON` })
  }
}

/** What `load` gives, or null when the source answers that it has no such
 * thing: an `HttpStatusError` of one of `statuses`. What a lookup by id
 * answers for an id the source does not know.
 * @param load - Loads the thing: a `fetchJson` or a `fetchText`, most often.
 * @param statuses - The statuses that mean "no such thing": 404 and 410 unless given.
 * @returns What `load` gives, or null.
 * @example
 * ```ts
 * import { fetchJson, nullIfMissing, songstress, type CatalogTrack } from 'songstress/server'
 *
 * songstress.providers.lookup.register('my-source', {
 *   track: (id) => nullIfMissing(() => fetchJson<CatalogTrack>(`https://api.example.com/tracks/${encodeURIComponent(id)}`)),
 * })
 * ```
 */
export async function nullIfMissing<T>(load: () => Promise<T>, statuses: readonly number[] = [404, 410]): Promise<T | null> {
  try {
    return await load()
  } catch (error) {
    if (error instanceof HttpStatusError && statuses.includes(error.status)) return null
    throw error
  }
}

/** What `find` finds in the text at an address, however large the answer.
 * The host answers at most 2.5 MiB a request, which a web player's script
 * can be past: the text is asked for as it is first, and when the host
 * refuses it as too large (`limit-exceeded`, and not its deadline), asked for again gzipped, which
 * the host hands over as the source packed it (SPEC.md, section 9), to be
 * unpacked here a block at a time. `find` is then handed each stretch of
 * text in turn (with the end of the one before, so nothing is cut in two),
 * one character a byte, and the first thing it finds ends the reading: look
 * for something written in ASCII (a token, an id, an address). So `find`
 * may be called many times; what it gathers, it gathers for each stretch.
 * @param url - The address of the page or the script.
 * @param find - Finds the thing in a stretch of text, or answers null.
 * @param init - The request, as `songstress.net.fetch` takes it.
 * @returns What `find` found, or null.
 * @throws `HttpStatusError` for an answer but a 2xx; `ProviderFailure` `unavailable` for a packed answer that does not unpack; and what `fetchResponse` throws.
 * @example
 * ```ts
 * import { findInAnswer } from 'songstress/server'
 *
 * // A client id somewhere in a web player's script of several megabytes.
 * const clientId = await findInAnswer('https://player.example.com/app.js', (text) => /client_id:"(\w{32})"/.exec(text)?.[1] ?? null)
 * ```
 */
export async function findInAnswer<T>(url: string, find: (text: string) => T | null, init: NetRequest = {}): Promise<T | null> {
  try {
    return find(await fetchText(url, init))
  } catch (error) {
    if (!tooLarge(error)) throw error
  }
  const headers = Object.fromEntries(Object.entries(init.headers ?? {}).filter(([name]) => name.toLowerCase() !== 'accept-encoding'))
  const response = await fetchResponse(url, { ...init, headers: { ...headers, 'accept-encoding': 'gzip' }, responseEncoding: 'base64' })
  if (response.status < 200 || response.status >= 300) throw new HttpStatusError(response.status, url)
  const bytes = base64Bytes(response.body)
  try {
    return isGzip(bytes) ? findInGzip(bytes, find) : find(byteText(bytes))
  } catch (error) {
    if (error instanceof GzipError) throw new ProviderFailure('unavailable', { message: `${hostIn(url)} answered a packed body that does not unpack` })
    throw error
  }
}
