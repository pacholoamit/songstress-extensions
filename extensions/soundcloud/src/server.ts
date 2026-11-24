// SoundCloud, as a Songstress source: search, its tracks, sets and artists
// by id or by link, an ISRC for a track that lacks one, a progressive
// stream to audition, and a track it streams in full to acquire.
//
// A port of the Mornye "soundcloud" extension 1.0.12 (Copyright 2026
// zarzet, LGPL-3.0-only; see NOTICE). SoundCloud's api-v2 needs a client id,
// which its own site hands out in its page or its script bundles
// (findInAnswer: the one that holds it is larger than the extension host
// answers in one request).

import {
  bestMatch,
  fetchJson,
  fetchResponse,
  fetchText,
  findInAnswer,
  HttpStatusError,
  KeptValue,
  nullIfMissing,
  parseUrl,
  ProviderFailure,
  queryString,
  registerCatalog,
  resolveUrl,
  songstress,
  type CatalogAlbum,
  type CatalogAlbumDetail,
  type CatalogArtist,
  type CatalogArtistDetail,
  type CatalogPlaylist,
  type CatalogPlaylistDetail,
  type CatalogTrack,
  type DownloadLocation,
  type LinkResult,
  type SearchQuery,
  type SearchResults,
  type StreamLocation,
  type TrackQuery,
} from 'songstress/server'

const SOURCE = 'soundcloud'
const API = 'https://api-v2.soundcloud.com'
const DAY_MS = 24 * 60 * 60 * 1000
/** What a desktop browser sends: SoundCloud answers it as it answers one. */
const BROWSER = { 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36' }

// ── the client id ───────────────────────────────────────────────────────────

const CLIENT_ID = /["']?client_id["']?\s*[:=]\s*["']([a-zA-Z0-9]{32})["']/
const clientId = new KeptValue<string>('client-id')

/** The client id in SoundCloud's page, else in its last script bundles. */
async function findClientId(): Promise<{ value: string; until: number }> {
  const page = await fetchText('https://soundcloud.com/', { headers: BROWSER }).catch((error: unknown) => {
    throw error instanceof HttpStatusError ? new ProviderFailure('unavailable', { message: error.message }) : error
  })
  const direct = CLIENT_ID.exec(page)
  if (direct) return { value: direct[1]!, until: Date.now() + DAY_MS }
  const bundles = [...page.matchAll(/src="(https:\/\/[^"]*sndcdn\.com\/assets\/[^"]+\.js)"/g)].map((m) => m[1]!)
  const inScript = (code: string): string | null =>
    (CLIENT_ID.exec(code) ?? /\("client_id=([a-zA-Z0-9]{32})"\)/.exec(code) ?? /client_id=([a-zA-Z0-9]{32})/.exec(code))?.[1] ?? null
  for (const bundle of bundles.slice(-8).reverse()) {
    const found = await findInAnswer(bundle, inScript, { headers: BROWSER }).catch(() => null)
    if (found) return { value: found, until: Date.now() + DAY_MS }
  }
  throw new ProviderFailure('unavailable', { message: 'SoundCloud handed out no client id' })
}

/** One of api-v2's answers. A client id it refuses is asked for again,
 * once; a 404 is null. */
async function api<T>(path: string, params: Record<string, string | number | undefined> = {}): Promise<T | null> {
  for (let attempt = 0; ; attempt++) {
    const id = await clientId.getOr(findClientId)
    const separator = path.includes('?') ? '&' : '?'
    try {
      return await nullIfMissing(() => fetchJson<T>(`${API}/${path}${separator}${queryString({ ...params, client_id: id })}`, { headers: BROWSER }), [400, 404])
    } catch (error) {
      if (attempt === 0 && error instanceof HttpStatusError && (error.status === 401 || error.status === 403)) {
        await clientId.delete()
        continue
      }
      if (error instanceof HttpStatusError) throw new ProviderFailure('unavailable', { message: error.message })
      throw error
    }
  }
}

// ── SoundCloud's shapes, and Songstress's ───────────────────────────────────

interface Transcoding {
  url?: string
  preset?: string
  snipped?: boolean
  quality?: string
  format?: { protocol?: string; mime_type?: string }
}

interface ScUser {
  id?: number | string
  username?: string
  full_name?: string
  avatar_url?: string
  permalink_url?: string
}

interface ScTrack {
  id?: number | string
  kind?: string
  title?: string
  duration?: number
  full_duration?: number
  access?: string
  streamable?: boolean
  track_authorization?: string
  permalink_url?: string
  artwork_url?: string
  display_date?: string
  created_at?: string
  genre?: string
  label_name?: string
  metadata_artist?: string
  isrc?: string
  user?: ScUser
  publisher_metadata?: { artist?: string; album_title?: string; release_title?: string; isrc?: string; explicit?: boolean }
  media?: { transcodings?: Transcoding[] }
}

interface ScSet {
  id?: number | string
  kind?: string
  title?: string
  is_album?: boolean
  set_type?: string
  artwork_url?: string
  permalink_url?: string
  display_date?: string
  published_at?: string
  created_at?: string
  track_count?: number
  description?: string
  user?: ScUser
  tracks?: ScTrack[]
}

const ALBUM_SETS = ['album', 'ep', 'single', 'compilation']

function artwork(url: string | undefined, size: 'original' | 't500x500'): string | undefined {
  return url ? url.replace('-large.', `-${size}.`) : undefined
}

function artistOfTrack(t: ScTrack): string {
  return t.publisher_metadata?.artist || t.metadata_artist || t.user?.username || ''
}

function dateOf(value: string | undefined): string | undefined {
  return value ? value.slice(0, 10) : undefined
}

function coverOf(artworkUrl: string | undefined, user: ScUser | undefined): string | undefined {
  return artwork(artworkUrl, 'original') ?? artwork(user?.avatar_url, 't500x500')
}

function trackOf(t: ScTrack): CatalogTrack | null {
  if (!t.id || !t.title) return null
  const artist = artistOfTrack(t)
  const meta = t.publisher_metadata ?? {}
  return {
    id: String(t.id),
    title: t.title,
    artists: artist ? [artist] : [],
    artistId: t.user?.id ? String(t.user.id) : undefined,
    album: meta.album_title || meta.release_title || undefined,
    albumArtist: t.user?.username,
    durationS: (t.full_duration || t.duration || 0) / 1000 || undefined,
    releaseDate: dateOf(t.display_date || t.created_at),
    isrc: meta.isrc || t.isrc || undefined,
    explicit: meta.explicit,
    coverUrl: coverOf(t.artwork_url, t.user),
    url: t.permalink_url,
  }
}

function isAlbum(s: ScSet): boolean {
  return s.is_album === true || ALBUM_SETS.includes(s.set_type ?? '')
}

function albumOf(s: ScSet): CatalogAlbum | null {
  if (!s.id || !s.title) return null
  const kind = s.set_type === 'compilation' || s.set_type === 'single' || s.set_type === 'ep' ? s.set_type : 'album'
  return {
    id: String(s.id),
    title: s.title,
    artists: s.user?.username ? [s.user.username] : [],
    artistId: s.user?.id ? String(s.user.id) : undefined,
    kind,
    releaseDate: dateOf(s.display_date || s.published_at || s.created_at),
    trackCount: s.track_count,
    coverUrl: coverOf(s.artwork_url, s.user),
    url: s.permalink_url,
  }
}

function playlistOf(s: ScSet): CatalogPlaylist | null {
  if (!s.id || !s.title) return null
  return {
    id: String(s.id),
    title: s.title,
    owner: s.user?.username,
    description: s.description || undefined,
    trackCount: s.track_count,
    coverUrl: coverOf(s.artwork_url, s.user),
    url: s.permalink_url,
  }
}

function artistOf(u: ScUser): CatalogArtist | null {
  if (!u.id) return null
  const name = u.username || u.full_name
  if (!name) return null
  return { id: String(u.id), name, imageUrl: artwork(u.avatar_url, 'original'), url: u.permalink_url }
}

function present<T>(items: (T | null)[]): T[] {
  return items.filter((item): item is T => item !== null)
}

// ── reading ─────────────────────────────────────────────────────────────────

interface Page<T> {
  collection?: T[]
}

async function fetchTrack(id: string): Promise<ScTrack | null> {
  return /^\d+$/.test(id) ? api<ScTrack>(`tracks/${id}`) : null
}

/** A set's tracks, the abbreviated ones fetched whole, 50 at a time. */
async function setTracks(s: ScSet): Promise<CatalogTrack[]> {
  const whole: ScTrack[] = []
  const missing: string[] = []
  for (const t of s.tracks ?? []) {
    if (t.title) whole.push(t)
    else if (t.id) missing.push(String(t.id))
  }
  const fetched = new Map<string, ScTrack>()
  for (let at = 0; at < missing.length; at += 50) {
    const batch = missing.slice(at, at + 50)
    const found = (await api<ScTrack[]>('tracks', { ids: batch.join(',') }).catch(() => null)) ?? []
    for (const t of found) fetched.set(String(t.id), t)
  }
  const ordered = (s.tracks ?? []).map((t) => (t.title ? t : fetched.get(String(t.id)) ?? null))
  return present(ordered.map((t, i) => (t ? withNumber(trackOf(t), i + 1) : null)))
}

function withNumber(t: CatalogTrack | null, n: number): CatalogTrack | null {
  return t ? { ...t, trackNumber: n } : null
}

async function fetchSet(id: string): Promise<ScSet | null> {
  return /^\d+$/.test(id) ? api<ScSet>(`playlists/${id}`, { representation: 'full' }) : null
}

async function albumDetail(s: ScSet): Promise<CatalogAlbumDetail | null> {
  const album = albumOf(s)
  return album ? { ...album, tracks: await setTracks(s) } : null
}

async function playlistDetail(s: ScSet): Promise<CatalogPlaylistDetail | null> {
  const playlist = playlistOf(s)
  return playlist ? { ...playlist, tracks: await setTracks(s) } : null
}

async function artistDetail(id: string): Promise<CatalogArtistDetail | null> {
  if (!/^\d+$/.test(id)) return null
  const user = await api<ScUser>(`users/${id}`)
  const artist = user ? artistOf(user) : null
  if (!artist) return null
  const top = (await api<Page<ScTrack>>(`users/${id}/toptracks`, { limit: 20 }).catch(() => null)) ??
    (await api<Page<ScTrack>>(`users/${id}/tracks`, { limit: 20 }).catch(() => null))
  const albums = await api<Page<ScSet>>(`users/${id}/albums`, { limit: 50 }).catch(() => null)
  return {
    ...artist,
    albums: present((albums?.collection ?? []).map(albumOf)),
    topTracks: present((top?.collection ?? []).map(trackOf)),
  }
}

// ── search ──────────────────────────────────────────────────────────────────

const SEARCHED = { track: 'tracks', album: 'albums', artist: 'users', playlist: 'playlists' } as const

type Found = ScTrack & ScSet & ScUser

/** One kind's results into out. */
function fill(out: SearchResults, type: string, items: Found[]): void {
  if (type === 'track') out.tracks = present(items.map(trackOf))
  if (type === 'album') out.albums = present(items.map(albumOf))
  if (type === 'artist') out.artists = present(items.map(artistOf))
  if (type === 'playlist') out.playlists = present(items.map(playlistOf))
}

/** Each kind asked, searched apart: a kind that fails leaves the others;
 * when all fail, the first failure is the answer. */
async function search({ text, types, limit, offset }: SearchQuery): Promise<SearchResults> {
  const out: SearchResults = {}
  const failures: unknown[] = []
  const asked = types.filter((type) => type in SEARCHED)
  for (const type of asked) {
    const access = type === 'track' ? 'playable' : undefined
    const page = await api<Page<Found>>(`search/${SEARCHED[type as keyof typeof SEARCHED]}`, { q: text, limit, offset, access }).catch((error: unknown) => {
      failures.push(error)
      return undefined
    })
    if (page !== undefined) fill(out, type, page?.collection ?? [])
  }
  if (asked.length > 0 && failures.length === asked.length) throw failures[0]
  return out
}

/** SoundCloud's playable tracks most like the song, best first. */
async function find(song: TrackQuery, min: number): Promise<ScTrack | null> {
  const words = `${song.title} ${song.artist}`.trim()
  if (!words) return null
  const page = await api<Page<ScTrack>>('search/tracks', { q: words, limit: 5, access: 'playable' })
  const wanted = { title: song.title, artist: song.artist, durationS: song.durationS }
  return bestMatch(
    wanted,
    page?.collection ?? [],
    (t) => ({ title: t.title ?? '', artist: artistOfTrack(t), durationS: (t.duration ?? 0) / 1000 }),
    min,
  )
}

// ── links ───────────────────────────────────────────────────────────────────

interface Resolved extends ScTrack, ScSet, ScUser {}

/** Where a short on.soundcloud.com link leads: the page it redirects to, or
 * the canonical address that page names. */
async function unshorten(url: string): Promise<string> {
  const answer = await fetchResponse(url, { headers: BROWSER })
  if (parseUrl(answer.url)?.host.endsWith('soundcloud.com') && !answer.url.includes('on.soundcloud.com')) {
    return answer.url.split('?')[0]!
  }
  const canonical = /<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i.exec(answer.body) ??
    /<meta[^>]*property=["']og:url["'][^>]*content=["']([^"']+)["']/i.exec(answer.body)
  return canonical?.[1]?.split('?')[0] ?? url
}

/** What a resolved set is: an album or a playlist, with its tracks. */
async function setResult(found: Resolved): Promise<LinkResult | null> {
  const whole = (await fetchSet(String(found.id))) ?? found
  if (isAlbum(found)) {
    const album = await albumDetail(whole)
    return album ? { type: 'album', album } : null
  }
  const playlist = await playlistDetail(whole)
  return playlist ? { type: 'playlist', playlist } : null
}

/** What a resolved thing is, by its kind. */
async function resultOf(found: Resolved): Promise<LinkResult | null> {
  switch (found.kind) {
    case 'track': {
      const track = trackOf(found)
      return track ? { type: 'track', track } : null
    }
    case 'playlist':
      return setResult(found)
    case 'user': {
      const artist = await artistDetail(String(found.id))
      return artist ? { type: 'artist', artist } : null
    }
  }
  return null
}

async function resolve(url: string): Promise<LinkResult | null> {
  let address = url.trim().replace(/^https?:\/\/m\.soundcloud\.com/i, 'https://soundcloud.com')
  if (parseUrl(address)?.host === 'on.soundcloud.com') address = await unshorten(address)
  const found = await api<Resolved>('resolve', { url: address })
  return found?.id ? resultOf(found) : null
}

// ── audio ───────────────────────────────────────────────────────────────────

type Container = 'm4a' | 'mp3' | 'opus'

function containerOf(t: Transcoding): Container | null {
  const mime = (t.format?.mime_type ?? '').toLowerCase()
  const preset = (t.preset ?? '').toLowerCase()
  if (/aac|mp4|mp4a/.test(mime) || preset.startsWith('aac_')) return 'm4a'
  if (/opus/.test(mime) || preset.startsWith('opus_')) return 'opus'
  if (/mpeg|mp3/.test(mime)) return 'mp3'
  return null
}

/** The whole-track transcodings, best first: AAC, then Opus, then MP3,
 * the higher bitrate first. A preview (snipped) never counts. */
function ranked(t: ScTrack, protocol?: string): Transcoding[] {
  const order = { m4a: 60, opus: 40, mp3: 20 }
  return (t.media?.transcodings ?? [])
    .filter((x) => x.url && !x.snipped && !/preview/.test(x.preset ?? '') && containerOf(x) && (!protocol || x.format?.protocol === protocol))
    .filter((x) => x.format?.protocol === 'hls' || x.format?.protocol === 'progressive')
    .map((x) => {
      const kbps = /_(\d+)k/.exec(x.preset ?? '')
      return { x, score: order[containerOf(x)!] + (kbps ? Math.min(320, Number(kbps[1])) / 100 : 0) + (x.quality === 'hq' ? 5 : 0) }
    })
    .sort((a, b) => b.score - a.score)
    .map((r) => r.x)
}

function playable(t: ScTrack | null): t is ScTrack {
  return !!t && t.streamable !== false && (!t.access || t.access === 'playable')
}

/** The address a transcoding streams from, for this track. */
async function streamAddress(x: Transcoding, t: ScTrack): Promise<string> {
  const answer = await api<{ url?: string }>(x.url!.replace(API + '/', ''), { track_authorization: t.track_authorization })
  if (!answer?.url) throw new ProviderFailure('unavailable', { message: 'SoundCloud handed out no stream address' })
  return answer.url
}

interface Playlist {
  urls: string[]
  initUrl?: string
  durationS: number
}

/** An HLS playlist's segments: a master playlist's best variant followed,
 * encryption and byte ranges refused (Songstress joins whole segments and
 * decrypts nothing). */
async function readPlaylist(url: string, depth = 0): Promise<Playlist> {
  if (depth > 3) throw new ProviderFailure('unavailable', { message: 'the HLS playlist nests too deep' })
  const body = (await fetchText(url, { headers: BROWSER })).trim()
  if (!body.startsWith('#EXTM3U')) throw new ProviderFailure('unavailable', { message: 'not an HLS playlist' })
  const read = new PlaylistReader(url)
  for (const line of body.split(/\r?\n/)) read.line(line.trim())
  if (read.variants.length) return readPlaylist(read.variants.sort((a, b) => b.bandwidth - a.bandwidth)[0]!.url, depth + 1)
  if (!read.ended || read.out.urls.length === 0) throw new ProviderFailure('unavailable', { message: 'the HLS playlist is incomplete' })
  return read.out
}

/** A playlist's lines, read in order. */
class PlaylistReader {
  readonly variants: { url: string; bandwidth: number }[] = []
  readonly out: Playlist = { urls: [], durationS: 0 }
  ended = false
  private variant: number | null = null

  constructor(private readonly base: string) {}

  line(line: string): void {
    if (!line) return
    if (line.startsWith('#')) {
      this.tag(line)
      return
    }
    if (this.variant !== null) this.variants.push({ url: resolveUrl(line, this.base), bandwidth: this.variant })
    else this.out.urls.push(resolveUrl(line, this.base))
    this.variant = null
  }

  private tag(line: string): void {
    if (line.startsWith('#EXT-X-STREAM-INF:')) this.variant = Number(/BANDWIDTH=(\d+)/.exec(line)?.[1] ?? 0)
    else if (line.startsWith('#EXT-X-KEY:') && !/METHOD=NONE/.test(line)) throw new ProviderFailure('unavailable', { message: 'the stream is encrypted' })
    else if (line.startsWith('#EXT-X-BYTERANGE')) throw new ProviderFailure('unavailable', { message: 'the stream is in byte ranges' })
    else if (line.startsWith('#EXT-X-MAP:')) this.out.initUrl = resolveUrl(/URI="([^"]+)"/.exec(line)?.[1] ?? '', this.base)
    else if (line.startsWith('#EXTINF:')) this.out.durationS += Number(line.slice(8).split(',')[0]) || 0
    else if (line === '#EXT-X-ENDLIST') this.ended = true
  }
}

async function locate(id: string): Promise<{ location: DownloadLocation; tags?: { isrc?: string } } | null> {
  const t = await fetchTrack(id)
  if (!playable(t)) return null
  const expected = (t.duration ?? 0) / 1000
  let lastFailure: unknown = null
  for (const x of ranked(t).slice(0, 6)) {
    try {
      const container = containerOf(x)!
      const address = await streamAddress(x, t)
      const tags = { isrc: trackOf(t)?.isrc }
      if (x.format?.protocol === 'progressive') return { location: { kind: 'file', url: address, container }, tags }
      const hls = await readPlaylist(address)
      if (expected > 0 && Math.abs(hls.durationS - expected) > Math.max(5, expected * 0.02)) {
        throw new ProviderFailure('unavailable', { message: 'the stream is not the whole track' })
      }
      return { location: { kind: 'segments', urls: hls.urls, initUrl: hls.initUrl, container }, tags }
    } catch (error) {
      lastFailure = error
    }
  }
  if (lastFailure) throw lastFailure
  return null
}

async function stream(id: string): Promise<StreamLocation | null> {
  const t = await fetchTrack(id)
  if (!playable(t)) return null
  const progressive = ranked(t, 'progressive')[0]
  return progressive ? { url: await streamAddress(progressive, t), container: containerOf(progressive)! } : null
}

// ── the providers ───────────────────────────────────────────────────────────

registerCatalog(SOURCE, {
  search,
  track: async (id) => {
    const t = await fetchTrack(id)
    return t ? trackOf(t) : null
  },
  album: async (id) => {
    const s = await fetchSet(id)
    return s ? albumDetail(s) : null
  },
  playlist: async (id) => {
    const s = await fetchSet(id)
    return s ? playlistDetail(s) : null
  },
  artist: artistDetail,
  resolve,
})

songstress.providers.metadata.register(SOURCE, {
  enrich: async (track) => {
    const found = await find(track, 60)
    if (!found) return null
    return { isrc: trackOf(found)?.isrc, genre: found.genre || undefined, label: found.label_name || undefined }
  },
})

songstress.providers.play.register(SOURCE, { resolve: (track) => stream(track.id) })

songstress.providers.download.register(SOURCE, {
  check: async (track) => {
    const found = await find(track, 65)
    return playable(found) ? { available: true, id: String(found.id) } : { available: false }
  },
  locate: (request) => locate(request.id),
})
