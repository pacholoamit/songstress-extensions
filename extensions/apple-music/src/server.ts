// Apple Music, as a Songstress source: search, its songs, albums,
// playlists and artists by id or by link, the facts of a song (its ISRC
// above all), and lyrics, synced, with your own Media User Token. It joins
// the iTunes group: Apple Music's ids are the iTunes catalogue's.
//
// A port of the Mornye "apple-music" extension 1.4.14 (Copyright 2026
// zarzet, LGPL-3.0-only; see NOTICE). Apple's public catalogue API
// (amp-api.music.apple.com) takes the developer token music.apple.com's own
// page embeds, or its script holds (findInAnswer: the script is larger
// than the extension host answers in one request); lyrics also need a
// member's Media User Token.

import {
  base64Text,
  bestMatch,
  fetchJson,
  findInAnswer,
  HttpStatusError,
  KeptValue,
  nullIfMissing,
  ProviderFailure,
  queryString,
  registerCatalog,
  songstress,
  unescapeHtml,
  urlParam,
  type CatalogAlbum,
  type CatalogAlbumDetail,
  type CatalogArtist,
  type CatalogArtistDetail,
  type CatalogPlaylist,
  type CatalogPlaylistDetail,
  type CatalogTrack,
  type LinkResult,
  type LyricsLine,
  type LyricsResult,
  type SearchQuery,
  type SearchResults,
  type TrackFacts,
  type TrackQuery,
} from 'songstress/server'

const SOURCE = 'apple-music'
const API = 'https://amp-api.music.apple.com/v1/catalog'
const COVER = 1200
const HOUR_MS = 60 * 60 * 1000
/** What a desktop browser sends: Apple answers it as it answers one. */
const AGENT = { 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36' }

// ── settings ────────────────────────────────────────────────────────────────

async function setting(key: string): Promise<string> {
  const value = await songstress.settings.get<string>(key).catch(() => null)
  return typeof value === 'string' ? value.trim() : ''
}

async function storefront(): Promise<string> {
  const chosen = (await setting('storefront')).toLowerCase()
  return /^[a-z]{2}$/.test(chosen) ? chosen : 'us'
}

// ── the developer token ─────────────────────────────────────────────────────

const JWT = /([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)/
const WEB_PLAY_HEADERS = ['eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IldlYlBsYXlLaWQifQ.', 'eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NiIsImtpZCI6IldlYlBsYXlLaWQifQ.']
const token = new KeptValue<string>('developer-token')

/** The token's own expiry, five minutes early; twelve hours when it says
 * none. */
function expiryOf(jwt: string): number {
  try {
    const claims = JSON.parse(base64Text(jwt.split('.')[1] ?? '')) as { exp?: number }
    if (typeof claims.exp === 'number') return claims.exp * 1000 - 5 * 60 * 1000
  } catch {
    // An unreadable token is used until Apple refuses it.
  }
  return Date.now() + 12 * HOUR_MS
}

/** A JWT that starts with the WebPlayKid header, found by searching. */
function webPlayToken(code: string): string | null {
  for (const head of WEB_PLAY_HEADERS) {
    const at = code.indexOf(head)
    if (at === -1) continue
    const found = /^[A-Za-z0-9_.-]+/.exec(code.slice(at))?.[0] ?? ''
    if (found.split('.').length === 3) return found
  }
  return null
}

/** The developer token in music.apple.com's page: an embed's devToken, the
 * token written in the page, or in its first script bundles. */
async function findToken(): Promise<{ value: string; until: number }> {
  // The page's scripts are gathered while it is read for the token itself.
  const bundles = new Set<string>()
  const inPage = (page: string): string | null => {
    for (const [, bundle] of page.matchAll(/src="(\/assets\/[^"]*\.js)"/g)) if (!bundle!.includes('-legacy')) bundles.add(bundle!)
    return /devToken=([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)/.exec(page)?.[1] ?? webPlayToken(page)
  }
  let found = await findInAnswer('https://music.apple.com/us/browse', inPage, { headers: AGENT }).catch((error: unknown) => {
    throw error instanceof HttpStatusError ? new ProviderFailure('unavailable', { message: error.message }) : error
  })
  for (const bundle of [...bundles].slice(0, 6)) {
    if (found) break
    found = await findInAnswer(`https://music.apple.com${bundle}`, webPlayToken, { headers: AGENT }).catch(() => null)
  }
  if (!found || !JWT.test(found)) throw new ProviderFailure('unavailable', { message: "music.apple.com's page held no developer token" })
  return { value: found, until: expiryOf(found) }
}

const BROWSER = { ...AGENT, origin: 'https://music.apple.com', referer: 'https://music.apple.com/' }

/** One of the catalogue's answers for the storefront, or null for a 404. A
 * token Apple refuses is fetched again, once. */
async function catalog<T>(path: string, params: Record<string, string | number | undefined>, front?: string): Promise<T | null> {
  return catalogAt<T>(`${API}/${front ?? (await storefront())}/${path}?${queryString(params)}`)
}

async function catalogAt<T>(where: string): Promise<T | null> {
  for (let attempt = 0; ; attempt++) {
    const bearer = await token.getOr(findToken)
    try {
      return await nullIfMissing(() => fetchJson<T>(where, { headers: { ...BROWSER, authorization: `Bearer ${bearer}` } }), [400, 404])
    } catch (error) {
      if (attempt === 0 && error instanceof HttpStatusError && error.status === 401) {
        await token.delete()
        continue
      }
      if (error instanceof HttpStatusError) throw new ProviderFailure('unavailable', { message: error.message })
      throw error
    }
  }
}

// ── Apple's shapes, and Songstress's ────────────────────────────────────────

interface Artwork {
  url?: string
}

interface Resource {
  id?: string
  type?: string
  href?: string
  attributes?: Record<string, unknown> & { artwork?: Artwork; url?: string; name?: string }
  relationships?: Record<string, { data?: Resource[]; next?: string }>
  views?: Record<string, { data?: Resource[] }>
}

interface Listing {
  data?: Resource[]
  next?: string
  results?: Record<string, { data?: Resource[] }>
}

const s = (value: unknown): string => (typeof value === 'string' ? value : value === undefined || value === null ? '' : String(value))

function art(artwork: Artwork | undefined): string | undefined {
  return artwork?.url ? artwork.url.replace('{w}', String(COVER)).replace('{h}', String(COVER)) : undefined
}

function first(resource: Resource | undefined, relationship: string): Resource | undefined {
  return resource?.relationships?.[relationship]?.data?.[0]
}

function albumIdOf(song: Resource): string | undefined {
  return first(song, 'albums')?.id ?? /\/album\/[^/]+\/(\d+)/.exec(s(song.attributes?.url))?.[1]
}

/** What a song's album says of it, when the album is known. */
function onAlbum(song: Resource, album?: Resource): Pick<CatalogTrack, 'album' | 'albumId' | 'albumArtist' | 'releaseDate' | 'artistId'> {
  const a = song.attributes ?? {}
  const of = album?.attributes ?? {}
  return {
    album: s(of.name) || s(a.albumName) || undefined,
    albumId: album?.id ?? albumIdOf(song),
    albumArtist: s(a.albumArtistName) || s(of.artistName) || undefined,
    releaseDate: s(of.releaseDate) || s(a.releaseDate) || undefined,
    artistId: first(song, 'artists')?.id ?? first(album, 'artists')?.id,
  }
}

function songOf(song: Resource, album?: Resource): CatalogTrack | null {
  const a = song.attributes ?? {}
  if (!song.id || !a.name) return null
  return {
    id: song.id,
    title: s(a.name),
    artists: a.artistName ? [s(a.artistName)] : [],
    ...onAlbum(song, album),
    durationS: Number(a.durationInMillis ?? 0) / 1000 || undefined,
    trackNumber: Number(a.trackNumber ?? 0) || undefined,
    discNumber: Number(a.discNumber ?? 0) || undefined,
    isrc: s(a.isrc) || undefined,
    explicit: a.contentRating === 'explicit',
    coverUrl: art(a.artwork) ?? art(album?.attributes?.artwork as Artwork | undefined),
    url: s(a.url) || undefined,
    ids: { itunes: song.id },
  }
}

function kindOf(a: Record<string, unknown>): CatalogAlbum['kind'] {
  if (a.isCompilation === true) return 'compilation'
  if (a.isSingle === true) return 'single'
  return 'album'
}

function albumOf(album: Resource): CatalogAlbum | null {
  const a = album.attributes ?? {}
  if (!album.id || !a.name) return null
  return {
    id: album.id,
    title: s(a.name),
    artists: a.artistName ? [s(a.artistName)] : [],
    artistId: first(album, 'artists')?.id,
    kind: kindOf(a),
    releaseDate: s(a.releaseDate) || undefined,
    trackCount: Number(a.trackCount ?? 0) || undefined,
    explicit: a.contentRating === 'explicit',
    upc: s(a.upc) || undefined,
    coverUrl: art(a.artwork),
    url: s(a.url) || undefined,
    ids: { itunes: album.id },
  }
}

function descriptionOf(a: Record<string, unknown>): string | undefined {
  const d = a.description as { standard?: string; short?: string } | undefined
  const plain = unescapeHtml(s(d?.standard || d?.short).replace(/<[^>]+>/g, '')).trim()
  return plain || undefined
}

function playlistOf(playlist: Resource): CatalogPlaylist | null {
  const a = playlist.attributes ?? {}
  if (!playlist.id || !a.name) return null
  return {
    id: playlist.id,
    title: s(a.name),
    owner: s(a.curatorName) || undefined,
    description: descriptionOf(a),
    coverUrl: art(a.artwork),
    url: s(a.url) || undefined,
  }
}

function artistOf(artist: Resource): CatalogArtist | null {
  const a = artist.attributes ?? {}
  if (!artist.id || !a.name) return null
  return { id: artist.id, name: s(a.name), imageUrl: art(a.artwork), url: s(a.url) || undefined, ids: { itunes: artist.id } }
}

const present = <T>(items: (T | null)[]): T[] => items.filter((i): i is T => i !== null)

// ── reading ─────────────────────────────────────────────────────────────────

const ALBUM_EXTEND = { extend: 'artistUrl,trackCount,upc' }

/** Every item of a relationship, its next pages followed. */
async function all(resource: Resource, relationship: string): Promise<Resource[]> {
  const rel = resource.relationships?.[relationship]
  const items = [...(rel?.data ?? [])]
  let next = rel?.next
  for (let pages = 0; next?.startsWith('/v1/catalog/') && pages < 50; pages++) {
    const listing = await catalogAt<Listing>(`https://amp-api.music.apple.com${next}`).catch(() => null)
    if (!listing?.data?.length) break
    items.push(...listing.data)
    next = listing.next
  }
  return items
}

/** The albums of songs, 25 at a time, by id. */
async function albumsOf(songs: Resource[], front?: string): Promise<Map<string, Resource>> {
  const ids = [...new Set(songs.map(albumIdOf).filter((id): id is string => !!id))]
  const out = new Map<string, Resource>()
  for (let at = 0; at < ids.length; at += 25) {
    const listing = await catalog<Listing>('albums', { ids: ids.slice(at, at + 25).join(','), include: 'artists', ...ALBUM_EXTEND }, front).catch(() => null)
    for (const album of listing?.data ?? []) if (album.id) out.set(album.id, album)
  }
  return out
}

async function fetchTrack(id: string, front?: string): Promise<CatalogTrack | null> {
  if (!/^\d+$/.test(id)) return null
  const listing = await catalog<Listing>(`songs/${id}`, { include: 'albums,artists', ...ALBUM_EXTEND }, front)
  const song = listing?.data?.[0]
  if (!song) return null
  const albums = await albumsOf([song], front)
  return songOf(song, albums.get(albumIdOf(song) ?? ''))
}

async function fetchAlbum(id: string, front?: string): Promise<CatalogAlbumDetail | null> {
  if (!/^\d+$/.test(id)) return null
  const listing = await catalog<Listing>(`albums/${id}`, { include: 'tracks,artists', ...ALBUM_EXTEND }, front)
  const album = listing?.data?.[0]
  const head = album ? albumOf(album) : null
  if (!album || !head) return null
  const songs = await all(album, 'tracks')
  return { ...head, tracks: present(songs.map((song) => songOf(song, album))) }
}

async function fetchPlaylist(id: string, front?: string): Promise<CatalogPlaylistDetail | null> {
  if (!/^pl\.[A-Za-z0-9.-]+$/.test(id)) return null
  const listing = await catalog<Listing>(`playlists/${id}`, { include: 'tracks' }, front)
  const playlist = listing?.data?.[0]
  const head = playlist ? playlistOf(playlist) : null
  if (!playlist || !head) return null
  const songs = await all(playlist, 'tracks')
  const albums = await albumsOf(songs, front)
  return { ...head, trackCount: songs.length, tracks: present(songs.map((song) => songOf(song, albums.get(albumIdOf(song) ?? '')))) }
}

async function fetchArtist(id: string, front?: string): Promise<CatalogArtistDetail | null> {
  if (!/^\d+$/.test(id)) return null
  const listing = await catalog<Listing>(`artists/${id}`, { include: 'albums', 'limit[albums]': 100, views: 'top-songs' }, front)
  const artist = listing?.data?.[0]
  const head = artist ? artistOf(artist) : null
  if (!artist || !head) return null
  const top = artist.views?.['top-songs']?.data ?? []
  const albums = await albumsOf(top, front)
  return {
    ...head,
    albums: present((artist.relationships?.albums?.data ?? []).map(albumOf)),
    topTracks: present(top.map((song) => songOf(song, albums.get(albumIdOf(song) ?? '')))),
  }
}

// ── search ──────────────────────────────────────────────────────────────────

const TYPES = { track: 'songs', album: 'albums', artist: 'artists', playlist: 'playlists' } as const

async function search({ text: term, types, limit, offset }: SearchQuery): Promise<SearchResults> {
  const asked = types.map((t) => TYPES[t as keyof typeof TYPES]).filter(Boolean)
  const listing = await catalog<Listing>('search', { term, types: asked.join(','), limit: Math.min(limit, 25), offset })
  const results = listing?.results ?? {}
  const songs = results.songs?.data ?? []
  const albums = songs.length ? await albumsOf(songs) : new Map<string, Resource>()
  const out: SearchResults = {}
  if (types.includes('track')) out.tracks = present(songs.map((song) => songOf(song, albums.get(albumIdOf(song) ?? ''))))
  if (types.includes('album')) out.albums = present((results.albums?.data ?? []).map(albumOf))
  if (types.includes('artist')) out.artists = present((results.artists?.data ?? []).map(artistOf))
  if (types.includes('playlist')) out.playlists = present((results.playlists?.data ?? []).map(playlistOf))
  return out
}

/** The Apple Music song that is this one, by its ISRC or by its title, its
 * artist, its album and its length: none when the best is weak. */
async function find(song: TrackQuery): Promise<Resource | null> {
  const term = `${song.title} ${song.artist}`.trim()
  if (!term) return null
  const listing = await catalog<Listing>('search', { term, types: 'songs', limit: 10 })
  const tags = ({ attributes: a = {} }: Resource) => ({ title: s(a.name), artist: s(a.artistName), album: s(a.albumName), durationS: Number(a.durationInMillis ?? 0) / 1000, isrc: s(a.isrc) })
  return bestMatch(song, listing?.results?.songs?.data ?? [], tags, 70)
}

// ── links ───────────────────────────────────────────────────────────────────

/** An Apple Music address: its storefront, what it names and the id. */
function parseLink(url: string): { front: string; type: string; id: string } | null {
  const match = /music\.apple\.com\/([a-z]{2})\/(album|playlist|artist|song)\/(?:[^/?#]*\/)?([a-z0-9.-]+)/i.exec(url)
  if (!match) return null
  const songId = urlParam(url, 'i')
  if (match[2] === 'album' && /^\d+$/.test(songId)) return { front: match[1]!.toLowerCase(), type: 'song', id: songId }
  return { front: match[1]!.toLowerCase(), type: match[2]!.toLowerCase(), id: match[3]! }
}

async function resolve(url: string): Promise<LinkResult | null> {
  const link = parseLink(url)
  if (!link) return null
  switch (link.type) {
    case 'song': {
      const track = await fetchTrack(link.id, link.front)
      return track ? { type: 'track', track } : null
    }
    case 'album': {
      const album = await fetchAlbum(link.id, link.front)
      return album ? { type: 'album', album } : null
    }
    case 'playlist': {
      const playlist = await fetchPlaylist(link.id, link.front)
      return playlist ? { type: 'playlist', playlist } : null
    }
    case 'artist': {
      const artist = await fetchArtist(link.id, link.front)
      return artist ? { type: 'artist', artist } : null
    }
  }
  return null
}

// ── lyrics ──────────────────────────────────────────────────────────────────

/** A TTML time ("1.5", "00:01.500", "01:02:03.456", "3.5s") in seconds; -1
 * when it reads as none. */
function seconds(value: string): number {
  const v = value.trim().replace(/s$/, '')
  if (!v) return -1
  const parts = v.split(':').map(Number)
  if (parts.some((p) => !Number.isFinite(p))) return -1
  return parts.reduce((total, part) => total * 60 + part, 0)
}

/** The TTML attributes read, each by its own pattern. */
const ATTRIBUTES = {
  begin: /\bbegin="([^"]*)"/,
  'itunes:key': /\bitunes:key="([^"]*)"/,
  'xml:lang': /\bxml:lang="([^"]*)"/,
  for: /\bfor="([^"]*)"/,
} as const

function attribute(tag: string, name: keyof typeof ATTRIBUTES): string {
  return ATTRIBUTES[name].exec(tag)?.[1] ?? ''
}

const plain = (fragment: string): string =>
  unescapeHtml(fragment.replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim()

/** The spans of one role (x-bg, x-translation, x-roman) in a line, and
 * what is left without them. Background vocals may nest spans, so spans
 * are matched by depth. */
const ROLES = {
  'x-bg': /<span[^>]*ttm:role="x-bg"[^>]*>/,
  'x-translation': /<span[^>]*ttm:role="x-translation"[^>]*>/,
  'x-roman': /<span[^>]*ttm:role="x-roman"[^>]*>/,
} as const

function takeRole(content: string, role: keyof typeof ROLES): { taken: { lang: string; text: string }[]; rest: string } {
  const taken: { lang: string; text: string }[] = []
  let rest = content
  for (let guard = 0; guard < 50; guard++) {
    const open = ROLES[role].exec(rest)
    if (!open) break
    let depth = 1
    let at = open.index + open[0].length
    const tags = /<\/?span\b[^>]*>/g
    tags.lastIndex = at
    let end = rest.length
    for (let tag = tags.exec(rest); tag; tag = tags.exec(rest)) {
      depth += tag[0].startsWith('</') ? -1 : 1
      if (depth === 0) {
        end = tag.index
        at = tag.index + tag[0].length
        break
      }
    }
    taken.push({ lang: attribute(open[0], 'xml:lang').toLowerCase(), text: plain(rest.slice(open.index + open[0].length, end)) })
    rest = rest.slice(0, open.index) + ' ' + rest.slice(at)
  }
  return { taken, rest }
}

/** The texts the head keeps for each line key, of one kind (translation,
 * transliteration), in the language asked. */
const HEAD_BLOCKS = {
  translation: /<translation\b([^>]*)>([\s\S]*?)<\/translation>/gi,
  transliteration: /<transliteration\b([^>]*)>([\s\S]*?)<\/transliteration>/gi,
} as const

function headTexts(ttml: string, kind: keyof typeof HEAD_BLOCKS, lang: string): Map<string, string> {
  const out = new Map<string, string>()
  if (!lang) return out
  for (const block of ttml.matchAll(HEAD_BLOCKS[kind])) {
    if (!attribute(block[1]!, 'xml:lang').toLowerCase().startsWith(lang)) continue
    for (const entry of block[2]!.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/gi)) {
      const key = attribute(entry[1]!, 'for')
      if (key) out.set(key, plain(takeRole(entry[2]!, 'x-bg').rest))
    }
  }
  return out
}

/** Apple's TTML as lines: each line's words and background vocals, from
 * when it is sung; a translation or a pronunciation in the language asked
 * as a line of its own at the same time. */
interface Asked {
  translation: string
  pronunciation: string
  translated: Map<string, string>
  romanized: Map<string, string>
}

/** A line's words with its background vocals, in brackets unless they are. */
function wordsOf(bg: { taken: { text: string }[] }, rest: string): string {
  const words = plain(rest)
  const sung = bg.taken.map((t) => plain(takeRole(takeRole(t.text, 'x-translation').rest, 'x-roman').rest)).filter(Boolean).join(' ')
  if (!sung) return words
  return /^\(.*\)$/.test(sung) ? `${words} ${sung}` : `${words} (${sung})`
}

/** One <p>'s lines: its words, then its translation and pronunciation in
 * the languages asked, each from when it is sung. */
function paragraphLines(attributes: string, content: string, asked: Asked): LyricsLine[] {
  const start = seconds(attribute(attributes, 'begin'))
  const key = attribute(attributes, 'itunes:key')
  const bg = takeRole(content, 'x-bg')
  const tr = takeRole(bg.rest, 'x-translation')
  const ro = takeRole(tr.rest, 'x-roman')
  const text = wordsOf(bg, ro.rest)
  if (!text) return []
  const at = start >= 0 ? { startS: start } : {}
  const inLanguage = (taken: { lang: string; text: string }[], lang: string, head: Map<string, string>) =>
    lang ? taken.find((t) => t.lang.startsWith(lang))?.text || head.get(key) : ''
  const extra = [inLanguage(tr.taken, asked.translation, asked.translated), inLanguage(ro.taken, asked.pronunciation, asked.romanized)]
  return [{ text, ...at }, ...extra.filter((line): line is string => !!line).map((line) => ({ text: line, ...at }))]
}

/** Apple's TTML as lines: each line's words and background vocals, from
 * when it is sung; a translation or a pronunciation in the language asked
 * as a line of its own at the same time. */
function ttmlLines(ttml: string, translation: string, pronunciation: string): LyricsLine[] {
  const asked = { translation, pronunciation, translated: headTexts(ttml, 'translation', translation), romanized: headTexts(ttml, 'transliteration', pronunciation) }
  const body = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(ttml)?.[1] ?? ''
  return [...body.matchAll(/<p\s([^>]*)>([\s\S]*?)<\/p>/gi)].flatMap((p) => paragraphLines(p[1]!, p[2]!, asked))
}

async function lyrics(song: TrackQuery): Promise<LyricsResult> {
  const userToken = await setting('mediaUserToken')
  if (!userToken) return { status: 'none' }
  const found = await find(song)
  if (!found?.id) return { status: 'none' }
  const bearer = await token.getOr(findToken)
  const headers = { ...BROWSER, authorization: `Bearer ${bearer}`, 'media-user-token': userToken }
  const front = await storefront()
  let ttml = ''
  for (const kind of ['syllable-lyrics', 'lyrics']) {
    const answer = await fetchJson<Listing>(`${API}/${front}/songs/${found.id}/${kind}`, { headers }).catch((error: unknown) => {
      if (error instanceof HttpStatusError && (error.status === 401 || error.status === 403)) {
        throw new ProviderFailure('sign-in-required', { message: 'Apple Music refused the Media User Token: set it again' })
      }
      if (error instanceof HttpStatusError) return null
      throw error
    })
    ttml = s(answer?.data?.[0]?.attributes?.ttml)
    if (ttml) break
  }
  if (!ttml) return { status: 'none' }
  const lines = ttmlLines(ttml, (await setting('lyricsTranslation')).toLowerCase(), (await setting('lyricsPronunciation')).toLowerCase())
  if (lines.length === 0) return { status: 'none' }
  const synced = lines.every((line) => line.startS !== undefined)
  return { status: 'found', synced, lines: synced ? lines : lines.map((line) => ({ text: line.text })) }
}

// ── the providers ───────────────────────────────────────────────────────────

registerCatalog(SOURCE, { search, track: (id) => fetchTrack(id), album: (id) => fetchAlbum(id), playlist: (id) => fetchPlaylist(id), artist: (id) => fetchArtist(id), resolve })

songstress.providers.metadata.register(SOURCE, {
  enrich: async (track): Promise<TrackFacts | null> => {
    const direct = track.ids?.itunes
    const found = direct ? await fetchTrack(direct) : null
    const match = found ?? (await find(track).then((r) => (r?.id ? fetchTrack(r.id) : null)))
    if (!match) return null
    return { isrc: match.isrc, ids: { itunes: match.id }, releaseDate: match.releaseDate, explicit: match.explicit }
  },
})

songstress.providers.lyrics.register(SOURCE, { find: lyrics })
