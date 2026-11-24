import { createMockHost, type MockHost } from 'songstress/testing'
import { afterEach, describe, expect, it, vi } from 'vitest'
import manifest from './songstress.json' with { type: 'json' }

// Against the SDK's mock host, given the manifest: a request to a host the
// manifest does not name is refused, as a server refuses it.

// Pages shaped as Genie's are (read from www.genie.co.kr on 2026-11-18):
// rows of <tr class="list" songid=…>, ids in its own fnViewArtist and
// fnViewAlbumLayer calls, a detail page's facts in <ul class="info-data">.

const ROW = (id: string, n: number, title: string) => `
  <tr class="list" songid="${id}">
    <td class="number">${n}</td>
    <td><a href="#" class="cover" onclick="fnViewAlbumLayer('88135998');return false;"><img src="//image.genie.co.kr/Y/IMAGE/IMG_ALBUM/088/135/998/88135998_1_600x600.JPG/dims/resize/Q_80,0" /></a></td>
    <td class="info">
      <a href="#" class="title ellipsis" title="${title}" onclick="fnPlaySong('${id};','1');return false;"><span class="icon icon-title">TITLE</span> ${title}</a>
      <a href="#" class="artist ellipsis" onclick="fnViewArtist('67872918');return false;">아이유 (<span class="t_point">IU</span>)</a>
      <a href="#" class="albumtitle ellipsis" onclick="fnViewAlbumLayer('88135998');return false;">이 별로부터</a>
    </td>
  </tr>`

const SEARCH = `<table><tbody>${ROW('116789224', 1, 'Dear my crazy soulmate')}${ROW('116789223', 2, '이 별로부터')}</tbody></table>`
const SONG = `<html><head><meta property="og:image" content="http://image.genie.co.kr/Y/IMAGE/IMG_ALBUM/088/135/998/88135998_1_600x600.JPG" /></head>
  <h2 class="name">Dear my crazy soulmate</h2>
  <ul class="info-data">
    <li><span class="attr"><img src="//image.genie.co.kr/imageg/web/detail/txt_5.png" alt="아이유 (IU)" /></span> <span class="value"><a href="#" onclick="fnGoMore('artistInfo','67872918');return false;">아이유 (IU)</a></span>
    <li><span class="attr"><img src="//image.genie.co.kr/imageg/web/detail/txt_6.png" alt="이 별로부터" /></span> <span class="value"><a href="#" onclick="fnGoMore('albumInfo','88135998');return false;">이 별로부터</a></span></li>
    <li><span class="attr"><img src="//image.genie.co.kr/imageg/web/detail/txt_8.png" alt="재생시간" /></span> <span class="value">02:36</span></li>
  </ul></html>`
const ALBUM = `<html><head><meta property="og:image" content="http://image.genie.co.kr/Y/IMAGE/IMG_ALBUM/088/135/998/88135998_1_600x600.JPG" /></head>
  <h2 class="name">이 별로부터</h2>
  <ul class="info-data">
    <li><span class="attr"><img src="x.png" alt="아티스트" /></span> <span class="value"><a href="#" onclick="fnGoMore('artistInfo','67872918');return false;">아이유 (IU)</a></span></li>
    <li><span class="attr"><img src="x.png" alt="발매일" /></span> <span class="value">2026.09.10
    </span></li>
  </ul>${SEARCH}</html>`

/** Genie's pages, by address: any other is a 404. */
const PAGES: [RegExp, string][] = [
  [/^https:\/\/www\.genie\.co\.kr\/search\/searchSong\?query=IU&pg=1$/, SEARCH],
  [/^https:\/\/www\.genie\.co\.kr\/detail\/songInfo\?xgnm=116789224$/, SONG],
  [/^https:\/\/www\.genie\.co\.kr\/detail\/albumInfo\?axnm=88135998$/, ALBUM],
]

let host: MockHost

async function genie(): Promise<MockHost> {
  host = createMockHost({
    manifest,
    fetch: (url) => {
      const body = PAGES.find(([address]) => address.test(url))?.[1]
      return body === undefined ? { status: 404, body: 'not found' } : { body, headers: { 'content-type': 'text/html' } }
    },
  })
  vi.resetModules()
  await import('./src/server')
  return host
}

afterEach(() => host.remove())

describe('the Genie port', () => {
  it("reads its search page's song rows", async () => {
    const genieMusic = await genie()
    const found = await genieMusic.provider('search', 'genie-music').search({ text: 'IU', types: ['track'], limit: 1, offset: 0 }, {})
    expect(found.tracks).toEqual([
      {
        id: '116789224',
        title: 'Dear my crazy soulmate',
        artists: ['아이유 (IU)'],
        artistId: '67872918',
        album: '이 별로부터',
        albumId: '88135998',
        trackNumber: undefined,
        releaseDate: undefined,
        coverUrl: 'https://image.genie.co.kr/Y/IMAGE/IMG_ALBUM/088/135/998/88135998_1_600x600.JPG',
        url: 'https://www.genie.co.kr/detail/songInfo?xgnm=116789224',
      },
    ])
    expect(genieMusic.requests.map((asked) => asked.request.headers?.['user-agent'])).toEqual([expect.stringMatching(/^Mozilla\/5\.0 /)])
  })

  it('opens a song and an album from their links', async () => {
    const genieMusic = await genie()
    const links = genieMusic.provider('links', 'genie-music')
    expect(await links.resolve('https://www.genie.co.kr/detail/songInfo?xgnm=116789224', {})).toMatchObject({
      type: 'track',
      track: { id: '116789224', title: 'Dear my crazy soulmate', artists: ['아이유 (IU)'], albumId: '88135998', durationS: 156 },
    })
    const album = await links.resolve('https://genie.co.kr/detail/albumInfo?axnm=88135998', {})
    if (album?.type !== 'album') throw new Error('not an album')
    expect(album.album).toMatchObject({ title: '이 별로부터', releaseDate: '2026-09-10', artistId: '67872918' })
    expect(album.album.tracks.map((t) => t.trackNumber)).toEqual([1, 2])
    expect(await genieMusic.provider('lookup', 'genie-music').track!('1', {})).toBeNull()
  })
})
