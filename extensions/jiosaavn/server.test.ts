import { createMockHost, type MockHost } from 'songstress/testing'
import { afterEach, describe, expect, it, vi } from 'vitest'
import manifest from './songstress.json' with { type: 'json' }

// Against the SDK's mock host, given the manifest: a request to a host the
// manifest does not name is refused, as a server refuses it.

// The JioSaavn the Mornye port's own tests stood in for (the worker's
// test_ext_real.py). Its media address is sealed with single DES under
// "38346591", as JioSaavn's web player has it:
// https://aac.saavncdn.com/123/0123456789abcdef0123456789abcdef_96.mp4
const SEALED = 'ID2ieOjCrwfgWvL5sXl4B1ImC5QfbsDyUYDE58xKVbX7cB4CopojR3eyfbQqMaX/+3AeAqKaI0cwJkTpnkR0Xxw7tS9a8Gtq'
const SONG = {
  id: 'AbCdEf12',
  title: 'Tum Hi Ho',
  subtitle: 'Arijit Singh - Aashiqui 2',
  type: 'song',
  perma_url: 'https://www.jiosaavn.com/song/tum-hi-ho/EToxUyFpcwQ',
  image: 'https://c.saavncdn.com/430/Aashiqui-2-Hindi-2013-150x150.jpg',
  language: 'hindi',
  year: '2013',
  more_info: {
    duration: '262',
    album: 'Aashiqui 2',
    album_id: '1139549',
    release_date: '2013-03-29',
    encrypted_media_url: SEALED,
    artistMap: { primary_artists: [{ id: '459320', name: 'Arijit Singh' }] },
  },
}

/** JioSaavn's answers, by address: any other is a 404. */
let routes: [RegExp, unknown][] = []
let host: MockHost

async function jiosaavn(): Promise<MockHost> {
  routes = [
    [/www\.jiosaavn\.com\/api\.php\?__call=search\.getResults&/, { total: 1, results: [SONG] }],
    [/www\.jiosaavn\.com\/api\.php\?__call=song\.getDetails&.*pids=AbCdEf12/, { songs: [SONG] }],
  ]
  host = createMockHost({
    manifest,
    settings: { lang: 'hindi, english' },
    fetch: (url) => {
      const found = routes.find(([address]) => address.test(url))
      return found ? { body: JSON.stringify(found[1]), headers: { 'content-type': 'application/json' } } : { status: 404, body: 'not found' }
    },
  })
  vi.resetModules()
  await import('./src/server')
  return host
}

afterEach(() => host.remove())

describe('the JioSaavn port', () => {
  it('searches, in the languages the admin chose', async () => {
    const saavn = await jiosaavn()
    const found = await saavn.provider('search', 'jiosaavn').search({ text: 'tum hi ho', types: ['track'], limit: 20, offset: 0 }, {})
    expect(found.tracks?.[0]).toMatchObject({
      id: 'AbCdEf12',
      title: 'Tum Hi Ho',
      artists: ['Arijit Singh'],
      album: 'Aashiqui 2',
      durationS: 262,
      coverUrl: 'https://c.saavncdn.com/430/Aashiqui-2-Hindi-2013-500x500.jpg',
    })
    expect(saavn.requests[0]?.request.headers).toMatchObject({ 'user-agent': expect.stringMatching(/^Mozilla\/5\.0 /), cookie: expect.stringContaining('L=hindi%2Cenglish') })
  })

  it('finds the song to acquire, and hands out its address at the quality asked, opened', async () => {
    const download = (await jiosaavn()).provider('download', 'jiosaavn')
    expect(await download.check({ title: 'Tum Hi Ho', artist: 'Arijit Singh', durationS: 262 }, {})).toEqual({
      available: true,
      id: 'AbCdEf12',
    })
    const where = await download.locate({ id: 'AbCdEf12', quality: 'aac-320' }, {})
    expect(where?.location).toEqual({
      kind: 'file',
      url: 'https://aac.saavncdn.com/123/0123456789abcdef0123456789abcdef_320.mp4',
      container: 'm4a',
      headers: { referer: 'https://www.jiosaavn.com/' },
    })
  })

  it('takes no song that is not this one', async () => {
    const download = (await jiosaavn()).provider('download', 'jiosaavn')
    expect(await download.check({ title: 'Tum Hi Ho', artist: 'Someone Else', durationS: 262 }, {})).toEqual({ available: false })
    expect(await download.check({ title: 'Tum Hi Ho', artist: 'Arijit Singh', durationS: 200 }, {})).toEqual({ available: false })
  })

  it('reads a song link by its token', async () => {
    const saavn = await jiosaavn()
    routes.push([/__call=webapi\.get&.*token=EToxUyFpcwQ/, { songs: [SONG] }])
    const link = await saavn.provider('links', 'jiosaavn').resolve('https://www.jiosaavn.com/song/tum-hi-ho/EToxUyFpcwQ', {})
    expect(link).toMatchObject({ type: 'track', track: { id: 'AbCdEf12', title: 'Tum Hi Ho' } })
  })
})
