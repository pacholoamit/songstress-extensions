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
  bitDepth?: number
  sampleRateHz?: number
  bitrateKbps?: number
}

/** A track as a source lists it. `id` is the source's own. */
export interface CatalogTrack {
  id: string
  /** The title without the words of its edition, when the source keeps
   * them apart (see `version`). */
  title: string
  /** The edition, when the source names it apart from the title: "Live",
   * "Remastered 2011", "Radio Edit". Songstress tells two editions of one
   * song apart by it. */
  version?: string
  artists: string[]
  /** The source's id of the first artist. */
  artistId?: string
  album?: string
  albumId?: string
  albumArtist?: string
  durationS?: number
  trackNumber?: number
  discNumber?: number
  /** YYYY, YYYY-MM or YYYY-MM-DD. */
  releaseDate?: string
  isrc?: string
  explicit?: boolean
  coverUrl?: string
  /** The track's page on the source's own site. */
  url?: string
  ids?: CatalogIds
  audio?: AudioFacts
}

export interface CatalogAlbum {
  id: string
  title: string
  artists: string[]
  artistId?: string
  kind?: 'album' | 'single' | 'ep' | 'compilation'
  releaseDate?: string
  trackCount?: number
  explicit?: boolean
  upc?: string
  coverUrl?: string
  url?: string
  ids?: CatalogIds
}

export interface CatalogArtist {
  id: string
  name: string
  imageUrl?: string
  url?: string
  ids?: CatalogIds
}

export interface CatalogPlaylist {
  id: string
  title: string
  /** Who made it, as the source names them. */
  owner?: string
  description?: string
  trackCount?: number
  coverUrl?: string
  url?: string
}

export interface CatalogAlbumDetail extends CatalogAlbum {
  tracks: CatalogTrack[]
}

export interface CatalogPlaylistDetail extends CatalogPlaylist {
  tracks: CatalogTrack[]
}

export interface CatalogArtistDetail extends CatalogArtist {
  biography?: string
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
  title: string
  artist: string
  album?: string
  durationS?: number
  isrc?: string
  ids?: CatalogIds
}

// ── failures ─────────────────────────────────────────────────────────────────

/** - `rate-limited`: the source asks to slow down; Songstress waits `retryAfterS`
 * - `sign-in-required`: the source wants a sign-in the settings do not hold, or no longer accept
 * - `not-configured`: a setting the provider needs is empty
 * - `unavailable`: the source is down, or refuses this request for now */
export type ProviderFailureCode = 'rate-limited' | 'sign-in-required' | 'not-configured' | 'unavailable'

/** A failure Songstress knows what to do about. The message is for the
 * server's log and the admin: never put a token or a signed address in it. */
export class ProviderFailure extends Error {
  override readonly name = 'ProviderFailure'
  readonly code: ProviderFailureCode
  /** How long to leave the source alone, in seconds. */
  readonly retryAfterS?: number

  constructor(code: ProviderFailureCode, options: { message?: string; retryAfterS?: number } = {}) {
    super(options.message ?? code)
    this.code = code
    this.retryAfterS = options.retryAfterS
  }
}

// ── search, lookup, links ────────────────────────────────────────────────────

export interface SearchQuery {
  text: string
  /** The kinds asked for, from those the manifest lists under `types`. */
  types: CatalogType[]
  /** How many of each kind, at most. */
  limit: number
  /** How many of each kind to skip: the next page. */
  offset: number
}

export interface SearchResults {
  tracks?: CatalogTrack[]
  albums?: CatalogAlbum[]
  artists?: CatalogArtist[]
  playlists?: CatalogPlaylist[]
}

/** Answers a search. */
export interface SearchProvider {
  search(query: SearchQuery, context: ProviderContext): Awaitable<SearchResults>
}

/** Opens one thing by the source's own id. Implement a method for each kind
 * the manifest lists under `types`. Null when the source has no such thing. */
export interface LookupProvider {
  track?(id: string, context: ProviderContext): Awaitable<CatalogTrack | null>
  album?(id: string, context: ProviderContext): Awaitable<CatalogAlbumDetail | null>
  artist?(id: string, context: ProviderContext): Awaitable<CatalogArtistDetail | null>
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
  resolve(url: string, context: ProviderContext): Awaitable<LinkResult | null>
}

// ── lyrics, metadata, artwork, artist info ───────────────────────────────────

export interface LyricsLine {
  text: string
  /** When the line is sung, in seconds from the start. On every line of
   * synced lyrics, on none of plain ones. */
  startS?: number
}

/** - `found`: the lines, synced when each carries its time
 * - `instrumental`: the source says the song has no words
 * - `none`: the source does not have them */
export type LyricsResult =
  | { status: 'found'; synced: boolean; lines: LyricsLine[] }
  | { status: 'instrumental' }
  | { status: 'none' }

/** Finds a song's lyrics. Its answer never replaces lyrics a song's own file
 * carries. */
export interface LyricsProvider {
  find(song: TrackQuery, context: ProviderContext): Awaitable<LyricsResult>
}

/** Facts a source can add to a track that lacks them. */
export interface TrackFacts {
  isrc?: string
  ids?: CatalogIds
  releaseDate?: string
  genre?: string
  label?: string
  explicit?: boolean
}

/** Facts about artists, releases and tracks. Implement the three discography
 * methods when the manifest's `supports` lists "discography" (artists are
 * named by the source's own id, or by the id of the group the provider
 * joined), and `enrich` when it lists "enrich". */
export interface MetadataProvider {
  /** What the artist released, without tracks. */
  releases?(artistId: string, context: ProviderContext): Awaitable<CatalogAlbum[]>
  /** The artist's tracks the source ranks, most played first; empty when it
   * ranks none. */
  topTracks?(artistId: string, context: ProviderContext): Awaitable<CatalogTrack[]>
  /** One release's tracks, in order. */
  releaseTracks?(releaseId: string, context: ProviderContext): Awaitable<CatalogTrack[]>
  /** The facts the track lacks; null when the source does not know the track. */
  enrich?(track: TrackQuery, context: ProviderContext): Awaitable<TrackFacts | null>
}

/** An artist Songstress wants a photo of, or words about, with what the
 * library holds under the name: the evidence that tells them from a
 * namesake. */
export interface ArtistQuery {
  name: string
  /** Titles of their songs in the library. */
  songs: string[]
  /** Titles of their releases in the library. */
  releases: string[]
  isrcs: string[]
  ids?: CatalogIds
}

/** One photo in up to three sizes, as addresses. */
export interface ArtistPhoto {
  large: string
  medium?: string
  small?: string
}

/** Pictures. Implement the method for each kind the manifest lists under
 * `supports`. */
export interface ArtworkProvider {
  /** The artist's photo; null unless the source can stand behind who it is.
   * A namesake's photo is worse than none. */
  artistPhoto?(artist: ArtistQuery, context: ProviderContext): Awaitable<ArtistPhoto | null>
  /** The address of the album's cover; null when the source lists none. */
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
   * stand behind who it is. A namesake's story is worse than none. */
  biography?(artist: ArtistQuery, context: ProviderContext): Awaitable<ArtistBiography | null>
  /** Supports "similar": the artists like this one, most alike first, at
   * most `limit` (never over 50). Each is named by the source's own id;
   * Songstress finds them in the library by name and by `ids`. Empty when
   * the source knows none. */
  similarArtists?(artist: ArtistQuery, limit: number, context: ProviderContext): Awaitable<CatalogArtist[]>
}

// ── scrobble, recommend ──────────────────────────────────────────────────────

/** One play to report. */
export interface ScrobblePlay {
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
  /** A play counted. */
  scrobble(play: ScrobblePlay, context: ProviderContext): Awaitable<void>
  /** A song started. Sent live only, and not for every play. */
  nowPlaying?(play: ScrobblePlay, context: ProviderContext): Awaitable<void>
}

/** A song or an artist to recommend from. Any field may be missing: use
 * what the source understands. */
export interface RecommendSeed {
  title?: string
  artist?: string
  album?: string
  isrc?: string
  musicBrainzId?: string
  /** The genres its tags name. */
  genres?: string[]
}

/** A recommended track, by what it is called: Songstress matches it to the
 * library, filters it and caches it. */
export interface RecommendedTrack {
  title: string
  artist: string
  album?: string
  isrc?: string
  musicBrainzId?: string
  durationS?: number
  coverUrl?: string
  ids?: CatalogIds
  /** The source's own measure of how alike, from 0 to 1. */
  score?: number
}

/** Recommendations, best first. Implement the method for each mode the
 * manifest lists under `modes`. Empty when the source has nothing for the
 * seed. */
export interface RecommendProvider {
  /** Mode "track": songs like this one. */
  similarTracks?(seed: RecommendSeed, limit: number, context: ProviderContext): Awaitable<RecommendedTrack[]>
  /** Mode "artist": a radio of this artist. */
  artistRadio?(artist: RecommendSeed, limit: number, context: ProviderContext): Awaitable<RecommendedTrack[]>
  /** Mode "context": one mix from several songs. */
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
  url: string
  /** Headers to send with the request. */
  headers?: Record<string, string>
  container: AudioContainer
}

/** Plays what the search provider of the same id found. Off until the admin
 * turns it on. One progressive file only: never a playlist of segments. */
export interface PlayProvider {
  /** Null when the source has no stream for the track right now. */
  resolve(track: CatalogTrack, context: ProviderContext): Awaitable<StreamLocation | null>
}

/** Whether the source has a song, and under which id of its own. */
export interface DownloadAvailability {
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
  check(track: TrackQuery, context: ProviderContext): Awaitable<DownloadAvailability>
  /** Where the audio is, at one of the manifest's `qualities`; null when it
   * turned out not to be there. `tags` may carry what the source knows that
   * the request did not (an ISRC above all). */
  locate(
    request: { id: string; quality: string },
    context: ProviderContext,
  ): Awaitable<{ location: DownloadLocation; tags?: TrackFacts } | null>
}

// ── registration ─────────────────────────────────────────────────────────────

/** Where providers of one kind are registered. */
export interface ProviderRegistry<Provider> {
  /** Registers the provider the manifest declares under this kind and `id`. */
  register(id: string, provider: Provider): Disposable
}

/** The provider kinds. Server entry; permission `providers` (and for a
 * scrobble provider `listening.read` too). */
export interface Providers {
  search: ProviderRegistry<SearchProvider>
  lookup: ProviderRegistry<LookupProvider>
  links: ProviderRegistry<LinkProvider>
  lyrics: ProviderRegistry<LyricsProvider>
  metadata: ProviderRegistry<MetadataProvider>
  artwork: ProviderRegistry<ArtworkProvider>
  artistInfo: ProviderRegistry<ArtistInfoProvider>
  scrobble: ProviderRegistry<ScrobbleProvider>
  recommend: ProviderRegistry<RecommendProvider>
  play: ProviderRegistry<PlayProvider>
  download: ProviderRegistry<DownloadProvider>
}
