import { gzipSync } from 'node:zlib'
import { afterEach, describe, expect, it } from 'vitest'
import { SongstressError } from '../api/common'
import type { NetRequest, NetResponse } from '../api/data'
import { ProviderFailure } from '../api/providers'
import { createMockHost, type MockHost } from '../testing/host'
import { fetchJson, fetchResponse, fetchText, findInAnswer, HttpStatusError, nullIfMissing } from './net'

// The network helpers against the SDK's own mock host, as an extension's
// tests would run them: a manifest that names the source's host, and a
// network that answers from the test.

const manifest = { permissions: { network: { hosts: ['api.example.com'] } } }

let host: MockHost | undefined
afterEach(() => host?.remove())

/** A mock host whose network answers each request in turn from `answers`. */
function answering(...answers: ((url: string, request: NetRequest) => Partial<NetResponse>)[]): MockHost {
  let asked = 0
  host = createMockHost({ manifest, fetch: (url, request) => answers[Math.min(asked++, answers.length - 1)]!(url, request) })
  return host
}

const failing = () => {
  throw new SongstressError('failed', 'net.fetch: connection refused')
}

describe('fetchResponse', () => {
  it('answers any status but a 429 or a 5xx, at the first try', async () => {
    const mock = answering(() => ({ status: 404, body: 'no such thing' }))
    expect(await fetchResponse('https://api.example.com/x')).toMatchObject({ status: 404, body: 'no such thing' })
    expect(mock.requests).toHaveLength(1)
  })

  it('tries again when the source did not answer, or answered a 5xx', async () => {
    const unanswered = answering(failing, () => ({ body: 'ok' }))
    expect((await fetchResponse('https://api.example.com/x')).body).toBe('ok')
    expect(unanswered.requests).toHaveLength(2)
    const failed = answering(() => ({ status: 503 }), () => ({ body: 'ok' }))
    expect((await fetchResponse('https://api.example.com/x')).body).toBe('ok')
    expect(failed.requests).toHaveLength(2)
  })

  it('is unavailable when neither try was answered, or both were 5xx', async () => {
    answering(failing)
    await expect(fetchResponse('https://api.example.com/x')).rejects.toMatchObject({
      code: 'unavailable',
      message: 'api.example.com did not answer: net.fetch: connection refused',
    })
    answering(() => ({ status: 500 }))
    await expect(fetchResponse('https://api.example.com/x')).rejects.toMatchObject({ code: 'unavailable', message: 'api.example.com answered 500' })
  })

  it('is rate-limited on a 429, with the wait it asks for, and tries no more', async () => {
    const mock = answering(() => ({ status: 429, headers: { 'retry-after': '120' } }))
    const failure = await fetchResponse('https://api.example.com/x').catch((error: unknown) => error)
    expect(failure).toBeInstanceOf(ProviderFailure)
    expect(failure).toMatchObject({ code: 'rate-limited', retryAfterS: 120 })
    expect(mock.requests).toHaveLength(1)
    const at = new Date(Date.now() + 60_000).toUTCString()
    answering(() => ({ status: 429, headers: { 'retry-after': at } }))
    const dated = (await fetchResponse('https://api.example.com/x').catch((error: unknown) => error)) as ProviderFailure
    expect(dated.retryAfterS).toBeGreaterThanOrEqual(58)
    expect(dated.retryAfterS).toBeLessThanOrEqual(60)
  })

  it("throws the host's own refusals as they come, untried again", async () => {
    const mock = answering(() => ({ body: 'never' }))
    await expect(fetchResponse('https://elsewhere.example.org/x')).rejects.toMatchObject({ code: 'permission-denied' })
    expect(mock.requests).toHaveLength(1)
  })
})

describe('fetchText and fetchJson', () => {
  it("answer a 2xx's body, and throw any other status as an HttpStatusError", async () => {
    answering(() => ({ status: 201, body: 'made' }))
    expect(await fetchText('https://api.example.com/x')).toBe('made')
    answering(() => ({ status: 403 }))
    const error = await fetchText('https://api.example.com/x').catch((thrown: unknown) => thrown)
    expect(error).toBeInstanceOf(HttpStatusError)
    expect(error).toMatchObject({ status: 403, url: 'https://api.example.com/x', message: 'api.example.com answered 403' })
  })

  it("ask for JSON unless the request names its own accept, and read it", async () => {
    const mock = answering(() => ({ body: '{"ok":true}' }))
    expect(await fetchJson('https://api.example.com/x', { headers: { authorization: 'Bearer t' } })).toEqual({ ok: true })
    expect(await fetchJson('https://api.example.com/x', { headers: { Accept: 'application/vnd.api+json' } })).toEqual({ ok: true })
    expect(mock.requests.map((asked) => asked.request.headers)).toEqual([
      { authorization: 'Bearer t', accept: 'application/json' },
      { Accept: 'application/vnd.api+json' },
    ])
  })

  it('are unavailable for a body that is not JSON', async () => {
    answering(() => ({ body: '<html>a challenge</html>' }))
    await expect(fetchJson('https://api.example.com/x')).rejects.toMatchObject({ code: 'unavailable', message: 'api.example.com answered something that is not JSON' })
  })
})

describe('nullIfMissing', () => {
  it('is null for a 404 or a 410, or the statuses given, and throws anything else', async () => {
    answering(() => ({ status: 404 }))
    expect(await nullIfMissing(() => fetchJson('https://api.example.com/tracks/9'))).toBeNull()
    answering(() => ({ status: 400 }))
    await expect(nullIfMissing(() => fetchJson('https://api.example.com/tracks/x'))).rejects.toBeInstanceOf(HttpStatusError)
    expect(await nullIfMissing(() => fetchJson('https://api.example.com/tracks/x'), [400, 404])).toBeNull()
    answering(() => ({ body: '{"id":"9"}' }))
    expect(await nullIfMissing(() => fetchJson('https://api.example.com/tracks/9'))).toEqual({ id: '9' })
  })
})

describe('findInAnswer', () => {
  const token = 'eyJhbGciOiJFUzI1NiJ9.abc_DEF-123.c2ln'
  const find = (text: string) => /eyJ[\w-]+\.[\w-]+\.[\w-]+/.exec(text)?.[0] ?? null
  const script = `${'x'.repeat(3_000_000)}"${token}"${'y'.repeat(500_000)}`

  /** A source whose script is past what one request may answer: refused as
   * the host refuses it, unless it is asked for gzipped as base64. */
  const large = (packed: Uint8Array) => (_url: string, request: NetRequest) => {
    if (request.headers?.['accept-encoding'] !== 'gzip' || request.responseEncoding !== 'base64') {
      throw new SongstressError('limit-exceeded', 'net.fetch: the answer is larger than 2621440 bytes')
    }
    return { headers: { 'content-encoding': 'gzip' }, body: Buffer.from(packed).toString('base64') }
  }

  it('reads an answer that fits as it is', async () => {
    const mock = answering(() => ({ body: `var a="${token}"` }))
    expect(await findInAnswer('https://api.example.com/app.js', find)).toBe(token)
    expect(mock.requests).toHaveLength(1)
  })

  it('asks again gzipped for one too large, with the request as it was, and reads it unpacked', async () => {
    const mock = answering(large(new Uint8Array(gzipSync(script))))
    expect(await findInAnswer('https://api.example.com/app.js', find, { headers: { 'Accept-Encoding': 'br', referer: 'https://api.example.com/' } })).toBe(token)
    expect(mock.requests.map((asked) => asked.request)).toEqual([
      { headers: { 'Accept-Encoding': 'br', referer: 'https://api.example.com/' } },
      { headers: { referer: 'https://api.example.com/', 'accept-encoding': 'gzip' }, responseEncoding: 'base64' },
    ])
    answering(large(new TextEncoder().encode(`plain "${token}"`)))
    expect(await findInAnswer('https://api.example.com/app.js', find)).toBe(token)
  })

  it('throws a deadline passed as it comes: asking again packed would not answer in time either', async () => {
    const mock = answering(() => {
      throw new SongstressError('limit-exceeded', 'net.fetch: no answer in time')
    })
    await expect(findInAnswer('https://api.example.com/app.js', find)).rejects.toMatchObject({ code: 'limit-exceeded' })
    expect(mock.requests).toHaveLength(1)
  })

  it('is null when nothing is found, unavailable for a packed answer that does not unpack, and lets what find throws through', async () => {
    answering(large(new Uint8Array(gzipSync('nothing here'))))
    expect(await findInAnswer('https://api.example.com/app.js', find)).toBeNull()
    const cut = new Uint8Array(gzipSync(script))
    answering(large(cut.subarray(0, cut.length - 5000)))
    await expect(findInAnswer('https://api.example.com/app.js', find)).rejects.toMatchObject({ code: 'unavailable' })
    answering(large(new Uint8Array(gzipSync(script))))
    const broken = () => {
      throw new TypeError('my own mistake')
    }
    await expect(findInAnswer('https://api.example.com/app.js', broken)).rejects.toThrow('my own mistake')
  })
})
