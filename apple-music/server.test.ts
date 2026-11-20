import { describe, expect, it } from 'vitest'
import { load, ok, onlyTo, page, type StandIn } from '../shared/testing'
import manifest from './songstress.json' with { type: 'json' }

// The Apple Music the Mornye port's own tests stood in for (the worker's
// test_ext_real.py): music.apple.com's page embeds a developer token;
// lyrics come as TTML, for a Media User Token only.

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

async function apple(settings: Record<string, unknown>): Promise<StandIn> {
  const stand = await load(() => import('./src/server'), settings)
  stand.routes.push(
    ['GET', /^https:\/\/music\.apple\.com\/us\/browse$/, page(`<iframe src="https://embed.music.apple.com/?devToken=${devToken()}"></iframe>`)],
    ['GET', /amp-api\.music\.apple\.com\/v1\/catalog\/us\/search\?/, ok({ results: { songs: { data: [SONG] } } })],
    ['GET', /amp-api\.music\.apple\.com\/v1\/catalog\/us\/albums\?/, ok({ data: [] })],
    [
      'GET',
      /\/v1\/catalog\/us\/songs\/1499378615\/syllable-lyrics/,
      (_url, request) =>
        request.headers?.['media-user-token'] === 'mut-123' ? ok({ data: [{ attributes: { ttml: TTML } }] }) : { status: 401, body: '' },
    ],
  )
  return stand
}

describe('the Apple Music port', () => {
  it('searches the catalogue with the token its page embeds, and joins iTunes', async () => {
    const stand = await apple({ storefront: 'us' })
    const found = (await stand.ask('search', 'apple-music', 'search', { text: 'stub song', types: ['track'], limit: 5, offset: 0 })) as {
      tracks: Record<string, unknown>[]
    }
    expect(found.tracks[0]).toMatchObject({
      id: '1499378615',
      title: 'Stub Song',
      artists: ['Stub Band'],
      isrc: 'USSTB2000001',
      albumId: '1499378600',
      ids: { itunes: '1499378615' },
      coverUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music/x/1200x1200bb.jpg',
    })
    expect(onlyTo(stand, manifest.permissions.network.hosts)).toBe(true)
  })

  it('finds synced lyrics with your own Media User Token, a translation as a line of its own', async () => {
    const stand = await apple({ storefront: 'us', mediaUserToken: 'mut-123', lyricsTranslation: 'es' })
    const answer = await stand.ask('lyrics', 'apple-music', 'find', { title: 'Stub Song', artist: 'Stub Band', album: 'Stub Album', durationS: 200 })
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
    const stand = await apple({ storefront: 'us' })
    expect(await stand.ask('lyrics', 'apple-music', 'find', { title: 'Stub Song', artist: 'Stub Band' })).toEqual({ status: 'none' })
    expect(stand.seen.some((line) => line.includes('lyrics'))).toBe(false)
    const refused = await apple({ storefront: 'us', mediaUserToken: 'stale' })
    await expect(refused.ask('lyrics', 'apple-music', 'find', { title: 'Stub Song', artist: 'Stub Band' })).rejects.toMatchObject({
      code: 'sign-in-required',
    })
  })

  it('fills a song with its ISRC, and reads a song link in its storefront', async () => {
    const stand = await apple({ storefront: 'us' })
    stand.routes.push(['GET', /\/v1\/catalog\/(us|gb)\/songs\/1499378615\?/, ok({ data: [SONG] })])
    expect(await stand.ask('metadata', 'apple-music', 'enrich', { title: 'Stub Song', artist: 'Stub Band', durationS: 200 })).toMatchObject({
      isrc: 'USSTB2000001',
      ids: { itunes: '1499378615' },
    })
    const link = await stand.ask('links', 'apple-music', 'resolve', 'https://music.apple.com/gb/album/stub-song/1499378600?i=1499378615')
    expect(link).toMatchObject({ type: 'track', track: { id: '1499378615' } })
    expect(stand.seen.some((line) => line.includes('/catalog/gb/songs/1499378615'))).toBe(true)
  })
})
