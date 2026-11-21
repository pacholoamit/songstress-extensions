// Genie Music, as a Songstress source: search its songs, albums and
// artists, and open them by id or by link.
//
// Written for Songstress from Genie's own pages (www.genie.co.kr), not from
// the Mornye "genie-music" extension, whose code carries no licence. Genie
// has no public API: its search and detail pages are read as HTML, by the
// markup they use (a song row is <tr class="list" songid=…>, an id is the
// argument of the page's own fnViewArtist and fnViewAlbumLayer calls).

import {
  type CatalogAlbum,
  type CatalogAlbumDetail,
  type CatalogArtist,
  type CatalogArtistDetail,
  type CatalogTrack,
  type LinkResult,
  type SearchResults,
} from 'songstress/server'
import { HttpStatus, query, text } from '../../shared/http'
import { registerCatalog } from '../../shared/register'
import { htmlText } from '../../shared/text'
import { param, parseAddress } from '../../shared/url'

const SOURCE = 'genie-music'
const SITE = 'https://www.genie.co.kr'

/** A page of Genie's, or null when it has no such thing. */
async function pageOf(path: string, params: Record<string, string | number>): Promise<string | null> {
  return text(`${SITE}${path}?${query(params)}`, { headers: { 'accept-language': 'ko-KR,ko;q=0.9,en;q=0.8' } }).catch((error: unknown) => {
    if (error instanceof HttpStatus && error.status === 404) return null
    throw error
  })
}

/** An image's address at 600 px, https. */
function cover(src: string | undefined): string | undefined {
  if (!src) return undefined
  const url = src.trim().replace(/^\/\//, 'https://').replace(/^http:/, 'https:').replace(/\/dims\/.*$/, '')
  return /^https:\/\/image\.genie\.co\.kr\//.test(url) ? url.replace(/_\d+x\d+(\.\w+)$/i, '_600x600$1') : undefined
}

const first = (html: string, pattern: RegExp): string => pattern.exec(html)?.[1] ?? ''

/** The ids Genie's pages pass to their own functions. */
const CALLS = {
  fnViewArtist: /fnViewArtist\(\s*'?(\d+)'?/,
  fnViewAlbumLayer: /fnViewAlbumLayer\(\s*'?(\d+)'?/,
} as const
const idIn = (html: string, call: keyof typeof CALLS): string => first(html, CALLS[call])

/** "02:36" or "1:02:36" in seconds. */
function lengthOf(value: string): number | undefined {
  const parts = value.trim().split(':').map(Number)
  if (parts.length < 2 || parts.some((p) => !Number.isFinite(p))) return undefined
  return parts.reduce((total, part) => total * 60 + part, 0) || undefined
}

/** "2026.09.10" as 2026-09-10. */
function dateOf(value: string): string | undefined {
  const match = /(\d{4})[.-](\d{2})(?:[.-](\d{2}))?/.exec(value)
  return match ? [match[1], match[2], match[3]].filter(Boolean).join('-') : undefined
}

/** The value beside a label in a detail page's info list ("재생시간"). */
function info(html: string, label: string): string {
  const list = first(html, /<ul class="info-data">([\s\S]*?)<\/ul>/)
  for (const item of list.split(/<li\b/)) {
    if (item.includes(`alt="${label}"`)) return first(item, /<span class="value">([\s\S]*?)<\/span>\s*(?:<\/li>|$)/) || first(item, /<span class="value">([\s\S]*)/)
  }
  return ''
}

// ── rows ────────────────────────────────────────────────────────────────────

/** The song rows of a page: each <tr class="list" songid=…>. */
function songRows(html: string, album?: { id: string; title: string; cover?: string; releaseDate?: string }): CatalogTrack[] {
  const out: CatalogTrack[] = []
  for (const row of html.matchAll(/<tr class="list"[^>]*songid="\s*(\d+)\s*"[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const body = row[2]!
    const title = htmlText(first(body, /<a[^>]*class="title ellipsis"[^>]*>([\s\S]*?)<\/a>/).replace(/<span class="icon[^"]*">[\s\S]*?<\/span>/g, ''))
    const artist = htmlText(first(body, /<a[^>]*class="artist ellipsis"[^>]*>([\s\S]*?)<\/a>/))
    if (!title) continue
    const albumTitle = htmlText(first(body, /<a[^>]*class="albumtitle ellipsis"[^>]*>([\s\S]*?)<\/a>/))
    const number = Number(htmlText(first(body, /<td class="number"[^>]*>([\s\S]*?)<(?:\/td|td|span)/))) || undefined
    out.push({
      id: row[1]!,
      title,
      artists: artist ? [artist] : [],
      artistId: idIn(body, 'fnViewArtist') || undefined,
      album: album?.title ?? (albumTitle || undefined),
      albumId: album?.id ?? (idIn(body, 'fnViewAlbumLayer') || undefined),
      trackNumber: album ? number : undefined,
      releaseDate: album?.releaseDate,
      coverUrl: album?.cover ?? cover(first(body, /<img[^>]*src="([^"]+)"/)),
      url: `${SITE}/detail/songInfo?xgnm=${row[1]}`,
    })
  }
  return out
}

function albumItems(html: string): CatalogAlbum[] {
  const out: CatalogAlbum[] = []
  for (const item of html.matchAll(/<li class="list-album">([\s\S]*?)<\/dl>/g)) {
    const body = item[1]!
    const id = idIn(body, 'fnViewAlbumLayer')
    const title = htmlText(first(body, /<dt class="ellipsis">([\s\S]*?)<\/dt>/))
    if (!id || !title) continue
    const artist = htmlText(first(body, /<a[^>]*class="album-artist"[^>]*>([\s\S]*?)<\/a>/))
    const desc = htmlText(first(body, /<dd class="desc">([\s\S]*?)<\/dd>/))
    out.push({
      id,
      title,
      artists: artist ? [artist] : [],
      artistId: idIn(body.slice(body.indexOf('album-artist')), 'fnViewArtist') || undefined,
      kind: /싱글|EP/i.test(desc) ? 'single' : 'album',
      releaseDate: dateOf(desc),
      trackCount: Number(/(\d+)곡/.exec(desc)?.[1]) || undefined,
      coverUrl: cover(first(body, /<img[^>]*src="([^"]+)"/)),
      url: `${SITE}/detail/albumInfo?axnm=${id}`,
    })
  }
  return out
}

function artistItems(html: string): CatalogArtist[] {
  const out: CatalogArtist[] = []
  for (const item of html.matchAll(/<div class="artist-item">([\s\S]*?)<\/p>/g)) {
    const body = item[1]!
    const id = idIn(body, 'fnViewArtist')
    const name = htmlText(first(body, /<span class="artist">([\s\S]*?)<\/span>/))
    if (id && name) out.push({ id, name, imageUrl: cover(first(body, /<img[^>]*src="([^"]+)"/)), url: `${SITE}/detail/artistInfo?xxnm=${id}` })
  }
  return out
}

// ── pages ───────────────────────────────────────────────────────────────────

const pageTitle = (html: string): string => htmlText(first(html, /<h2 class="name">([\s\S]*?)<\/h2>/))
const ogImage = (html: string): string | undefined => cover(first(html, /og:image"\s+content="([^"]+)"/))

/** The anchor a detail page's info list links with fnGoMore('<kind>', id). */
const LINKS = {
  artistInfo: /<a[^>]*fnGoMore\('artistInfo',\s*'(\d+)'\)[^>]*>([\s\S]*?)<\/a>/,
  albumInfo: /<a[^>]*fnGoMore\('albumInfo',\s*'(\d+)'\)[^>]*>([\s\S]*?)<\/a>/,
} as const

function linked(html: string, kind: keyof typeof LINKS): { id: string; text: string } | null {
  const list = first(html, /<ul class="info-data">([\s\S]*?)<\/ul>/)
  const match = LINKS[kind].exec(list)
  return match ? { id: match[1]!, text: htmlText(match[2]!) } : null
}

async function fetchTrack(id: string): Promise<CatalogTrack | null> {
  if (!/^\d+$/.test(id)) return null
  const html = await pageOf('/detail/songInfo', { xgnm: id })
  const title = html ? pageTitle(html) : ''
  if (!html || !title) return null
  const artist = linked(html, 'artistInfo')
  const album = linked(html, 'albumInfo')
  return {
    id,
    title,
    artists: artist?.text ? [artist.text] : [],
    artistId: artist?.id,
    album: album?.text || undefined,
    albumId: album?.id,
    durationS: lengthOf(htmlText(info(html, '재생시간'))),
    coverUrl: ogImage(html),
    url: `${SITE}/detail/songInfo?xgnm=${id}`,
  }
}

async function fetchAlbum(id: string): Promise<CatalogAlbumDetail | null> {
  if (!/^\d+$/.test(id)) return null
  const html = await pageOf('/detail/albumInfo', { axnm: id })
  const title = html ? pageTitle(html) : ''
  if (!html || !title) return null
  const artist = htmlText(info(html, '아티스트'))
  const releaseDate = dateOf(htmlText(info(html, '발매일')))
  const coverUrl = ogImage(html)
  return {
    id,
    title,
    artists: artist ? [artist] : [],
    artistId: linked(html, 'artistInfo')?.id,
    releaseDate,
    coverUrl,
    url: `${SITE}/detail/albumInfo?axnm=${id}`,
    tracks: songRows(html, { id, title, cover: coverUrl, releaseDate }),
  }
}

async function fetchArtist(id: string): Promise<CatalogArtistDetail | null> {
  if (!/^\d+$/.test(id)) return null
  const html = await pageOf('/detail/artistInfo', { xxnm: id })
  const name = html ? pageTitle(html) : ''
  if (!html || !name) return null
  return { id, name, imageUrl: ogImage(html), url: `${SITE}/detail/artistInfo?xxnm=${id}`, albums: albumItems(html), topTracks: songRows(html) }
}

// ── search, links ───────────────────────────────────────────────────────────

const SEARCHES = { track: '/search/searchSong', album: '/search/searchAlbum', artist: '/search/searchArtist' } as const

async function search(text: string, types: readonly string[], limit: number, offset: number): Promise<SearchResults> {
  const out: SearchResults = {}
  const pg = Math.floor(offset / 20) + 1
  for (const type of types) {
    const path = SEARCHES[type as keyof typeof SEARCHES]
    if (!path) continue
    const html = (await pageOf(path, { query: text, pg })) ?? ''
    if (type === 'track') out.tracks = songRows(html).slice(0, limit)
    if (type === 'album') out.albums = albumItems(html).slice(0, limit)
    if (type === 'artist') out.artists = artistItems(html).slice(0, limit)
  }
  return out
}

async function resolve(url: string): Promise<LinkResult | null> {
  const address = parseAddress(url)
  if (!address) return null
  if (address.path.includes('/detail/songInfo')) {
    const track = await fetchTrack(param(address, 'xgnm'))
    return track ? { type: 'track', track } : null
  }
  if (address.path.includes('/detail/albumInfo')) {
    const album = await fetchAlbum(param(address, 'axnm'))
    return album ? { type: 'album', album } : null
  }
  if (address.path.includes('/detail/artistInfo')) {
    const artist = await fetchArtist(param(address, 'xxnm'))
    return artist ? { type: 'artist', artist } : null
  }
  return null
}

// ── the provider ────────────────────────────────────────────────────────────

registerCatalog(SOURCE, { search, track: fetchTrack, album: fetchAlbum, artist: fetchArtist, resolve })
