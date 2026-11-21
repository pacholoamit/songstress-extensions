// The network, as every first-party source reaches it: songstress.net.fetch
// with a browser's User-Agent, a second try for a failure that may pass (no
// answer, a 5xx), and the source's own words turned into a ProviderFailure
// Songstress knows what to do with: a 429 is `rate-limited` (with its wait),
// a source that does not answer is `unavailable`.

import { ProviderFailure, SongstressError, songstress, type NetRequest, type NetResponse } from 'songstress/server'
import { hostOf as hostIn } from './url'

/** What a desktop browser sends: the sources answer it as they answer one. */
const BROWSER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

const TRIES = 2
const PAUSE_MS = 300

function sleep(ms: number): Promise<void> {
  return new Promise((done) => setTimeout(done, ms))
}

function hostOf(url: string): string {
  return hostIn(url) || 'the source'
}

/** The seconds a Retry-After asks for, or undefined. */
function retryAfter(response: NetResponse): number | undefined {
  const raw = (response.headers['retry-after'] ?? '').trim()
  if (/^\d+(\.\d+)?$/.test(raw)) return Number(raw)
  const at = Date.parse(raw)
  return Number.isNaN(at) ? undefined : Math.max(0, Math.round((at - Date.now()) / 1000))
}

/** One try: the answer, or why there was none that counts (a 5xx counts
 * on the last try). A refusal of Songstress's own (a host not granted) or a
 * 429 is thrown: trying again changes nothing. */
async function attempt(url: string, init: NetRequest, last: boolean): Promise<NetResponse | string> {
  let response: NetResponse
  try {
    response = await songstress.net.fetch(url, init)
  } catch (error) {
    if (error instanceof SongstressError && error.code !== 'failed') throw error
    return error instanceof Error ? error.message : String(error)
  }
  if (response.status === 429) {
    throw new ProviderFailure('rate-limited', { message: `${hostOf(url)} asks to slow down`, retryAfterS: retryAfter(response) })
  }
  return response.status >= 500 && !last ? `HTTP ${response.status}` : response
}

/** The answer from a source's address, through the SDK's net.fetch, which
 * the extension host holds to the manifest's network hosts on every hop:
 * answered whatever its status but 429; tried twice when the source did not
 * answer or answered 5xx (the second 5xx is answered). */
export async function reach(url: string, init: NetRequest = {}): Promise<NetResponse> {
  const asked = { ...init, headers: { 'user-agent': BROWSER_AGENT, ...init.headers } }
  let failure = ''
  for (let tries = 0; tries < TRIES; tries++) {
    if (tries > 0) await sleep(PAUSE_MS)
    const got = await attempt(url, asked, tries + 1 === TRIES)
    if (typeof got !== 'string') return got
    failure = got
  }
  throw new ProviderFailure('unavailable', { message: `${hostOf(url)} did not answer: ${failure}` })
}

/** A status the source answered that the caller did not expect. */
export class HttpStatus extends Error {
  override readonly name = 'HttpStatus'
  constructor(readonly status: number, url: string) {
    super(`${hostOf(url)} answered ${status}`)
  }
}

/** The body of a 2xx answer; any other status is an HttpStatus. */
export async function text(url: string, init: NetRequest = {}): Promise<string> {
  const response = await reach(url, init)
  if (response.status < 200 || response.status >= 300) throw new HttpStatus(response.status, url)
  return response.body
}

/** A 2xx answer's body, read as JSON. */
export async function json<T>(url: string, init: NetRequest = {}): Promise<T> {
  const body = await text(url, { ...init, headers: { accept: 'application/json', ...init.headers } })
  try {
    return JSON.parse(body) as T
  } catch {
    throw new ProviderFailure('unavailable', { message: `${hostOf(url)} answered something that is not JSON` })
  }
}

/** Null for a 404 (the source has no such thing), the value otherwise. */
export async function orNull<T>(load: () => Promise<T>): Promise<T | null> {
  try {
    return await load()
  } catch (error) {
    if (error instanceof HttpStatus && (error.status === 404 || error.status === 400)) return null
    throw error
  }
}

/** The query string of params, leaving out those that are empty. */
export function query(params: Record<string, string | number | undefined>): string {
  const parts: string[] = []
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '') continue
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
  }
  return parts.join('&')
}
