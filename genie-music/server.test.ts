import { describe, expect, it } from 'vitest'
import { load, onlyTo, page, type StandIn } from '../shared/testing'
import manifest from './songstress.json' with { type: 'json' }

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

async function genie(): Promise<StandIn> {
  const stand = await load(() => import('./src/server'))
  stand.routes.push(
    ['GET', /^https:\/\/www\.genie\.co\.kr\/search\/searchSong\?query=IU&pg=1$/, page(SEARCH)],
    ['GET', /^https:\/\/www\.genie\.co\.kr\/detail\/songInfo\?xgnm=116789224$/, page(SONG)],
    ['GET', /^https:\/\/www\.genie\.co\.kr\/detail\/albumInfo\?axnm=88135998$/, page(ALBUM)],
  )
  return stand
}

describe('the Genie port', () => {
  it("reads its search page's song rows", async () => {
    const stand = await genie()
    const found = (await stand.ask('search', 'genie-music', 'search', { text: 'IU', types: ['track'], limit: 1, offset: 0 })) as { tracks: unknown[] }
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
    expect(onlyTo(stand, manifest.permissions.network.hosts)).toBe(true)
  })

  it('opens a song and an album from their links', async () => {
    const stand = await genie()
    expect(await stand.ask('links', 'genie-music', 'resolve', 'https://www.genie.co.kr/detail/songInfo?xgnm=116789224')).toMatchObject({
      type: 'track',
      track: { id: '116789224', title: 'Dear my crazy soulmate', artists: ['아이유 (IU)'], albumId: '88135998', durationS: 156 },
    })
    const album = (await stand.ask('links', 'genie-music', 'resolve', 'https://genie.co.kr/detail/albumInfo?axnm=88135998')) as {
      album: { title: string; releaseDate: string; artistId: string; tracks: { trackNumber: number; releaseDate: string }[] }
    }
    expect(album.album).toMatchObject({ title: '이 별로부터', releaseDate: '2026-09-10', artistId: '67872918' })
    expect(album.album.tracks.map((t) => t.trackNumber)).toEqual([1, 2])
    expect(await stand.ask('lookup', 'genie-music', 'track', '1')).toBeNull()
  })
})
