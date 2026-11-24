import type { NetRequest, NetResponse } from 'songstress/server'
import { createMockHost, type MockHost } from 'songstress/testing'
import { afterEach, describe, expect, it, vi } from 'vitest'
import manifest from './songstress.json' with { type: 'json' }
import { codeFor } from './src/totp'

// Against the SDK's mock host, given the manifest: a request to a host the
// manifest does not name is refused, as a server refuses it.

const TRACK_ID = '4uLU6hMCjMI75M1A2tKUQC'
const ALBUM_ID = '1ATL5GLyefJaxhQzSPVrLX'
const TRACK = {
  uri: `spotify:track:${TRACK_ID}`,
  name: 'Never Gonna Give You Up',
  trackNumber: 1,
  discNumber: 1,
  duration: { totalMilliseconds: 213573 },
  contentRating: { label: 'NONE' },
  artists: { items: [{ uri: 'spotify:artist:0gxyHStUsqpMadRV0Di1Qt', profile: { name: 'Rick Astley' } }] },
  albumOfTrack: {
    uri: `spotify:album:${ALBUM_ID}`,
    name: 'Whenever You Need Somebody',
    date: { isoString: '1987-11-12T00:00:00Z' },
    coverArt: { sources: [{ url: 'https://i.scdn.co/image/ab67616d0000b273abc', width: 640, height: 640 }] },
  },
}

/** A protobuf message of length-delimited fields. */
function message(fields: [number, number[] | string][]): number[] {
  const out: number[] = []
  for (const [n, value] of fields) {
    const bytes = typeof value === 'string' ? [...Buffer.from(value)] : value
    out.push((n << 3) | 2, bytes.length, ...bytes)
  }
  return out
}

const METADATA = message([
  [3, message([[5, 'RCA Records Label'], [8, 'dance pop']])],
  [10, message([[1, 'isrc'], [2, 'gbarl9300135']])],
])

function query(operation: string): unknown {
  switch (operation) {
    case 'searchDesktop':
      return { data: { searchV2: { tracksV2: { items: [{ item: { data: TRACK } }] } } } }
    case 'getTrack':
      return { data: { trackUnion: TRACK } }
  }
  return {}
}

type Answer = Partial<NetResponse> | ((request: NetRequest) => Partial<NetResponse>)

const ok = (value: unknown): Answer => ({ body: JSON.stringify(value), headers: { 'content-type': 'application/json' } })
const config = Buffer.from(JSON.stringify({ clientVersion: '1.2.52.404' })).toString('base64')

/** Spotify's answers, by method and address: any other is a 404. */
const ROUTES: [string, RegExp, Answer][] = [
  ['GET', /^https:\/\/open\.spotify\.com$/, { body: `<script id="appServerConfig" type="text/plain">${config}</script>`, headers: { 'content-type': 'text/html', 'set-cookie': 'sp_t=device-1; Expires=Wed, 21 Oct 2027 07:28:00 GMT; Path=/, sp_landing=x' } }],
  ['GET', /^https:\/\/open\.spotify\.com\/api\/token\?reason=init&productType=web-player&totp=\d{6}&totpVer=61&totpServer=\d{6}$/, () => ok({ accessToken: 'access-1', clientId: 'client-1', accessTokenExpirationTimestampMs: Date.now() + 3600_000 }) as Partial<NetResponse>],
  ['POST', /^https:\/\/clienttoken\.spotify\.com\/v1\/clienttoken$/, ok({ response_type: 'RESPONSE_GRANTED_TOKEN_RESPONSE', granted_token: { token: 'client-token-1', expires_after_seconds: 1209600 } })],
  ['POST', /^https:\/\/api-partner\.spotify\.com\/pathfinder\/v2\/query$/, (request) => ok(query(JSON.parse(request.body ?? '{}').operationName)) as Partial<NetResponse>],
  ['GET', /spclient\.wg\.spotify\.com\/metadata\/4\/track\/[0-9a-f]{32}\?market=from_token/, { status: 200, body: Buffer.from(METADATA).toString('base64') }],
  ['GET', /api\.deezer\.com\/track\/isrc:GBARL9300135/, ok({ id: 781592622 })],
]

let host: MockHost | undefined

async function spotify(): Promise<MockHost> {
  const mock = createMockHost({
    manifest,
    fetch: (url, request) => {
      const route = ROUTES.find(([method, address]) => method === (request.method ?? 'GET') && address.test(url))
      const answer = route?.[2] ?? { status: 404, body: 'not found' }
      return typeof answer === 'function' ? answer(request) : answer
    },
  })
  host = mock
  vi.resetModules()
  await import('./src/server')
  return mock
}

afterEach(() => host?.remove())

describe('the Spotify Web port', () => {
  it('makes the one-time code RFC 6238 does', () => {
    const key = [...Buffer.from('12345678901234567890')]
    expect(codeFor(key, 59_000)).toBe('287082')
    expect(codeFor(key, 1111111109_000)).toBe('081804')
  })

  it('searches as the web player does, its session kept, and joins Spotify', async () => {
    const mock = await spotify()
    const found = await mock.provider('search', 'spotify-web').search({ text: 'never gonna', types: ['track'], limit: 10, offset: 0 }, {})
    expect(found.tracks?.[0]).toMatchObject({
      id: TRACK_ID,
      title: 'Never Gonna Give You Up',
      artists: ['Rick Astley'],
      album: 'Whenever You Need Somebody',
      albumId: ALBUM_ID,
      releaseDate: '1987-11-12',
      durationS: 213.573,
      ids: { spotify: TRACK_ID },
      coverUrl: 'https://i.scdn.co/image/ab67616d000082c1abc',
    })
    const kept = mock.calls.findLast((call) => call.member === 'storage.set' && call.args[0] === 'session')?.args[1] as { value: { deviceId: string } } | undefined
    expect(kept?.value.deviceId).toBe('device-1')
    expect(mock.requests.every((request) => request.request.headers?.['user-agent']?.startsWith('Mozilla/5.0 '))).toBe(true)
  })

  it("fills a track with its ISRC from Spotify's own metadata, and Deezer's id", async () => {
    const mock = await spotify()
    const facts = await mock.provider('metadata', 'spotify-web').enrich!({ title: 'Never Gonna Give You Up', artist: 'Rick Astley', ids: { spotify: TRACK_ID } }, {})
    expect(facts).toEqual({ isrc: 'GBARL9300135', label: 'RCA Records Label', genre: 'dance pop', ids: { spotify: TRACK_ID, deezer: '781592622' } })
  })

  it('reads open.spotify.com, intl- and spotify: links', async () => {
    const links = (await spotify()).provider('links', 'spotify-web')
    for (const link of [`https://open.spotify.com/track/${TRACK_ID}`, `https://open.spotify.com/intl-de/track/${TRACK_ID}?si=x`, `spotify:track:${TRACK_ID}`]) {
      expect(await links.resolve(link, {})).toMatchObject({ type: 'track', track: { id: TRACK_ID } })
    }
    expect(await links.resolve('https://open.spotify.com/show/x', {})).toBeNull()
  })
})
