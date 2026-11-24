import { gzipSync } from 'node:zlib'
import { SongstressError, type NetRequest, type NetResponse, type SettingValue } from 'songstress/server'
import { createMockHost, type MockHost } from 'songstress/testing'
import { afterEach, describe, expect, it, vi } from 'vitest'
import manifest from './songstress.json' with { type: 'json' }

// The Apple Music the Mornye port's own tests stood in for (the worker's
// test_ext_real.py): music.apple.com's page embeds a developer token;
// lyrics come as TTML, for a Media User Token only. Against the SDK's mock
// host, given the manifest: a request to a host the manifest does not name
// is refused, as a server refuses it.

function devToken(): string {
  const part = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url')
  const now = Math.floor(Date.now() / 1000)
  return [part({ alg: 'ES256', kid: 'K' }), part({ iss: 'T', iat: now, exp: now + 86400 }), 'c2ln'].join('.')
}

const SONG = {
  id: '1499378615',
  type: 'songs',
  attributes: {
    name: 'Stub Song',
    artistName: 'Stub Band',
    albumName: 'Stub Album',
    durationInMillis: 200040,
    isrc: 'USSTB2000001',
    trackNumber: 3,
    releaseDate: '2020-03-20',
    artwork: { url: 'https://is1-ssl.mzstatic.com/image/thumb/Music/x/{w}x{h}bb.jpg' },
    url: 'https://music.apple.com/us/album/stub-song/1499378600?i=1499378615',
  },
}
const TTML =
  '<tt xmlns="http://www.w3.org/ns/ttml" itunes:timing="Line"><head><metadata><iTunesMetadata><translations>' +
  '<translation xml:lang="es"><text for="L1">Hola</text></translation></translations></iTunesMetadata></metadata></head>' +
  '<body dur="00:10.000"><div>' +
  '<p begin="00:01.000" end="00:03.000" itunes:key="L1">Hello <span ttm:role="x-bg"><span begin="1.5">(oh)</span></span>stub</p>' +
  '<p begin="00:03.500" end="00:05.000" itunes:key="L2">Second &amp; last line</p>' +
  '</div></body></tt>'

type Answer = Partial<NetResponse> | ((request: NetRequest) => Partial<NetResponse>)

const ok = (value: unknown): Answer => ({ body: JSON.stringify(value), headers: { 'content-type': 'application/json' } })
const page = (body: string): Answer => ({ body, headers: { 'content-type': 'text/html' } })
const answered = (answer: Answer, request: NetRequest) => (typeof answer === 'function' ? answer(request) : answer)

/** Apple's answers, by address, the first that fits: any other is a 404. */
let routes: [RegExp, Answer][] = []
let host: MockHost | undefined

async function start(settings: Record<string, SettingValue>): Promise<MockHost> {
  const mock = createMockHost({
    manifest,
    settings,
    fetch: (url, request) => answered(routes.find(([address]) => address.test(url))?.[1] ?? { status: 404, body: 'not found' }, request),
  })
  host = mock
  vi.resetModules()
  await import('./src/server')
  return mock
}

async function apple(settings: Record<string, SettingValue>): Promise<MockHost> {
  routes = [
    [/^https:\/\/music\.apple\.com\/us\/browse$/, page(`<iframe src="https://embed.music.apple.com/?devToken=${devToken()}"></iframe>`)],
    [/amp-api\.music\.apple\.com\/v1\/catalog\/us\/search\?/, ok({ results: { songs: { data: [SONG] } } })],
    [/amp-api\.music\.apple\.com\/v1\/catalog\/us\/albums\?/, ok({ data: [] })],
    [
      /\/v1\/catalog\/us\/songs\/1499378615\/syllable-lyrics/,
      (request) => answered(request.headers?.['media-user-token'] === 'mut-123' ? ok({ data: [{ attributes: { ttml: TTML } }] }) : { status: 401, body: '' }, request),
    ],
  ]
  return start(settings)
}

afterEach(() => host?.remove())

const query = { text: 'stub song', types: ['track' as const], limit: 5, offset: 0 }
const asked = (mock: MockHost, part: string) => mock.requests.some((request) => request.url.includes(part))

describe('the Apple Music port', () => {
  it('searches the catalogue with the token its page embeds, and joins iTunes', async () => {
    const mock = await apple({ storefront: 'us' })
    const found = await mock.provider('search', 'apple-music').search(query, {})
    expect(found.tracks?.[0]).toMatchObject({
      id: '1499378615',
      title: 'Stub Song',
      artists: ['Stub Band'],
      isrc: 'USSTB2000001',
      albumId: '1499378600',
      ids: { itunes: '1499378615' },
      coverUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music/x/1200x1200bb.jpg',
    })
    expect(mock.requests.every((request) => request.request.headers?.['user-agent']?.startsWith('Mozilla/5.0 '))).toBe(true)
  })

  it('finds the token in a script larger than one request may answer, by asking for it gzipped', async () => {
    const now = Math.floor(Date.now() / 1000)
    const claims = Buffer.from(JSON.stringify({ iss: 'AMPWebPlay', iat: now, exp: now + 86400 })).toString('base64url')
    const token = `eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IldlYlBsYXlLaWQifQ.${claims}.c2ln`
    const script = `${'var a=1;'.repeat(125_000)}const t="${token}";${'var b=2;'.repeat(250_000)}`
    const asked: (string | undefined)[] = []
    routes = [
      [/^https:\/\/music\.apple\.com\/us\/browse$/, page('<script type="module" crossorigin src="/assets/index~B8RK.js"></script>')],
      [
        /^https:\/\/music\.apple\.com\/assets\/index~B8RK\.js$/,
        (request) => {
          asked.push(request.headers?.['accept-encoding'], request.responseEncoding)
          // Three megabytes unpacked, the token a megabyte in, as Apple's own script is: past what the host
          // answers in one request, so refused as the host refuses it unless asked for gzipped.
          if (request.headers?.['accept-encoding'] !== 'gzip') throw new SongstressError('limit-exceeded', 'net.fetch: the answer is larger than 2621440 bytes')
          return { headers: { 'content-encoding': 'gzip' }, body: gzipSync(script).toString('base64') }
        },
      ],
      [
        /amp-api\.music\.apple\.com\/v1\/catalog\/us\/search\?/,
        (request) => answered(request.headers?.authorization === `Bearer ${token}` ? ok({ results: { songs: { data: [SONG] } } }) : { status: 401, body: '' }, request),
      ],
      [/amp-api\.music\.apple\.com\/v1\/catalog\/us\/albums\?/, ok({ data: [] })],
    ]
    const mock = await start({ storefront: 'us' })
    const found = await mock.provider('search', 'apple-music').search(query, {})
    expect(found.tracks?.[0]?.id).toBe('1499378615')
    // Asked for as it is first, which the host refuses as too large; then gzipped, as bytes.
    expect(asked).toEqual([undefined, undefined, 'gzip', 'base64'])
  })

  it('finds synced lyrics with your own Media User Token, a translation as a line of its own', async () => {
    const mock = await apple({ storefront: 'us', mediaUserToken: 'mut-123', lyricsTranslation: 'es' })
    const answer = await mock.provider('lyrics', 'apple-music').find({ title: 'Stub Song', artist: 'Stub Band', album: 'Stub Album', durationS: 200 }, {})
    expect(answer).toEqual({
      status: 'found',
      synced: true,
      lines: [
        { text: 'Hello stub (oh)', startS: 1 },
        { text: 'Hola', startS: 1 },
        { text: 'Second & last line', startS: 3.5 },
      ],
    })
  })

  it('asks for no lyrics without a Media User Token, and says so when Apple refuses one', async () => {
    const mock = await apple({ storefront: 'us' })
    expect(await mock.provider('lyrics', 'apple-music').find({ title: 'Stub Song', artist: 'Stub Band' }, {})).toEqual({ status: 'none' })
    expect(asked(mock, 'lyrics')).toBe(false)
    mock.remove()
    const refused = await apple({ storefront: 'us', mediaUserToken: 'stale' })
    await expect(refused.provider('lyrics', 'apple-music').find({ title: 'Stub Song', artist: 'Stub Band' }, {})).rejects.toMatchObject({
      code: 'sign-in-required',
    })
  })

  it('fills a song with its ISRC, and reads a song link in its storefront', async () => {
    const mock = await apple({ storefront: 'us' })
    routes.push([/\/v1\/catalog\/(us|gb)\/songs\/1499378615\?/, ok({ data: [SONG] })])
    expect(await mock.provider('metadata', 'apple-music').enrich!({ title: 'Stub Song', artist: 'Stub Band', durationS: 200 }, {})).toMatchObject({
      isrc: 'USSTB2000001',
      ids: { itunes: '1499378615' },
    })
    const link = await mock.provider('links', 'apple-music').resolve('https://music.apple.com/gb/album/stub-song/1499378600?i=1499378615', {})
    expect(link).toMatchObject({ type: 'track', track: { id: '1499378615' } })
    expect(asked(mock, '/catalog/gb/songs/1499378615')).toBe(true)
  })
})
