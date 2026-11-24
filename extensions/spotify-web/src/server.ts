// Spotify Web, as a Songstress source: Spotify's own web player's catalogue
// (search, tracks, albums, playlists, artists, links, spotify: ones too)
// and the facts of a track Spotify keeps (its ISRC, its album's label and
// genres). It joins the Spotify group, and serves a listener who has not
// connected Spotify.
//
// A port of the Mornye "spotify-web" extension 1.10.4 (Copyright 2026
// zarzet, LGPL-3.0-only; see NOTICE). Spotify's web player is anonymous:
// its page hands out a client version and a device cookie, an access token
// takes a one-time code (totp.ts), a client token is granted for the
// device, and the catalogue answers GraphQL persisted queries. Unofficial:
// Spotify may change any of it.

import {
  base64Bytes,
  base64Text,
  bestMatch,
  fetchJson,
  fetchResponse,
  HttpStatusError,
  KeptValue,
  parseUrl,
  ProviderFailure,
  registerCatalog,
  songstress,
  urlParam,
  utf8Text,
  type CatalogAlbum,
  type CatalogAlbumDetail,
  type CatalogArtist,
  type CatalogArtistDetail,
  type CatalogPlaylist,
  type CatalogPlaylistDetail,
  type CatalogTrack,
  type LinkResult,
  type SearchQuery,
  type SearchResults,
  type TrackFacts,
  type TrackQuery,
} from 'songstress/server'
import { proto, protoAll, protoText } from './proto'
import { TOTP_VERSION, totp } from './totp'

const SOURCE = 'spotify-web'
const SITE = 'https://open.spotify.com'
const SKEW_MS = 60 * 1000
/** What a desktop browser sends: Spotify's web player is one. */
const BROWSER = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

// ── the web player's session ────────────────────────────────────────────────

interface Session {
  clientVersion: string
  deviceId: string
  cookies: Record<string, string>
  accessToken: string
  accessUntil: number
  clientId: string
  clientToken: string
  clientUntil: number
}

const kept = new KeptValue<Session>('session')

/** The cookies a response sets, from Set-Cookie headers the host joined
 * with commas (an Expires date holds one too). */
function cookiesIn(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  for (const part of (header ?? '').split(/,\s*(?=[A-Za-z0-9_.-]+=)/)) {
    const match = /^([^=;\s]+)=([^;]*)/.exec(part.trim())
    if (match) out[match[1]!] = match[2]!
  }
  return out
}

const cookieHeader = (cookies: Record<string, string>) =>
  Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join('; ')

function randomDevice(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function startSession(): Promise<Session> {
  const answer = await fetchResponse(SITE, { headers: { 'user-agent': BROWSER } })
  if (answer.status !== 200) throw new ProviderFailure('unavailable', { message: `open.spotify.com answered ${answer.status}` })
  const cookies = cookiesIn(answer.headers['set-cookie'])
  const config = /<script id="appServerConfig" type="text\/plain">([^<]+)<\/script>/.exec(answer.body)?.[1]
  let clientVersion = ''
  try {
    clientVersion = String((JSON.parse(base64Text(config ?? '')) as { clientVersion?: string }).clientVersion ?? '')
  } catch {
    // Left empty: refused below.
  }
  if (!clientVersion) throw new ProviderFailure('unavailable', { message: "Spotify's page named no client version" })
  return {
    clientVersion,
    deviceId: cookies.sp_t || randomDevice(),
    cookies,
    accessToken: '',
    accessUntil: 0,
    clientId: '',
    clientToken: '',
    clientUntil: 0,
  }
}

async function accessToken(s: Session): Promise<void> {
  const code = totp(Date.now())
  const url = `${SITE}/api/token?reason=init&productType=web-player&totp=${code}&totpVer=${TOTP_VERSION}&totpServer=${code}`
  const answer = await fetchResponse(url, { headers: { 'user-agent': BROWSER, cookie: cookieHeader(s.cookies), 'content-type': 'application/json;charset=UTF-8' } })
  if (answer.status !== 200) throw new ProviderFailure('unavailable', { message: `Spotify refused an access token (${answer.status})` })
  Object.assign(s.cookies, cookiesIn(answer.headers['set-cookie']))
  const data = JSON.parse(answer.body) as { accessToken?: string; clientId?: string; accessTokenExpirationTimestampMs?: number }
  if (!data.accessToken || !data.clientId) throw new ProviderFailure('unavailable', { message: "Spotify's access token came incomplete" })
  s.accessToken = data.accessToken
  s.clientId = data.clientId
  s.accessUntil = Number(data.accessTokenExpirationTimestampMs ?? 0) || Date.now() + 30 * 60 * 1000
}

async function clientToken(s: Session): Promise<void> {
  const body = JSON.stringify({
    client_data: {
      client_version: s.clientVersion,
      client_id: s.clientId,
      js_sdk_data: { device_brand: 'unknown', device_model: 'unknown', os: 'windows', os_version: 'NT 10.0', device_id: s.deviceId, device_type: 'computer' },
    },
  })
  const data = await fetchJson<{ response_type?: string; granted_token?: { token?: string; expires_after_seconds?: number } }>(
    'https://clienttoken.spotify.com/v1/clienttoken',
    { method: 'POST', body, headers: { 'user-agent': BROWSER, 'content-type': 'application/json', accept: 'application/json' } },
  )
  if (data.response_type !== 'RESPONSE_GRANTED_TOKEN_RESPONSE' || !data.granted_token?.token) {
    throw new ProviderFailure('unavailable', { message: 'Spotify granted no client token' })
  }
  s.clientToken = data.granted_token.token
  s.clientUntil = Date.now() + Number(data.granted_token.expires_after_seconds ?? 3600) * 1000
}

/** A session whose two tokens are good: kept, or made afresh. */
async function session(): Promise<Session> {
  const held = await kept.get()
  if (held && held.accessUntil - SKEW_MS > Date.now() && held.clientUntil - SKEW_MS > Date.now()) return held
  const s = held ?? (await startSession())
  if (!(s.accessUntil - SKEW_MS > Date.now())) await accessToken(s)
  if (!(s.clientUntil - SKEW_MS > Date.now())) await clientToken(s)
  await kept.set(s, Math.min(s.accessUntil, s.clientUntil))
  return s
}

function playerHeaders(s: Session): Record<string, string> {
  return { 'user-agent': BROWSER, authorization: `Bearer ${s.accessToken}`, 'client-token': s.clientToken, 'spotify-app-version': s.clientVersion }
}

/** A persisted GraphQL query of the web player. A session Spotify refuses
 * is made again, once. */
async function gql<T>(operationName: string, variables: Record<string, unknown>, sha256Hash: string): Promise<T> {
  const body = JSON.stringify({ variables, operationName, extensions: { persistedQuery: { version: 1, sha256Hash } } })
  for (let attempt = 0; ; attempt++) {
    const s = await session()
    try {
      return await fetchJson<T>('https://api-partner.spotify.com/pathfinder/v2/query', {
        method: 'POST',
        body,
        headers: { ...playerHeaders(s), 'content-type': 'application/json' },
      })
    } catch (error) {
      if (attempt === 0 && error instanceof HttpStatusError && error.status === 401) {
        await kept.delete()
        continue
      }
      if (error instanceof HttpStatusError) throw new ProviderFailure('unavailable', { message: error.message })
      throw error
    }
  }
}

// ── Spotify's shapes, and Songstress's ──────────────────────────────────────

type Raw = Record<string, unknown>

function at(value: unknown, path: string): unknown {
  let current: unknown = value
  for (const key of path.split('.')) {
    if (current === null || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[key]
  }
  return current
}

const str = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '')
const list = (v: unknown): Raw[] => (Array.isArray(v) ? (v as Raw[]) : [])
const idOfUri = (uri: unknown): string => str(uri).split(':').pop() ?? ''

/** The largest cover, at Spotify's largest size. */
function image(value: unknown): string | undefined {
  const v = value as Raw | undefined
  let sources = list(Array.isArray(v) ? v : v?.sources)
  if (!sources.length) sources = list(at(v, 'items.0.sources'))
  let found = ''
  let size = -1
  for (const source of sources) {
    const area = Number(source.width ?? 0) * Number(source.height ?? 0)
    if (source.url && area > size) {
      found = str(source.url)
      size = area
    }
  }
  return found ? found.replace('ab67616d00001e02', 'ab67616d000082c1').replace('ab67616d0000b273', 'ab67616d000082c1') : undefined
}

function date(value: unknown): string | undefined {
  if (typeof value === 'string') return value.split('T')[0] || undefined
  const d = value as { isoString?: string; year?: number; month?: number; day?: number } | undefined
  if (d?.isoString) return d.isoString.split('T')[0]
  if (!d?.year) return undefined
  const parts = [String(d.year)]
  if (d.month) parts.push(String(d.month).padStart(2, '0'))
  if (d.month && d.day) parts.push(String(d.day).padStart(2, '0'))
  return parts.join('-')
}

function artistsIn(items: unknown): { id: string; name: string }[] {
  const out: { id: string; name: string }[] = []
  for (const item of list(Array.isArray(items) ? items : at(items, 'items'))) {
    const a = ((item.data as Raw | undefined) ?? item) as Raw
    const name = str(at(a, 'profile.name') ?? a.name)
    const id = str(a.id) || idOfUri(a.uri)
    if (name && !out.some((o) => o.name.toLowerCase() === name.toLowerCase())) out.push({ id, name })
  }
  return out
}

const KINDS: Record<string, CatalogAlbum['kind']> = { ALBUM: 'album', SINGLE: 'single', EP: 'ep', COMPILATION: 'compilation' }

interface AlbumContext {
  id: string
  title: string
  cover?: string
  date?: string
  artists: string[]
}

/** A track's own artists; a track of an album page lists them apart. */
function trackArtists(t: Raw): { id: string; name: string }[] {
  const own = artistsIn(at(t, 'artists'))
  return own.length ? own : [...artistsIn(at(t, 'firstArtist')), ...artistsIn(at(t, 'otherArtists'))]
}

/** The album a track is on: the page's own, else the track's. */
function albumContextOf(t: Raw, album?: AlbumContext): AlbumContext {
  if (album) return album
  const a = (t.albumOfTrack as Raw | undefined) ?? {}
  return { id: str(a.id) || idOfUri(a.uri), title: str(a.name), cover: image(a.coverArt), date: date(a.date), artists: artistsIn(at(a, 'artists')).map((x) => x.name) }
}

const lengthOf = (t: Raw): number | undefined => Number(at(t, 'duration.totalMilliseconds') ?? at(t, 'trackDuration.totalMilliseconds') ?? 0) / 1000 || undefined

function trackOf(t: Raw, album?: AlbumContext): CatalogTrack | null {
  const id = str(t.id) || idOfUri(t.uri)
  const title = str(t.name)
  if (!id || !title) return null
  const artists = trackArtists(t)
  const on = albumContextOf(t, album)
  return {
    id,
    title,
    artists: artists.map((x) => x.name),
    artistId: artists[0]?.id || undefined,
    album: on.title || undefined,
    albumId: on.id || undefined,
    albumArtist: on.artists[0],
    durationS: lengthOf(t),
    trackNumber: Number(t.trackNumber ?? 0) || undefined,
    discNumber: Number(t.discNumber ?? 0) || undefined,
    releaseDate: on.date,
    explicit: at(t, 'contentRating.label') === 'EXPLICIT',
    coverUrl: on.cover,
    url: `${SITE}/track/${id}`,
    ids: { spotify: id },
  }
}

function albumOf(a: Raw): CatalogAlbum | null {
  const id = str(a.id) || idOfUri(a.uri)
  const title = str(a.name)
  if (!id || !title) return null
  const artists = artistsIn(at(a, 'artists'))
  return {
    id,
    title,
    artists: artists.map((x) => x.name),
    artistId: artists[0]?.id || undefined,
    kind: KINDS[str(a.type || a.albumType).toUpperCase()] ?? 'album',
    releaseDate: date(a.date),
    trackCount: Number(at(a, 'tracks.totalCount') ?? at(a, 'tracksV2.totalCount') ?? 0) || undefined,
    coverUrl: image(a.coverArt),
    url: `${SITE}/album/${id}`,
    ids: { spotify: id },
  }
}

function playlistOf(p: Raw): CatalogPlaylist | null {
  const id = str(p.id) || idOfUri(p.uri)
  const title = str(p.name)
  if (!id || !title) return null
  return {
    id,
    title,
    owner: str(at(p, 'ownerV2.data.name') ?? at(p, 'owner.name')) || undefined,
    description: str(p.description) || undefined,
    trackCount: Number(at(p, 'content.totalCount') ?? 0) || undefined,
    coverUrl: image(at(p, 'images.items.0')) ?? image(at(p, 'imagesV2.items.0')),
    url: `${SITE}/playlist/${id}`,
  }
}

function artistOf(a: Raw): CatalogArtist | null {
  const id = str(a.id) || idOfUri(a.uri)
  const name = str(at(a, 'profile.name') ?? a.name)
  if (!id || !name) return null
  return { id, name, imageUrl: image(at(a, 'visuals.avatarImage')), url: `${SITE}/artist/${id}`, ids: { spotify: id } }
}

const present = <T>(items: (T | null)[]): T[] => items.filter((i): i is T => i !== null)
const dataOf = (item: Raw): Raw => ((at(item, 'item.data') ?? item.data ?? item) as Raw)

// ── reading ─────────────────────────────────────────────────────────────────

const QUERIES = {
  search: 'fcad5a3e0d5af727fb76966f06971c19cfa2275e6ff7671196753e008611873c',
  track: '612585ae06ba435ad26369870deaae23b5c8800a256cd8a57e08eddc25a37294',
  album: 'b9bfabef66ed756e5e13f68a942deb60bd4125ec1f1be8cc42769dc0259b4b10',
  playlist: 'bb67e0af06e8d6f52b531f97468ee4acd44cd0f82b988e15c2ea47b1148efc77',
  artist: '446130b4a0aa6522a686aafccddb0ae849165b5e0436fd802f96e0243617b5d8',
  discography: '5e07d323febb57b4a56a42abbf781490e58764aa45feb6e3dc0591564fc56599',
}

const ID = /^[A-Za-z0-9]{22}$/

async function fetchTrack(id: string): Promise<CatalogTrack | null> {
  if (!ID.test(id)) return null
  const answer = await gql<Raw>('getTrack', { uri: `spotify:track:${id}` }, QUERIES.track)
  const t = at(answer, 'data.trackUnion') as Raw | undefined
  return t && t.name ? trackOf(t) : null
}

/** Every page of a paged list, 1,000 an ask, as the web player asks. */
async function pages(ask: (offset: number) => Promise<{ items: Raw[]; total: number }>): Promise<Raw[]> {
  const all: Raw[] = []
  for (let offset = 0, round = 0; round < 50; round++, offset += 1000) {
    const { items, total } = await ask(offset)
    all.push(...items)
    if (items.length < 1000 || all.length >= total) break
  }
  return all
}

async function fetchAlbum(id: string): Promise<CatalogAlbumDetail | null> {
  if (!ID.test(id)) return null
  let head: Raw | undefined
  const items = await pages(async (offset) => {
    const answer = await gql<Raw>('getAlbum', { uri: `spotify:album:${id}`, locale: '', offset, limit: 1000 }, QUERIES.album)
    const album = at(answer, 'data.albumUnion') as Raw | undefined
    head ??= album
    return { items: list(at(album, 'tracksV2.items')), total: Number(at(album, 'tracksV2.totalCount') ?? 0) }
  })
  const album = head ? albumOf({ ...head, id }) : null
  if (!album) return null
  const context = { id, title: album.title, cover: album.coverUrl, date: album.releaseDate, artists: album.artists }
  return { ...album, tracks: present(items.map((item, i) => withNumber(trackOf((item.track as Raw) ?? {}, context), i + 1))) }
}

function withNumber(t: CatalogTrack | null, n: number): CatalogTrack | null {
  return t ? { ...t, trackNumber: t.trackNumber ?? n } : null
}

async function fetchPlaylist(id: string): Promise<CatalogPlaylistDetail | null> {
  if (!ID.test(id)) return null
  let head: Raw | undefined
  const items = await pages(async (offset) => {
    const answer = await gql<Raw>('fetchPlaylist', { uri: `spotify:playlist:${id}`, offset, limit: 1000, enableWatchFeedEntrypoint: false }, QUERIES.playlist)
    const playlist = at(answer, 'data.playlistV2') as Raw | undefined
    head ??= playlist
    return { items: list(at(playlist, 'content.items')), total: Number(at(playlist, 'content.totalCount') ?? 0) }
  })
  const playlist = head ? playlistOf({ ...head, id }) : null
  if (!playlist) return null
  return { ...playlist, trackCount: items.length, tracks: present(items.map((item) => trackOf((at(item, 'itemV2.data') as Raw) ?? {}))) }
}

async function fetchArtist(id: string): Promise<CatalogArtistDetail | null> {
  if (!ID.test(id)) return null
  const overview = await gql<Raw>('queryArtistOverview', { uri: `spotify:artist:${id}`, locale: '' }, QUERIES.artist)
  const a = at(overview, 'data.artistUnion') as Raw | undefined
  const artist = a ? artistOf({ ...a, id }) : null
  if (!a || !artist) return null
  const releases: CatalogAlbum[] = []
  for (let offset = 0; offset < 1000; offset += 50) {
    const answer = await gql<Raw>('queryArtistDiscographyAll', { uri: `spotify:artist:${id}`, offset, limit: 50, order: 'DATE_DESC' }, QUERIES.discography).catch(() => null)
    const items = list(at(answer, 'data.artistUnion.discography.all.items'))
    releases.push(...present(items.map((item) => albumOf((at(item, 'releases.items.0') as Raw) ?? {}))))
    if (items.length < 50) break
  }
  return {
    ...artist,
    biography: str(at(a, 'profile.biography.text')) || undefined,
    albums: releases,
    topTracks: present(list(at(a, 'discography.topTracks.items')).map((item) => trackOf((item.track as Raw) ?? {}))),
  }
}

// ── search ──────────────────────────────────────────────────────────────────

async function search({ text, types, limit, offset }: SearchQuery): Promise<SearchResults> {
  const answer = await gql<Raw>(
    'searchDesktop',
    { searchTerm: text, offset, limit, numberOfTopResults: 5, includeAudiobooks: false, includeArtistHasConcertsField: false, includePreReleases: true, includeAuthors: false },
    QUERIES.search,
  )
  const found = (at(answer, 'data.searchV2') as Raw | undefined) ?? {}
  const out: SearchResults = {}
  const items = (...paths: string[]) => paths.map((p) => list(at(found, p))).find((l) => l.length) ?? []
  if (types.includes('track')) out.tracks = present(items('tracksV2.items', 'tracks.items').map((i) => trackOf((at(i, 'item.data') ?? i.track ?? i.data) as Raw)))
  if (types.includes('album')) out.albums = present(items('albumsV2.items', 'albums.items').map((i) => albumOf(dataOf(i))))
  if (types.includes('artist')) out.artists = present(items('artists.items').map((i) => artistOf(dataOf(i))))
  if (types.includes('playlist')) out.playlists = present(items('playlists.items').map((i) => playlistOf(dataOf(i))))
  return out
}

// ── links ───────────────────────────────────────────────────────────────────

const TYPES = ['track', 'album', 'playlist', 'artist']

/** What a spotify: link names. */
function parseUri(text: string): { type: string; id: string } | null {
  const parts = text.split(':').filter(Boolean)
  if (parts.length === 3 && TYPES.includes(parts[1]!)) return { type: parts[1]!, id: parts[2]! }
  if (parts.length === 5 && parts[1] === 'user' && parts[3] === 'playlist') return { type: 'playlist', id: parts[4]! }
  return null
}

/** What an open.spotify.com or play.spotify.com path names, a locale's
 * intl- and an embed's part left out. */
function parsePath(path: string): { type: string; id: string } | null {
  let parts = path.split('/').filter(Boolean)
  if (parts[0]?.startsWith('intl-')) parts = parts.slice(1)
  if (parts[0] === 'embed') parts = parts.slice(1)
  if (parts.length === 2 && TYPES.includes(parts[0]!)) return { type: parts[0]!, id: parts[1]! }
  if (parts.length === 4 && parts[2] === 'playlist') return { type: 'playlist', id: parts[3]! }
  return null
}

/** What a Spotify link names: an address, an embed's uri, or spotify:. */
function parseLink(link: string): { type: string; id: string } | null {
  const text = link.trim()
  if (text.toLowerCase().startsWith('spotify:')) return parseUri(text)
  const address = parseUrl(text)
  if (address?.host === 'embed.spotify.com') {
    const uri = urlParam(address, 'uri')
    return uri ? parseLink(uri) : null
  }
  return address?.host === 'open.spotify.com' || address?.host === 'play.spotify.com' ? parsePath(address.path) : null
}

async function resolve(link: string): Promise<LinkResult | null> {
  const parsed = parseLink(link)
  if (!parsed) return null
  switch (parsed.type) {
    case 'track': {
      const track = await fetchTrack(parsed.id)
      return track ? { type: 'track', track } : null
    }
    case 'album': {
      const album = await fetchAlbum(parsed.id)
      return album ? { type: 'album', album } : null
    }
    case 'playlist': {
      const playlist = await fetchPlaylist(parsed.id)
      return playlist ? { type: 'playlist', playlist } : null
    }
    case 'artist': {
      const artist = await fetchArtist(parsed.id)
      return artist ? { type: 'artist', artist } : null
    }
  }
  return null
}

// ── a track's facts: Spotify's own metadata, and Deezer's id by ISRC ────────

const BASE62 = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'

/** A base-62 Spotify id as the hex of its 16 bytes. */
function hexGid(id: string): string {
  const bytes: number[] = []
  for (const char of id) {
    let carry = BASE62.indexOf(char)
    if (carry < 0) return ''
    for (let j = 0; j < bytes.length; j++) {
      const total = bytes[j]! * 62 + carry
      bytes[j] = total & 0xff
      carry = total >> 8
    }
    for (; carry > 0; carry >>= 8) bytes.push(carry & 0xff)
  }
  while (bytes.length < 16) bytes.push(0)
  return bytes
    .slice(0, 16)
    .reverse()
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** The bytes of Spotify's metadata for a track or an album, or null. */
async function metadata(kind: 'track' | 'album', id: string): Promise<number[] | null> {
  const gid = hexGid(id)
  if (!gid) return null
  const s = await session()
  const answer = await fetchResponse(`https://spclient.wg.spotify.com/metadata/4/${kind}/${gid}?market=from_token`, {
    headers: { ...playerHeaders(s), 'app-platform': 'WebPlayer' },
    responseEncoding: 'base64',
  })
  return answer.status === 200 ? Array.from(base64Bytes(answer.body)) : null
}

/** A track's ISRC (its external ids, field 10, of type "isrc"), and its
 * album's (field 3) label (5) and genres (8). */
function factsOf(bytes: number[]): TrackFacts {
  const track = proto(bytes)
  let isrc: string | undefined
  for (const external of protoAll(track, 10)) {
    const e = proto(external)
    if (protoText(e, 1).toLowerCase() === 'isrc') isrc = protoText(e, 2).toUpperCase()
  }
  const albumBytes = protoAll(track, 3)[0]
  const album = albumBytes ? proto(albumBytes) : null
  const genres = album ? protoAll(album, 8).map(utf8Text) : []
  return { isrc, label: album ? protoText(album, 5) || undefined : undefined, genre: genres.filter(Boolean).join('; ') || undefined }
}

async function deezerId(isrc: string): Promise<string | undefined> {
  const found = await fetchJson<{ id?: number }>(`https://api.deezer.com/track/isrc:${encodeURIComponent(isrc)}`, { headers: { 'user-agent': BROWSER } }).catch(() => null)
  return found?.id ? String(found.id) : undefined
}

/** The Spotify track a song is: its Spotify id, else the search's best. */
async function spotifyIdOf(song: TrackQuery): Promise<string | null> {
  if (song.ids?.spotify && ID.test(song.ids.spotify)) return song.ids.spotify
  const found = await search({ text: `${song.title} ${song.artist}`.trim(), types: ['track'], limit: 10, offset: 0 })
  const match = bestMatch(song, found.tracks ?? [], (t) => ({ title: t.title, artist: t.artists.join(', '), album: t.album, durationS: t.durationS }), 70)
  return match?.id ?? null
}

async function enrich(song: TrackQuery): Promise<TrackFacts | null> {
  const id = await spotifyIdOf(song)
  if (!id) return null
  const bytes = await metadata('track', id)
  const facts: TrackFacts = bytes ? factsOf(bytes) : {}
  const deezer = facts.isrc ? await deezerId(facts.isrc) : undefined
  return { ...facts, ids: { spotify: id, ...(deezer ? { deezer } : {}) } }
}

// ── the providers ───────────────────────────────────────────────────────────

registerCatalog(SOURCE, { search, track: fetchTrack, album: fetchAlbum, playlist: fetchPlaylist, artist: fetchArtist, resolve })

songstress.providers.metadata.register(SOURCE, { enrich })
