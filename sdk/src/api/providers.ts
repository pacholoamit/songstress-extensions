// Providers: what Songstress asks an extension for. Each kind below is one of
// the manifest's `contributes.providers` kinds, declared there and registered
// here, in the server entry, under the same id:
//
//   songstress.providers.lyrics.register('lrc', { find: async (song) => ... })
//
// A provider adds to Songstress's own sources and never replaces one. It
// joins switched off or last, the admin's order decides, and one that fails
// never fails the rest. A call runs under a deadline; state does not survive
// between calls unless it is put in storage.
//
// "Nothing found" is an empty list or null. A failure Songstress knows what
// to do about is a ProviderFailure. Anything else that is thrown counts as
// the provider being broken for now.
//
// Lengths are in seconds. Text is as the source gives it; addresses are http
// or https.

import type { CatalogType, ProviderGroup } from '../manifest/types.generated'
import type { Awaitable, Disposable } from './common'
import type { Song } from './library'

// ── what a source lists ──────────────────────────────────────────────────────

/** The ids a thing has in Songstress's own catalogues, when the source knows
 * them: they let Songstress see that two sources mean the same thing. */
export type CatalogIds = Partial<Record<ProviderGroup, string>>

/** What a source says about the audio it would hand out for a track. */
export interface AudioFacts {
  /** "flac", "aac", "mp3", "opus"… */
  codec?: string
  /** Bits a sample, for lossless audio. */
  bitDepth?: number
  /** Samples a second, in hertz. */
  sampleRateHz?: number
  /** Its bitrate, in kilobits a second. */
  bitrateKbps?: number
}

/** A track as a source lists it. `id` is the source's own. */
export interface CatalogTrack {
  /** The source's own id for it. */
  id: string
  /** The title without the words of its edition, when the source keeps
   * them apart (see `version`). */
  title: string
  /** The edition, when the source names it apart from the title: "Live",
   * "Remastered 2011", "Radio Edit". Songstress tells two editions of one
   * song apart by it. */
  version?: string
  /** Its artists' names, the main one first. */
  artists: string[]
  /** The source's id of the first artist. */
  artistId?: string
  /** Its album's title. */
  album?: string
  /** The source's id for its album. */
  albumId?: string
  /** The album's artist, where it is not the track's. */
  albumArtist?: string
  /** Its length, in seconds. */
  durationS?: number
  /** Its place on the album. */
  trackNumber?: number
  /** Its disc. */
  discNumber?: number
  /** YYYY, YYYY-MM or YYYY-MM-DD. */
  releaseDate?: string
  /** Its ISRC. */
  isrc?: string
  /** Marked explicit. */
  explicit?: boolean
  /** Its cover's address, http or https. */
  coverUrl?: string
  /** The track's page on the source's own site. */
  url?: string
  /** Its ids in the catalogues Songstress knows. */
  ids?: CatalogIds
  /** What the source's audio is: its format and quality. */
  audio?: AudioFacts
}

/** An album of a source's catalogue, as a search or a link finds it. */
export interface CatalogAlbum {
  /** The source's own id for it. */
  id: string
  /** Its title. */
  title: string
  /** Its artists' names, the main one first. */
  artists: string[]
  /** The source's id for its main artist. */
  artistId?: string
  /** What kind of release it is. */
  kind?: 'album' | 'single' | 'ep' | 'compilation'
  /** When it came out, as an ISO 8601 date or a year. */
  releaseDate?: string
  /** How many tracks it holds. */
  trackCount?: number
  /** Marked explicit. */
  explicit?: boolean
  /** Its UPC barcode. */
  upc?: string
  /** Its cover's address, http or https. */
  coverUrl?: string
  /** Its page at the source. */
  url?: string
  /** Its ids in the catalogues Songstress knows. */
  ids?: CatalogIds
}

/** An artist of a source's catalogue, as a search or a link finds them. */
export interface CatalogArtist {
  /** The source's own id for it. */
  id: string
  /** Their name. */
  name: string
  /** Their picture's address, http or https. */
  imageUrl?: string
  /** Its page at the source. */
  url?: string
  /** Its ids in the catalogues Songstress knows. */
  ids?: CatalogIds
}

/** A playlist of a source's catalogue, as a search or a link finds it. */
export interface CatalogPlaylist {
  /** The source's own id for it. */
  id: string
  /** Its title. */
  title: string
  /** Who made it, as the source names them. */
  owner?: string
  /** What the playlist says about itself. */
  description?: string
  /** How many tracks it holds. */
  trackCount?: number
  /** Its cover's address, http or https. */
  coverUrl?: string
  /** Its page at the source. */
  url?: string
}

/** An album of a source's catalogue, opened: with its tracks. */
export interface CatalogAlbumDetail extends CatalogAlbum {
  /** Its tracks, in order. */
  tracks: CatalogTrack[]
}

/** A playlist of a source's catalogue, opened: with its tracks. */
export interface CatalogPlaylistDetail extends CatalogPlaylist {
  /** Its tracks, in order. */
  tracks: CatalogTrack[]
}

/** An artist of a source's catalogue, opened: with their albums and top tracks. */
export interface CatalogArtistDetail extends CatalogArtist {
  /** Who they are, in words. */
  biography?: string
  /** Their albums. */
  albums: CatalogAlbum[]
  /** The artist's most played tracks, most played first. */
  topTracks?: CatalogTrack[]
}

/** What every provider call is told. */
export interface ProviderContext {
  /** The member the answer is for. Absent when the server asks for itself,
   * as a background job does. */
  userId?: string
}

/** A song Songstress wants something for: what its tags say. */
export interface TrackQuery {
  /** The track's title. */
  title: string
  /** Its artist's name. */
  artist: string
  /** Its album's title. */
  album?: string
  /** Its length, in seconds. */
  durationS?: number
  /** Its ISRC, when known. */
  isrc?: string
  /** Its ids in the catalogues it is known in. */
  ids?: CatalogIds
}

// ── failures ─────────────────────────────────────────────────────────────────

/** - `rate-limited`: the source asks to slow down; Songstress waits `retryAfterS`
 * - `sign-in-required`: the source wants a sign-in the settings do not hold, or no longer accept
 * - `not-configured`: a setting the provider needs is empty
 * - `unavailable`: the source is down, or refuses this request for now */
export type ProviderFailureCode = 'rate-limited' | 'sign-in-required' | 'not-configured' | 'unavailable'

/** A failure Songstress knows what to do about. The message is for the
 * server's log and the admin: never put a token or a signed address in it.
 * @example
 * ```ts
 * import { ProviderFailure, songstress } from 'songstress/server'
 *
 * songstress.providers.search.register('my-source', {
 *   async search(query) {
 *     const key = await songstress.settings.get<string>('api-key')
 *     if (!key) throw new ProviderFailure('not-configured', { message: 'no API key set' })
 *     const answer = await songstress.net.fetch(`https://api.example.com/search?q=${encodeURIComponent(query.text)}`, {
 *       headers: { 'x-api-key': key },
 *     })
 *     if (answer.status === 429) throw new ProviderFailure('rate-limited', { retryAfterS: 60 })
 *     if (answer.status !== 200) throw new ProviderFailure('unavailable', { message: `the source answered ${answer.status}` })
 *     return { tracks: JSON.parse(answer.body) }
 *   },
 * })
 * ```
 */
export class ProviderFailure extends Error {
  override readonly name = 'ProviderFailure'
  readonly code: ProviderFailureCode
  /** How long to leave the source alone, in seconds. */
  readonly retryAfterS?: number

  /** A failure with its code.
   * @param code - What went wrong, as a code.
   * @param options - A sentence for the log (`message`), and how long to leave the source alone (`retryAfterS`).
   */
  constructor(code: ProviderFailureCode, options: { message?: string; retryAfterS?: number } = {}) {
    super(options.message ?? code)
    this.code = code
    this.retryAfterS = options.retryAfterS
  }
}

// ── search, lookup, links ────────────────────────────────────────────────────

/** What a search asks a source. */
export interface SearchQuery {
  /** What the person typed. */
  text: string
  /** The kinds asked for, from those the manifest lists under `types`. */
  types: CatalogType[]
  /** How many of each kind, at most. */
  limit: number
  /** How many of each kind to skip: the next page. */
  offset: number
}

/** What a source found, for each kind asked. Leave out a kind it found nothing of. */
export interface SearchResults {
  /** The tracks found, best first. */
  tracks?: CatalogTrack[]
  /** The albums found, best first. */
  albums?: CatalogAlbum[]
  /** The artists found, best first. */
  artists?: CatalogArtist[]
  /** The playlists found, best first. */
  playlists?: CatalogPlaylist[]
}

/** Answers a search. */
export interface SearchProvider {
  /** Searches the source for the query's text, in the kinds it asks for.
   * @param query - What to search for.
   * @param context - Who the answer is for.
   */
  search(query: SearchQuery, context: ProviderContext): Awaitable<SearchResults>
}

/** Opens one thing by the source's own id. Implement a method for each kind
 * the manifest lists under `types`. Null when the source has no such thing. */
export interface LookupProvider {
  /** The track with this id.
   * @param id - The source's own id for the track.
   * @param context - Who the answer is for.
   */
  track?(id: string, context: ProviderContext): Awaitable<CatalogTrack | null>
  /** The album with this id, with its tracks.
   * @param id - The source's own id for the album.
   * @param context - Who the answer is for.
   */
  album?(id: string, context: ProviderContext): Awaitable<CatalogAlbumDetail | null>
  /** The artist with this id, with their albums and top tracks.
   * @param id - The source's own id for the artist.
   * @param context - Who the answer is for.
   */
  artist?(id: string, context: ProviderContext): Awaitable<CatalogArtistDetail | null>
  /** The playlist with this id, with its tracks.
   * @param id - The source's own id for the playlist.
   * @param context - Who the answer is for.
   */
  playlist?(id: string, context: ProviderContext): Awaitable<CatalogPlaylistDetail | null>
}

/** What a link turned out to be. */
export type LinkResult =
  | { type: 'track'; track: CatalogTrack }
  | { type: 'album'; album: CatalogAlbumDetail }
  | { type: 'artist'; artist: CatalogArtistDetail }
  | { type: 'playlist'; playlist: CatalogPlaylistDetail }

/** Reads a link one of the manifest's `patterns` claimed: a pasted address,
 * or a playlist a member follows. Null when it leads nowhere. */
export interface LinkProvider {
  /** What the link is: a track, an album, an artist or a playlist of the source's.
   * @param url - The pasted link.
   * @param context - Who the answer is for.
   */
  resolve(url: string, context: ProviderContext): Awaitable<LinkResult | null>
}

// ── lyrics, metadata, artwork, artist info ───────────────────────────────────

/** One line of lyrics. */
export interface LyricsLine {
  /** One line, at most 500 characters: line breaks and tabs become spaces
   * and control characters go. An empty line is kept, as a pause. */
  text: string
  /** When the line is sung, in seconds from the start, from 0 to seven days.
   * On every line of synced lyrics, never before the line above it; on none
   * of plain ones. A line without it, or out of order, makes every line
   * plain: the server does not sort them. */
  startS?: number
}

/** - `found`: the lines, synced when each carries its time; at most 2000 are
 *   kept, `synced` is worked out again from them, and no lines is `none`
 * - `instrumental`: the source says the song has no words
 * - `none`: the source does not have them */
export type LyricsResult =
  | { status: 'found'; synced: boolean; lines: LyricsLine[] }
  | { status: 'instrumental' }
  | { status: 'none' }

/** Finds a song's lyrics. Asked by the server's nightly library pass, never
 * while a song plays, within 10 seconds, once an admin adds the source to the
 * lyrics order. The pass asks the whole order about every track without
 * synced lyrics, those with plain ones too, since Songstress's own sources
 * may match exactly enough to replace them; this answer is used for a track
 * with no lyrics at all, and never replaces lyrics a track has. The track is
 * asked again only after a rest (SPEC.md, section 11). */
export interface LyricsProvider {
  /** The song's lyrics as the source has them: synced or plain lines, instrumental, or none.
   * @param song - The song, as its tags have it.
   * @param context - Who the answer is for.
   */
  find(song: TrackQuery, context: ProviderContext): Awaitable<LyricsResult>
}

/** Facts a source can add to a track that lacks them. */
export interface TrackFacts {
  /** Its ISRC. */
  isrc?: string
  /** Its ids in the catalogues the source knows. */
  ids?: CatalogIds
  /** When it came out, as an ISO 8601 date or a year. */
  releaseDate?: string
  /** Its genre. */
  genre?: string
  /** Its record label. */
  label?: string
  /** Marked explicit. */
  explicit?: boolean
}

/** Facts about artists, releases and tracks. Implement the three discography
 * methods when the manifest's `supports` lists "discography" (artists are
 * named by the source's own id, or by the id of the group the provider
 * joined), and `enrich` when it lists "enrich". */
export interface MetadataProvider {
  /** What the artist released, without tracks.
   * @param artistId - The source's own id for the artist.
   * @param context - Who the answer is for.
   */
  releases?(artistId: string, context: ProviderContext): Awaitable<CatalogAlbum[]>
  /** The artist's tracks the source ranks, most played first; empty when it
   * ranks none.
   * @param artistId - The source's own id for the artist.
   * @param context - Who the answer is for.
   */
  topTracks?(artistId: string, context: ProviderContext): Awaitable<CatalogTrack[]>
  /** One release's tracks, in order.
   * @param releaseId - The source's own id for the release.
   * @param context - Who the answer is for.
   */
  releaseTracks?(releaseId: string, context: ProviderContext): Awaitable<CatalogTrack[]>
  /** The facts the track lacks; null when the source does not know the track.
   * @param track - The track, as its tags have it.
   * @param context - Who the answer is for.
   */
  enrich?(track: TrackQuery, context: ProviderContext): Awaitable<TrackFacts | null>
}

/** An artist Songstress wants a photo of, or words about, with what the
 * library holds under the name: the evidence that tells them from a
 * namesake. */
export interface ArtistQuery {
  /** The artist's name, as the library has it. */
  name: string
  /** Titles of their songs in the library. */
  songs: string[]
  /** Titles of their releases in the library. */
  releases: string[]
  /** ISRCs of the artist's songs the library holds, to tell them from a namesake. */
  isrcs: string[]
  /** Their ids in the catalogues the library knows. */
  ids?: CatalogIds
}

/** One photo in up to three sizes, as addresses. */
export interface ArtistPhoto {
  /** The picture's address at a large size. */
  large: string
  /** The picture's address at a medium size. */
  medium?: string
  /** The picture's address at a small size. */
  small?: string
}

/** Pictures. Implement the method for each kind the manifest lists under
 * `supports`. */
export interface ArtworkProvider {
  /** The artist's photo; null unless the source can stand behind who it is.
   * A namesake's photo is worse than none.
   * @param artist - The artist, as the library knows them.
   * @param context - Who the answer is for.
   */
  artistPhoto?(artist: ArtistQuery, context: ProviderContext): Awaitable<ArtistPhoto | null>
  /** The address of the album's cover; null when the source lists none.
   * @param album - The album's artist and title.
   * @param context - Who the answer is for.
   */
  albumCover?(album: { artist: string; title: string }, context: ProviderContext): Awaitable<string | null>
}

/** Who an artist is, in a source's words. */
export interface ArtistBiography {
  /** Plain text, its paragraphs apart by a line break. The first 4000
   * characters are kept. */
  text: string
  /** The page the words are from, for "Read more". At most 2000 characters. */
  url?: string
  /** The language the words are in, as a BCP 47 tag: "en", "pt-BR". */
  language?: string
}

/** Words about an artist. Implement the method for each thing the manifest
 * lists under `supports`. Both are asked by the server for itself, never
 * for one member. */
export interface ArtistInfoProvider {
  /** Supports "biography": who the artist is; null unless the source can
   * stand behind who it is. A namesake's story is worse than none.
   * @param artist - The artist, as the library knows them.
   * @param context - Who the answer is for.
   */
  biography?(artist: ArtistQuery, context: ProviderContext): Awaitable<ArtistBiography | null>
  /** Supports "similar": the artists like this one, most alike first, at
   * most `limit` (never over 50). Each is named by the source's own id;
   * Songstress finds them in the library by name and by `ids`. Empty when
   * the source knows none.
   * @param artist - The artist, as the library knows them.
   * @param limit - The most to answer with.
   * @param context - Who the answer is for.
   */
  similarArtists?(artist: ArtistQuery, limit: number, context: ProviderContext): Awaitable<CatalogArtist[]>
}

// ── scrobble, recommend ──────────────────────────────────────────────────────

/** One play to report. */
export interface ScrobblePlay {
  /** The song that was played, from the library. */
  song: Song
  /** The member who listened: `context.userId` is theirs too. */
  userId: string
  /** When the play started, as an ISO 8601 time. */
  playedAt: string
}

/** A service plays are reported to, for each member who connected it. A
 * play that fails with `rate-limited` or `unavailable` is tried again later;
 * `sign-in-required` asks the member to connect again. It is handed members'
 * plays, so it needs the permission `listening.read` beside `providers`, and
 * hears only the members who granted it. */
export interface ScrobbleProvider {
  /** A play counted.
   * @param play - The play to report.
   * @param context - Who the answer is for.
   */
  scrobble(play: ScrobblePlay, context: ProviderContext): Awaitable<void>
  /** A song started. Sent live only, and not for every play.
   * @param play - The song now playing.
   * @param context - Who the answer is for.
   */
  nowPlaying?(play: ScrobblePlay, context: ProviderContext): Awaitable<void>
}

/** A song or an artist to recommend from. Any field may be missing: use
 * what the source understands. */
export interface RecommendSeed {
  /** The seed track's title. */
  title?: string
  /** The seed's artist. */
  artist?: string
  /** The seed track's album. */
  album?: string
  /** The seed track's ISRC. */
  isrc?: string
  /** The seed's MusicBrainz id. */
  musicBrainzId?: string
  /** The genres its tags name. */
  genres?: string[]
}

/** A recommended track, by what it is called: Songstress matches it to the
 * library, filters it and caches it. */
export interface RecommendedTrack {
  /** Its title. */
  title: string
  /** Its artist's name. */
  artist: string
  /** Its album's title. */
  album?: string
  /** Its ISRC. */
  isrc?: string
  /** Its MusicBrainz id. */
  musicBrainzId?: string
  /** Its length, in seconds. */
  durationS?: number
  /** Its cover's address, http or https. */
  coverUrl?: string
  /** Its ids in the catalogues Songstress knows. */
  ids?: CatalogIds
  /** The source's own measure of how alike, from 0 to 1. */
  score?: number
}

/** Recommendations, best first. Implement the method for each mode the
 * manifest lists under `modes`. Empty when the source has nothing for the
 * seed. */
export interface RecommendProvider {
  /** Mode "track": songs like this one.
   * @param seed - The song to start from.
   * @param limit - The most to answer with.
   * @param context - Who the answer is for.
   */
  similarTracks?(seed: RecommendSeed, limit: number, context: ProviderContext): Awaitable<RecommendedTrack[]>
  /** Mode "artist": a radio of this artist.
   * @param artist - The artist to start from.
   * @param limit - The most to answer with.
   * @param context - Who the answer is for.
   */
  artistRadio?(artist: RecommendSeed, limit: number, context: ProviderContext): Awaitable<RecommendedTrack[]>
  /** Mode "context": one mix from several songs.
   * @param seeds - The songs to start from.
   * @param limit - The most to answer with.
   * @param context - Who the answer is for.
   */
  contextMix?(seeds: RecommendSeed[], limit: number, context: ProviderContext): Awaitable<RecommendedTrack[]>
}

// ── play, download ───────────────────────────────────────────────────────────
// Both answer where the audio is; Songstress fetches it, under the
// extension's own network permission on every hop, https to public hosts
// only. Nothing here decrypts, and an answer that needs a key is refused.

/** The file formats Songstress can serve. */
export type AudioContainer = 'flac' | 'm4a' | 'mp3' | 'ogg' | 'opus' | 'webm' | 'wav'

/** Where one whole audio file is. */
export interface StreamLocation {
  /** The audio's address. */
  url: string
  /** Headers to send with the request. */
  headers?: Record<string, string>
  /** The audio's container. */
  container: AudioContainer
}

/** Plays what the search provider of the same id found. Off until the admin
 * turns it on. One progressive file only: never a playlist of segments. */
export interface PlayProvider {
  /** Null when the source has no stream for the track right now.
   * @param track - The track the search provider of the same id found.
   * @param context - Who the answer is for.
   */
  resolve(track: CatalogTrack, context: ProviderContext): Awaitable<StreamLocation | null>
}

/** Whether the source has a song, and under which id of its own. */
export interface DownloadAvailability {
  /** Whether the source has the track. */
  available: boolean
  /** The source's id for the track, handed back to `locate`. */
  id?: string
}

/** Where a download's audio is: one file, or segments in order (with the
 * part that opens them, when the format has one). Songstress fetches them,
 * joins segments into one file of `container`, and verifies the result
 * before anything keeps it. */
export type DownloadLocation =
  | (StreamLocation & { kind: 'file' })
  | { kind: 'segments'; urls: string[]; initUrl?: string; headers?: Record<string, string>; container: AudioContainer }

/** A source songs can be acquired from. Off until the admin adds it and
 * turns it on. */
export interface DownloadProvider {
  /** Says whether the source has a track, and its id there.
   * @param track - The song, as its tags have it.
   * @param context - Who the answer is for.
   */
  check(track: TrackQuery, context: ProviderContext): Awaitable<DownloadAvailability>
  /** Where the audio is, at one of the manifest's `qualities`; null when it
   * turned out not to be there. `tags` may carry what the source knows that
   * the request did not (an ISRC above all).
   * @param request - The source's id for the track, and the quality picked.
   * @param context - Who the answer is for.
   */
  locate(
    request: { id: string; quality: string },
    context: ProviderContext,
  ): Awaitable<{ location: DownloadLocation; tags?: TrackFacts } | null>
}

// ── registration ─────────────────────────────────────────────────────────────

/** Where providers of one kind are registered. */
export interface ProviderRegistry<Provider> {
  /** Registers the provider the manifest declares under this kind and `id`.
   * @param id - The id the manifest declares it under.
   * @param provider - The provider: an object with this kind's methods.
   * @example
   * ```ts
   * import { fetchJson, queryString, songstress, type CatalogTrack } from 'songstress/server'
   *
   * songstress.providers.search.register('my-source', {
   *   async search(query) {
   *     const tracks = await fetchJson<CatalogTrack[]>(`https://api.example.com/search?${queryString({ q: query.text, limit: query.limit })}`)
   *     return { tracks }
   *   },
   * })
   * ```
   */
  register(id: string, provider: Provider): Disposable
}

/** The provider kinds. Server entry; permission `providers` (and for a
 * scrobble provider `listening.read` too). */
export interface Providers {
  /** The search sources. */
  search: ProviderRegistry<SearchProvider>
  /** The lookup sources. */
  lookup: ProviderRegistry<LookupProvider>
  /** The link sources. */
  links: ProviderRegistry<LinkProvider>
  /** The lyrics sources. */
  lyrics: ProviderRegistry<LyricsProvider>
  /** The metadata sources. */
  metadata: ProviderRegistry<MetadataProvider>
  /** The artwork sources. */
  artwork: ProviderRegistry<ArtworkProvider>
  /** The artist info sources. */
  artistInfo: ProviderRegistry<ArtistInfoProvider>
  /** The scrobble services. */
  scrobble: ProviderRegistry<ScrobbleProvider>
  /** The recommendation sources. */
  recommend: ProviderRegistry<RecommendProvider>
  /** The play sources. */
  play: ProviderRegistry<PlayProvider>
  /** The download sources. */
  download: ProviderRegistry<DownloadProvider>
}
