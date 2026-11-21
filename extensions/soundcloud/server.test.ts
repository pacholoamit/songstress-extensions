import { describe, expect, it } from 'vitest'
import { load, ok, onlyTo, page, type StandIn } from '../shared/testing'
import manifest from './songstress.json' with { type: 'json' }

// The SoundCloud the Mornye port's own tests stood in for (the worker's
// test_ext_real.py): its page hands out the client id through a script
// bundle; a track streams AAC over HLS in two segments.

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

async function soundcloud(): Promise<StandIn> {
  const stand = await load(() => import('./src/server'))
  stand.routes.push(
    ['GET', /^https:\/\/soundcloud\.com\/$/, page('<html><script crossorigin src="https://a-v2.sndcdn.com/assets/49-4d5e6f.js"></script></html>')],
    ['GET', /\/assets\/49-4d5e6f\.js$/, page(`n.exports={client_id:"${CLIENT_ID}"}`)],
    ['GET', /api-v2\.soundcloud\.com\/search\/tracks\?/, ok({ collection: [TRACK] })],
    ['GET', /api-v2\.soundcloud\.com\/tracks\/1234567890\?/, ok(TRACK)],
    ['GET', /api-v2\.soundcloud\.com\/media\/.*\/stream\/hls\?.*track_authorization=auth-token/, ok({ url: 'https://cf-hls-media.sndcdn.com/playlist/abc/def/playlist.m3u8?P=1' })],
    ['GET', /cf-hls-media\.sndcdn\.com\/playlist\/abc\/def\/playlist\.m3u8/, page(PLAYLIST)],
    ['GET', /api-v2\.soundcloud\.com\/resolve\?url=https%3A%2F%2Fsoundcloud\.com%2Fstub-artist%2Fmidnight-drive/, ok(TRACK)],
  )
  return stand
}

describe('the SoundCloud port', () => {
  it('searches through the client id its site hands out', async () => {
    const stand = await soundcloud()
    const found = (await stand.ask('search', 'soundcloud', 'search', { text: 'midnight drive', types: ['track'], limit: 5, offset: 0 })) as {
      tracks: { id: string; title: string; artists: string[]; isrc?: string; durationS?: number; coverUrl?: string }[]
    }
    expect(found.tracks[0]).toMatchObject({ id: '1234567890', title: 'Midnight Drive', artists: ['Stub Artist'], isrc: 'QZABC2500001', durationS: 2 })
    expect(found.tracks[0]!.coverUrl).toBe('https://i1.sndcdn.com/artworks-000abc-def-original.jpg')
    expect(stand.seen.some((line) => line.includes(`client_id=${CLIENT_ID}`))).toBe(true)
    // The client id is kept, so the next search asks the site nothing.
    expect(stand.store.has('client-id')).toBe(true)
    expect(onlyTo(stand, manifest.permissions.network.hosts)).toBe(true)
  })

  it('finds the track to acquire and hands out its segments, joined by Songstress', async () => {
    const stand = await soundcloud()
    const check = await stand.ask('download', 'soundcloud', 'check', { title: 'Midnight Drive', artist: 'Stub Artist', durationS: 2 })
    expect(check).toEqual({ available: true, id: '1234567890' })
    const where = await stand.ask('download', 'soundcloud', 'locate', { id: '1234567890', quality: 'aac-160' })
    expect(where).toEqual({
      location: {
        kind: 'segments',
        urls: ['https://cf-hls-media.sndcdn.com/playlist/abc/seg/0.aac', 'https://cf-hls-media.sndcdn.com/playlist/abc/seg/1.aac'],
        initUrl: undefined,
        container: 'm4a',
      },
      tags: { isrc: 'QZABC2500001' },
    })
    expect(onlyTo(stand, manifest.permissions.network.hosts)).toBe(true)
  })

  it('plays only a whole progressive stream: a preview never', async () => {
    const stand = await soundcloud()
    expect(await stand.ask('play', 'soundcloud', 'resolve', { id: '1234567890', title: 'Midnight Drive', artists: [] })).toBeNull()
  })

  it('reads a pasted link, and a track it does not know is nothing', async () => {
    const stand = await soundcloud()
    const link = (await stand.ask('links', 'soundcloud', 'resolve', 'https://m.soundcloud.com/stub-artist/midnight-drive')) as { type: string; track: { id: string } }
    expect(link).toMatchObject({ type: 'track', track: { id: '1234567890' } })
    expect(await stand.ask('lookup', 'soundcloud', 'track', '999')).toBeNull()
    expect(await stand.ask('lookup', 'soundcloud', 'track', 'not-an-id')).toBeNull()
  })

  it('says SoundCloud is unavailable when its site hands out no client id', async () => {
    const stand = await load(() => import('./src/server'))
    await expect(stand.ask('search', 'soundcloud', 'search', { text: 'x', types: ['track'], limit: 5, offset: 0 })).rejects.toMatchObject({
      name: 'ProviderFailure',
      code: 'unavailable',
    })
  })
})
