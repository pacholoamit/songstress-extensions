// JioSaavn, as a Songstress source: search, its songs, albums, playlists
// and artists by id or by link, the facts of a song, a stream to audition,
// and a song to acquire in one of its five AAC qualities.
//
// A port of the Mornye "jiosaavn" extension 1.0.8 (HemanthJabalpuri's
// spotiflac-jiosaavn-extension, MIT, with the Mornye registry's
// compatibility fixes, LGPL-3.0-only; see NOTICE). JioSaavn's web API
// answers JSON at api.php; each song carries its media address sealed with
// DES (des.ts), which names the 96 kbps file; the other qualities are the
// same address with their bitrate.

import {
  songstress,
  type CatalogAlbum,
  type CatalogAlbumDetail,
  type CatalogArtist,
  type CatalogArtistDetail,
  type CatalogPlaylist,
  type CatalogPlaylistDetail,
  type CatalogTrack,
  type LinkResult,
  type SearchResults,
  type TrackQuery,
} from 'songstress/server'
import { json, query } from '../../shared/http'
import { firstOf, registerCatalog, some } from '../../shared/register'
import { fold, unescapeHTML } from '../../shared/text'
import { base64Bytes, parseAddress } from '../../shared/url'
import { openSealed } from './des'

const SOURCE = 'jiosaavn'
const SITE = 'https://www.jiosaavn.com'
const REFERER = `${SITE}/`
const GEO = 'geo=19.0760%2C72.8777%2CIN%2CMaharashtra%2CMumbai%2C400001'
const PAGE = 100

/** The languages the admin chose, as JioSaavn's cookie names them. */
async function languages(): Promise<string> {
  const chosen = (await songstress.settings.get<string>('lang').catch(() => null)) ?? ''
  const clean = chosen
    .split(',')
    .map((l) => l.trim().toLowerCase())
    .filter((l) => /^[a-z]+$/.test(l))
  return clean.length ? clean.join(',') : 'english'
}

type Raw = Record<string, unknown>

/** One of api.php's calls. */
async function call<T = Raw>(name: string, params: Record<string, string | number | undefined>): Promise<T | null> {
  const lang = await languages()
  const url = `${SITE}/api.php?${query({ __call: name, _format: 'json', _marker: 0, api_version: 4, ctx: 'web6dot0', ...params })}`
  return json<T>(url, {
    headers: {
      accept: 'application/json, text/plain, */*',
      'accept-language': 'en-US,en;q=0.9',
      'x-requested-with': 'XMLHttpRequest',
      referer: REFERER,
      cookie: `DL=english; ${GEO}; L=${encodeURIComponent(lang)}`,
    },
  }).catch((error: unknown) => {
    if (error instanceof Error && error.name === 'HttpStatus') return null
    throw error
  })
}

// ── JioSaavn's shapes, and Songstress's ─────────────────────────────────────

const str = (value: unknown): string => (value === null || value === undefined ? '' : String(value))
const textOf = (value: unknown): string => unescapeHTML(str(value)).trim()

/** The last part of a JioSaavn address: its token. */
function tokenOf(url: unknown): string {
  const parts = str(url).split(/[?#]/)[0]!.replace(/\/+$/, '').split('/')
  return parts[parts.length - 1] ?? ''
}

/** An id or token JioSaavn takes, from an address too; "" otherwise. */
function reference(value: string): string {
  const v = /^https?:\/\//i.test(value.trim()) ? tokenOf(value) : value.trim()
  return /^[A-Za-z0-9_,.-]{1,128}$/.test(v) ? v : ''
}

function image(url: unknown): string | undefined {
  const u = str(url).replace(/^http:/, 'https:').replace(/(?:50|150)x(?:50|150)(\.[a-z]+)(?=[?#]|$)/i, '500x500$1')
  return u || undefined
}

/** The song's media address, opened: the 96 kbps file on JioSaavn's CDN. */
function mediaOf(more: Raw): string {
  const sealed = str(more.encrypted_media_url)
  if (!sealed) return ''
  const url = openSealed(base64Bytes(sealed)).trim().replace(/^http:/, 'https:')
  return /^https:\/\/aac\.saavncdn\.com\//i.test(url) ? url : ''
}

function artistsOf(item: Raw): { names: string[]; firstId?: string } {
  const more = (item.more_info ?? {}) as Raw
  const map = (more.artistMap ?? {}) as Raw
  const listed = [...((map.primary_artists as Raw[] | undefined) ?? []), ...((map.featured_artists as Raw[] | undefined) ?? [])]
  const names = [...new Set(listed.map((a) => textOf(a.name)).filter(Boolean))]
  if (names.length === 0) {
    const credit = textOf(item.primary_artists || more.primary_artists || more.singers || str(item.subtitle).split(' - ')[0])
    names.push(...credit.split(',').map((n) => n.trim()).filter(Boolean))
  }
  const first = ((map.primary_artists as Raw[] | undefined) ?? [])[0]
  return { names, firstId: first?.id ? str(first.id) : undefined }
}

const positive = (value: unknown): number | undefined => {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : undefined
}

function isrcOf(value: unknown): string | undefined {
  const isrc = str(value).toUpperCase().replace(/[\s-]/g, '')
  return /^[A-Z]{2}[A-Z0-9]{3}\d{7}$/.test(isrc) ? isrc : undefined
}

interface Song {
  track: CatalogTrack
  media: string
  genre?: string
  label?: string
}

const explicitOf = (raw: Raw): boolean => raw.explicit_content === '1' || raw.explicit_content === 1 || raw.explicit_content === true

/** What a song's more_info says of its album and its numbers. */
function songFacts(raw: Raw, more: Raw, n?: number): Pick<CatalogTrack, 'album' | 'albumId' | 'durationS' | 'trackNumber' | 'releaseDate'> {
  return {
    album: some(textOf(more.album || raw.album)),
    albumId: firstOf(str(more.album_id || raw.albumid), tokenOf(more.album_url)),
    durationS: positive(more.duration || raw.duration),
    trackNumber: positive(more.track_number || raw.track_number) ?? n,
    releaseDate: some(str(more.release_date || raw.release_date || raw.year)),
  }
}

function songOf(raw: Raw, n?: number): Song | null {
  const id = str(raw.id) || tokenOf(raw.perma_url)
  const title = textOf(raw.title || raw.song)
  if (!id || !title) return null
  const more = (raw.more_info ?? {}) as Raw
  const { names, firstId } = artistsOf(raw)
  const track: CatalogTrack = {
    id,
    title,
    artists: names,
    artistId: firstId,
    ...songFacts(raw, more, n),
    isrc: isrcOf(more.isrc || raw.isrc),
    explicit: explicitOf(raw),
    coverUrl: image(raw.image),
    url: some(str(raw.perma_url)),
  }
  return { track, media: mediaOf(more), genre: some(textOf(more.genre)), label: some(textOf(more.label)) }
}

const tracksOf = (rows: unknown, numbered: boolean): CatalogTrack[] =>
  ((rows as Raw[] | undefined) ?? [])
    .map((row, i) => songOf(row, numbered ? i + 1 : undefined)?.track ?? null)
    .filter((t): t is CatalogTrack => t !== null)

function albumOf(raw: Raw): CatalogAlbum | null {
  const id = str(raw.id || raw.albumid) || tokenOf(raw.perma_url)
  const title = textOf(raw.title)
  if (!id || !title) return null
  const more = (raw.more_info ?? {}) as Raw
  const { names, firstId } = artistsOf(raw)
  return {
    id,
    title,
    artists: names,
    artistId: firstId,
    kind: raw.type === 'single' ? 'single' : 'album',
    releaseDate: str(more.release_date || raw.release_date || raw.year) || undefined,
    trackCount: positive(raw.song_count || more.song_count || raw.list_count),
    coverUrl: image(raw.image),
    url: str(raw.perma_url) || undefined,
  }
}

function playlistOf(raw: Raw): CatalogPlaylist | null {
  const id = str(raw.id) || tokenOf(raw.perma_url)
  const title = textOf(raw.title)
  if (!id || !title) return null
  const more = (raw.more_info ?? {}) as Raw
  return {
    id,
    title,
    owner: textOf(more.firstname || raw.subtitle) || undefined,
    trackCount: positive(raw.list_count || more.song_count || raw.song_count),
    coverUrl: image(raw.image),
    url: str(raw.perma_url) || undefined,
  }
}

function artistOf(raw: Raw): CatalogArtist | null {
  const urls = (raw.urls ?? {}) as Raw
  const id = str(raw.artistId || raw.id) || tokenOf(urls.overview || raw.perma_url)
  const name = textOf(raw.title || raw.name)
  if (!id || !name) return null
  return { id, name, imageUrl: image(raw.image), url: str(raw.perma_url) || undefined }
}

const present = <T>(items: (T | null)[]): T[] => items.filter((i): i is T => i !== null)

// ── reading ─────────────────────────────────────────────────────────────────

async function fetchSong(id: string): Promise<Song | null> {
  const ref = reference(id)
  if (!ref) return null
  // An 8-character id is a catalogue id; anything else a link's token.
  const byIdFirst = /^[A-Za-z0-9_-]{8}$/.test(ref)
  for (const byId of [byIdFirst, !byIdFirst]) {
    const answer = byId
      ? await call<{ songs?: Raw[] }>('song.getDetails', { pids: ref })
      : await call<{ songs?: Raw[] }>('webapi.get', { token: ref, type: 'song', includeMetaTags: 0 })
    const raw = (answer?.songs ?? []).find((s) => str(s.id) === ref || tokenOf(s.perma_url) === ref)
    if (raw) return songOf(raw)
  }
  return null
}

async function fetchAlbum(id: string): Promise<CatalogAlbumDetail | null> {
  const ref = reference(id).replace(/^albumid_/, '')
  if (!ref) return null
  const raw = /^\d+$/.test(ref)
    ? await call('content.getAlbumDetails', { albumid: ref })
    : await call('webapi.get', { token: ref, type: 'album', includeMetaTags: 0 })
  const album = raw ? albumOf(raw) : null
  return album ? { ...album, tracks: tracksOf(raw!.list ?? raw!.songs, true) } : null
}

/** A playlist, every page of it (JioSaavn hands out 100 a page). */
async function fetchPlaylist(id: string): Promise<CatalogPlaylistDetail | null> {
  const ref = reference(id).replace(/^playlist_/, '')
  if (!ref) return null
  const byId = /^\d+$/.test(ref)
  const page = (p: number) =>
    byId ? call('playlist.getDetails', { listid: ref, p, n: PAGE }) : call('webapi.get', { token: ref, type: 'playlist', includeMetaTags: 0, p, n: PAGE })
  const first = await page(1)
  const playlist = first ? playlistOf(first) : null
  if (!first || !playlist) return null
  const rows = [...((first.list as Raw[] | undefined) ?? [])]
  const seen = new Set(rows.map((r) => str(r.id)))
  const total = positive(first.list_count) ?? 0
  for (let p = 2, last = rows.length; last >= PAGE && (!total || seen.size < total) && p <= 100; p++) {
    const next = (await page(p))?.list as Raw[] | undefined
    last = next?.length ?? 0
    const added = (next ?? []).filter((r) => !seen.has(str(r.id)))
    if (added.length === 0) break
    for (const r of added) seen.add(str(r.id))
    rows.push(...added)
  }
  return { ...playlist, tracks: tracksOf(rows, false) }
}

async function fetchArtist(id: string): Promise<CatalogArtistDetail | null> {
  const ref = reference(id).replace(/^artistid_/, '')
  if (!ref) return null
  const params = { page: 0, n_song: 50, n_album: 50, sub_type: '', category: 'popular', sort_order: 'asc' }
  const raw = /^\d+$/.test(ref)
    ? await call('artist.getArtistPageDetails', { artistId: ref, ...params })
    : await call('webapi.get', { token: ref, type: 'artist', p: 0, ...params })
  const artist = raw ? artistOf(raw) : null
  if (!raw || !artist) return null
  const singles = present(((raw.singles as Raw[] | undefined) ?? []).map(albumOf)).map((a) => ({ ...a, kind: 'single' as const }))
  return {
    ...artist,
    albums: [...present(((raw.topAlbums as Raw[] | undefined) ?? []).map(albumOf)), ...singles],
    topTracks: tracksOf(raw.topSongs, false),
  }
}

// ── search ──────────────────────────────────────────────────────────────────

const SEARCHES = {
  track: ['search.getResults', 'song'],
  album: ['search.getAlbumResults', 'album'],
  playlist: ['search.getPlaylistResults', 'playlist'],
  artist: ['search.getArtistResults', 'artist'],
} as const

async function search(text: string, types: readonly string[], limit: number, offset: number): Promise<SearchResults> {
  const out: SearchResults = {}
  const page = Math.floor(offset / Math.max(limit, 1)) + 1
  for (const type of types) {
    const known = SEARCHES[type as keyof typeof SEARCHES]
    if (!known) continue
    const answer = await call<{ results?: Raw[] }>(known[0], { q: text, p: page, n: limit })
    const rows = (answer?.results ?? []).filter((r) => r.type === known[1])
    if (type === 'track') out.tracks = present(rows.map((r) => songOf(r)?.track ?? null))
    if (type === 'album') out.albums = present(rows.map(albumOf))
    if (type === 'playlist') out.playlists = present(rows.map(playlistOf))
    if (type === 'artist') out.artists = present(rows.map(artistOf))
  }
  return out
}

// ── links ───────────────────────────────────────────────────────────────────

async function resolve(url: string): Promise<LinkResult | null> {
  const address = parseAddress(url)
  if (!address) return null
  const token = tokenOf(url)
  const path = address.path
  if (path.includes('/song/')) {
    const song = await fetchSong(token)
    return song ? { type: 'track', track: song.track } : null
  }
  if (path.includes('/album/')) {
    const album = await fetchAlbum(token)
    return album ? { type: 'album', album } : null
  }
  if (path.includes('/playlist/') || path.includes('/featured/')) {
    const playlist = await fetchPlaylist(token)
    return playlist ? { type: 'playlist', playlist } : null
  }
  if (path.includes('/artist/')) {
    const artist = await fetchArtist(token)
    return artist ? { type: 'artist', artist } : null
  }
  return null
}

// ── audio ───────────────────────────────────────────────────────────────────

const BITRATES: Record<string, string> = { 'aac-320': '320', 'aac-160': '160', 'aac-96': '96', 'aac-48': '48', 'aac-12': '12' }

function atBitrate(media: string, quality: string): string {
  const bitrate = BITRATES[quality] ?? '320'
  return media.replace(/_\d+\.mp4(?=[?#]|$)/, `_${bitrate}.mp4`)
}

const sameName = (a: string, b: string) => fold(a) === fold(b)

/** The artist credits share a name. */
function sameArtists(wanted: string, offered: string[]): boolean {
  const names = (credit: string) => credit.split(/[,;&]|\s+(?:feat\.?|ft\.?)\s+/i).map(fold).filter(Boolean)
  const asked = names(wanted)
  return offered.flatMap(names).some((name) => asked.includes(name))
}

/** Whether a candidate is the song: the same ISRC when both have one,
 * else the same title by the same artist within five seconds. */
function isTheSong(candidate: Song, song: TrackQuery, isrc: string | undefined): boolean {
  const t = candidate.track
  if (isrc && t.isrc) return isrc === t.isrc
  const close = !!song.durationS && !!t.durationS && Math.abs(song.durationS - t.durationS) <= 5
  return close && sameName(song.title, t.title) && sameArtists(song.artist, t.artists)
}

/** The JioSaavn song that is this one, with a media address. */
async function find(song: TrackQuery): Promise<Song | null> {
  if (!song.title || !song.artist) return null
  const answer = await call<{ results?: Raw[] }>('search.getResults', { q: `${song.title} ${song.artist}`, p: 1, n: 20 })
  const isrc = isrcOf(song.isrc)
  for (const raw of (answer?.results ?? []).filter((r) => r.type === 'song')) {
    const candidate = songOf(raw)
    if (candidate?.media && isTheSong(candidate, song, isrc)) return candidate
  }
  return null
}

// ── the providers ───────────────────────────────────────────────────────────

registerCatalog(SOURCE, {
  search,
  track: async (id) => (await fetchSong(id))?.track ?? null,
  album: fetchAlbum,
  playlist: fetchPlaylist,
  artist: fetchArtist,
  resolve,
})

songstress.providers.metadata.register(SOURCE, {
  enrich: async (track) => {
    const song = await find(track)
    return song ? { isrc: song.track.isrc, genre: song.genre, label: song.label, releaseDate: song.track.releaseDate } : null
  },
})

songstress.providers.play.register(SOURCE, {
  resolve: async (track) => {
    const song = await fetchSong(track.id)
    return song?.media ? { url: atBitrate(song.media, 'aac-160'), container: 'm4a', headers: { referer: REFERER } } : null
  },
})

songstress.providers.download.register(SOURCE, {
  check: async (track) => {
    const song = await find(track)
    return song ? { available: true, id: song.track.id } : { available: false }
  },
  locate: async ({ id, quality }) => {
    const song = await fetchSong(id)
    if (!song?.media) return null
    return {
      location: { kind: 'file', url: atBitrate(song.media, quality), container: 'm4a', headers: { referer: REFERER } },
      tags: { isrc: song.track.isrc, genre: song.genre, label: song.label, releaseDate: song.track.releaseDate },
    }
  },
})
