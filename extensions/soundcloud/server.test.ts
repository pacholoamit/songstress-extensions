import { gzipSync } from 'node:zlib'
import { SongstressError, type NetRequest, type NetResponse } from 'songstress/server'
import { createMockHost, type MockHost } from 'songstress/testing'
import { afterEach, describe, expect, it, vi } from 'vitest'
import manifest from './songstress.json' with { type: 'json' }

// The SoundCloud the Mornye port's own tests stood in for (the worker's
// test_ext_real.py): its page hands out the client id through a script
// bundle; a track streams AAC over HLS in two segments. Against the SDK's
// mock host, given the manifest: a request to a host the manifest does not
// name is refused, as a server refuses it.

const CLIENT_ID = 'a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6'
const TRACK = {
  id: 1234567890,
  kind: 'track',
  title: 'Midnight Drive',
  duration: 2000,
  full_duration: 2000,
  access: 'playable',
  streamable: true,
  track_authorization: 'auth-token',
  permalink_url: 'https://soundcloud.com/stub-artist/midnight-drive',
  artwork_url: 'https://i1.sndcdn.com/artworks-000abc-def-large.jpg',
  display_date: '2025-06-01T00:00:00Z',
  genre: 'Synthwave',
  user: { id: 42, username: 'Stub Artist' },
  publisher_metadata: { artist: 'Stub Artist', isrc: 'QZABC2500001' },
  media: {
    transcodings: [
      {
        url: 'https://api-v2.soundcloud.com/media/soundcloud:tracks:1234567890/abc/stream/hls',
        preset: 'aac_160k',
        snipped: false,
        format: { protocol: 'hls', mime_type: 'audio/mp4; codecs="mp4a.40.2"' },
        quality: 'sq',
      },
      {
        url: 'https://api-v2.soundcloud.com/media/soundcloud:tracks:1234567890/abc/preview/progressive',
        preset: 'mp3_0_0',
        snipped: true,
        format: { protocol: 'progressive', mime_type: 'audio/mpeg' },
      },
    ],
  },
}
const PLAYLIST = '#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:1\n#EXT-X-MEDIA-SEQUENCE:0\n#EXTINF:1.0,\n../seg/0.aac\n#EXTINF:1.0,\n../seg/1.aac\n#EXT-X-ENDLIST\n'

type Answer = Partial<NetResponse> | ((request: NetRequest) => Partial<NetResponse>)

const ok = (value: unknown): Answer => ({ body: JSON.stringify(value), headers: { 'content-type': 'application/json' } })
const page = (body: string): Answer => ({ body, headers: { 'content-type': 'text/html' } })
/** A script past what the host answers in one request: refused as the host
 * refuses it, unless it is asked for gzipped, as base64. */
const large = (text: string): Answer => (request) => {
  if (request.headers?.['accept-encoding'] !== 'gzip' || request.responseEncoding !== 'base64') {
    throw new SongstressError('limit-exceeded', 'net.fetch: the answer is larger than 2621440 bytes')
  }
  return { headers: { 'content-encoding': 'gzip' }, body: gzipSync(text).toString('base64') }
}

/** SoundCloud's answers, by address, the first that fits: any other is a 404. */
let routes: [RegExp, Answer][] = []
let host: MockHost

async function soundcloud(): Promise<MockHost> {
  routes = [
    [/^https:\/\/soundcloud\.com\/$/, page('<html><script crossorigin src="https://a-v2.sndcdn.com/assets/49-4d5e6f.js"></script></html>')],
    // The script that holds the client id, three megabytes unpacked as SoundCloud's own is: handed over gzipped.
    [/\/assets\/49-4d5e6f\.js$/, large(`${'var a=1;'.repeat(375_000)}n.exports={client_id:"${CLIENT_ID}"}`)],
    [/api-v2\.soundcloud\.com\/search\/tracks\?/, ok({ collection: [TRACK] })],
    [/api-v2\.soundcloud\.com\/tracks\/1234567890\?/, ok(TRACK)],
    [/api-v2\.soundcloud\.com\/media\/.*\/stream\/hls\?.*track_authorization=auth-token/, ok({ url: 'https://cf-hls-media.sndcdn.com/playlist/abc/def/playlist.m3u8?P=1' })],
    [/cf-hls-media\.sndcdn\.com\/playlist\/abc\/def\/playlist\.m3u8/, page(PLAYLIST)],
    [/api-v2\.soundcloud\.com\/resolve\?url=https%3A%2F%2Fsoundcloud\.com%2Fstub-artist%2Fmidnight-drive/, ok(TRACK)],
  ]
  return start()
}

async function start(): Promise<MockHost> {
  host = createMockHost({
    manifest,
    fetch: (url, request) => {
      const answer = routes.find(([address]) => address.test(url))?.[1] ?? { status: 404, body: 'not found' }
      return typeof answer === 'function' ? answer(request) : answer
    },
  })
  vi.resetModules()
  await import('./src/server')
  return host
}

afterEach(() => host.remove())

const asked = (mock: MockHost, part: string) => mock.requests.some((request) => request.url.includes(part))
const query = { text: 'midnight drive', types: ['track' as const], limit: 5, offset: 0 }

describe('the SoundCloud port', () => {
  it('reads a script small enough for one request as it is', async () => {
    const mock = await soundcloud()
    routes.unshift([/\/assets\/49-4d5e6f\.js$/, page(`n.exports={client_id:"${CLIENT_ID}"}`)])
    await mock.provider('search', 'soundcloud').search(query, {})
    expect(asked(mock, `client_id=${CLIENT_ID}`)).toBe(true)
  })

  it('searches through the client id its site hands out', async () => {
    const mock = await soundcloud()
    const found = await mock.provider('search', 'soundcloud').search(query, {})
    expect(found.tracks?.[0]).toMatchObject({ id: '1234567890', title: 'Midnight Drive', artists: ['Stub Artist'], isrc: 'QZABC2500001', durationS: 2 })
    expect(found.tracks?.[0]?.coverUrl).toBe('https://i1.sndcdn.com/artworks-000abc-def-original.jpg')
    expect(asked(mock, `client_id=${CLIENT_ID}`)).toBe(true)
    // The client id is kept, so the next search asks the site nothing.
    expect(mock.calls.some((call) => call.member === 'storage.set' && call.args[0] === 'client-id')).toBe(true)
    expect(mock.requests.every((request) => request.request.headers?.['user-agent']?.startsWith('Mozilla/5.0 '))).toBe(true)
  })

  it('finds the track to acquire and hands out its segments, joined by Songstress', async () => {
    const download = (await soundcloud()).provider('download', 'soundcloud')
    expect(await download.check({ title: 'Midnight Drive', artist: 'Stub Artist', durationS: 2 }, {})).toEqual({ available: true, id: '1234567890' })
    expect(await download.locate({ id: '1234567890', quality: 'aac-160' }, {})).toEqual({
      location: {
        kind: 'segments',
        urls: ['https://cf-hls-media.sndcdn.com/playlist/abc/seg/0.aac', 'https://cf-hls-media.sndcdn.com/playlist/abc/seg/1.aac'],
        initUrl: undefined,
        container: 'm4a',
      },
      tags: { isrc: 'QZABC2500001' },
    })
  })

  it('plays only a whole progressive stream: a preview never', async () => {
    const mock = await soundcloud()
    expect(await mock.provider('play', 'soundcloud').resolve({ id: '1234567890', title: 'Midnight Drive', artists: [] }, {})).toBeNull()
  })

  it('reads a pasted link, and a track it does not know is nothing', async () => {
    const mock = await soundcloud()
    expect(await mock.provider('links', 'soundcloud').resolve('https://m.soundcloud.com/stub-artist/midnight-drive', {})).toMatchObject({
      type: 'track',
      track: { id: '1234567890' },
    })
    const lookup = mock.provider('lookup', 'soundcloud')
    expect(await lookup.track!('999', {})).toBeNull()
    expect(await lookup.track!('not-an-id', {})).toBeNull()
  })

  it('says SoundCloud is unavailable when its site hands out no client id', async () => {
    routes = []
    const mock = await start()
    await expect(mock.provider('search', 'soundcloud').search({ ...query, text: 'x' }, {})).rejects.toMatchObject({
      name: 'ProviderFailure',
      code: 'unavailable',
    })
  })
})
