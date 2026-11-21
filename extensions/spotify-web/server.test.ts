import { describe, expect, it } from 'vitest'
import { load, ok, onlyTo, page, type StandIn } from '../shared/testing'
import manifest from './songstress.json' with { type: 'json' }
import { codeFor } from './src/totp'

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

async function spotify(): Promise<StandIn> {
  const stand = await load(() => import('./src/server'))
  const config = Buffer.from(JSON.stringify({ clientVersion: '1.2.52.404' })).toString('base64')
  stand.routes.push(
    ['GET', /^https:\/\/open\.spotify\.com$/, { ...page(`<script id="appServerConfig" type="text/plain">${config}</script>`), headers: { 'set-cookie': 'sp_t=device-1; Expires=Wed, 21 Oct 2027 07:28:00 GMT; Path=/, sp_landing=x' } }],
    ['GET', /^https:\/\/open\.spotify\.com\/api\/token\?reason=init&productType=web-player&totp=\d{6}&totpVer=61&totpServer=\d{6}$/, ok({ accessToken: 'access-1', clientId: 'client-1', accessTokenExpirationTimestampMs: Date.now() + 3600_000 })],
    ['POST', /^https:\/\/clienttoken\.spotify\.com\/v1\/clienttoken$/, ok({ response_type: 'RESPONSE_GRANTED_TOKEN_RESPONSE', granted_token: { token: 'client-token-1', expires_after_seconds: 1209600 } })],
    ['POST', /^https:\/\/api-partner\.spotify\.com\/pathfinder\/v2\/query$/, (_url, request) => ok(query(JSON.parse(request.body ?? '{}').operationName))],
    ['GET', /spclient\.wg\.spotify\.com\/metadata\/4\/track\/[0-9a-f]{32}\?market=from_token/, { status: 200, body: Buffer.from(METADATA).toString('base64') }],
    ['GET', /api\.deezer\.com\/track\/isrc:GBARL9300135/, ok({ id: 781592622 })],
  )
  return stand
}

describe('the Spotify Web port', () => {
  it('makes the one-time code RFC 6238 does', () => {
    const key = [...Buffer.from('12345678901234567890')]
    expect(codeFor(key, 59_000)).toBe('287082')
    expect(codeFor(key, 1111111109_000)).toBe('081804')
  })

  it('searches as the web player does, its session kept, and joins Spotify', async () => {
    const stand = await spotify()
    const found = (await stand.ask('search', 'spotify-web', 'search', { text: 'never gonna', types: ['track'], limit: 10, offset: 0 })) as {
      tracks: Record<string, unknown>[]
    }
    expect(found.tracks[0]).toMatchObject({
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
    expect((stand.store.get('session') as { value: { deviceId: string } }).value.deviceId).toBe('device-1')
    expect(onlyTo(stand, manifest.permissions.network.hosts)).toBe(true)
  })

  it("fills a track with its ISRC from Spotify's own metadata, and Deezer's id", async () => {
    const stand = await spotify()
    const facts = await stand.ask('metadata', 'spotify-web', 'enrich', { title: 'Never Gonna Give You Up', artist: 'Rick Astley', ids: { spotify: TRACK_ID } })
    expect(facts).toEqual({ isrc: 'GBARL9300135', label: 'RCA Records Label', genre: 'dance pop', ids: { spotify: TRACK_ID, deezer: '781592622' } })
  })

  it('reads open.spotify.com, intl- and spotify: links', async () => {
    const stand = await spotify()
    for (const link of [`https://open.spotify.com/track/${TRACK_ID}`, `https://open.spotify.com/intl-de/track/${TRACK_ID}?si=x`, `spotify:track:${TRACK_ID}`]) {
      expect(await stand.ask('links', 'spotify-web', 'resolve', link)).toMatchObject({ type: 'track', track: { id: TRACK_ID } })
    }
    expect(await stand.ask('links', 'spotify-web', 'resolve', 'https://open.spotify.com/show/x')).toBeNull()
  })
})
