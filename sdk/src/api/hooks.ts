// Hooks: what an extension can listen to. They tell what did happen, and
// nothing waits for a listener: no hook can stall, delay or cancel playback.
//
// The first argument of a listener is the thing itself, the second what is
// known about the moment:
//
//   songstress.hooks.onPlay((song) => { ... })
//
// A hook fires only when the manifest lists it under `hooks`, with the entry
// and the permission it needs: that list is how Songstress knows to start the
// code. Register at the top level of the entry, every time it starts.

import type { Awaitable, Disposable } from './common'
import type { Album, Artist, Playlist, Song } from './library'

/** A play as the server heard of it. */
export interface PlayEvent {
  /** The member who is listening. */
  userId: string
  /** When the song started, as an ISO 8601 time. */
  startedAt: string
  /** The app that reported it, when it said its name. */
  client?: string
}

/** A play that counted. */
export interface ScrobbleEvent {
  /** The member who listened. */
  userId: string
  /** When the play started, as an ISO 8601 time: the play's own time, not the
   * time it was reported. A phone that was offline reports late. */
  playedAt: string
  /** The app that reported it, when it said its name. */
  client?: string
}

/** What a member marked as a favourite, or no longer does. */
export type Favorite =
  | { type: 'song'; song: Song }
  | { type: 'album'; album: Album }
  | { type: 'artist'; artist: Artist }

/** What `onFavorite` is told: a member marked a song, an album or an artist as a favourite, or took the mark away. */
export interface FavoriteEvent {
  /** The member who marked it. */
  userId: string
  /** True when it became a favourite, false when it stopped being one. */
  favorite: boolean
  /** When, as an ISO 8601 time. */
  at: string
}

/** What `onPlaylistChange` is told: a public playlist was created, changed or deleted. */
export interface PlaylistChangeEvent {
  /** What happened to the playlist. */
  change: 'created' | 'updated' | 'deleted'
  /** When, as an ISO 8601 time. */
  at: string
}

/** Songs that came into the library, changed or left it, by id. A large
 * change arrives as several calls. */
export interface LibraryChange {
  /** Ids of the songs that came in. */
  added: string[]
  /** Ids of the songs that changed. */
  changed: string[]
  /** Ids of the songs that left. */
  removed: string[]
}

/** A finished scan of the library. */
export interface ScanSummary {
  /** ISO 8601 times. */
  startedAt: string
  /** When the scan finished, as an ISO 8601 time. */
  finishedAt: string
  /** How many songs the scan added, changed and removed. */
  added: number
  /** How many songs changed. */
  changed: number
  /** How many songs left the library. */
  removed: number
}

/** This device's player at one moment. */
export interface PlayerState {
  /** The song in the player; null when it holds none. */
  song: Song | null
  /** Whether it is playing now. */
  playing: boolean
  /** Where it is in the song, in seconds from its start. */
  positionS: number
  /** The song's length, in seconds. */
  durationS: number
  /** From 0 to 1. */
  volume: number
}

/** This device's queue. */
export interface QueueState {
  /** The songs waiting, in order. */
  songs: Song[]
  /** Where the current song is in `songs`; -1 when the player holds none. */
  index: number
}

/** The one hook both entries have, as code that runs on either side may use
 * it. Each entry's own hooks say more about the moment. */
export interface SharedHooks {
  /** A song started playing.
   * @param listener - Called each time, with what happened.
   * @example
   * ```ts
   * import { songstress } from 'songstress'
   *
   * songstress.hooks.onPlay(async (song) => {
   *   await songstress.storage.set('last-played', song.id)
   * })
   * ```
   */
  onPlay(listener: (song: Song) => Awaitable<void>): Disposable
}

/** The hooks of the server entry. They see every app of every member who
 * granted the extension their listening, phones included. */
export interface ServerHooks extends SharedHooks {
  /** A member started a song: their app reported it, about a second in, once
   * for each song. Live only: a play that starts offline, or on a locked
   * Android phone, may arrive late or never. For "what was played", use
   * onScrobble. Permission `listening.read`.
   * @param listener - Called each time, with what happened.
   * @example
   * ```ts
   * import { songstress } from 'songstress/server'
   *
   * songstress.hooks.onPlay(async (song, play) => {
   *   const key = `plays:${song.id}`
   *   const plays = (await songstress.storage.get<number>(key, { userId: play.userId })) ?? 0
   *   await songstress.storage.set(key, plays + 1, { userId: play.userId })
   * })
   * ```
   */
  onPlay(listener: (song: Song, play: PlayEvent) => Awaitable<void>): Disposable
  /** A play counted: half the song or four minutes of it was heard. Reliable:
   * a play made offline waits on the device and arrives later, with the time
   * it really happened. Permission `listening.read`.
   * @param listener - Called each time, with what happened.
   * @example
   * ```ts
   * import { songstress } from 'songstress/server'
   *
   * songstress.hooks.onScrobble(async (song, play) => {
   *   const token = await songstress.secrets.get('token', { userId: play.userId })
   *   if (!token) return // this member has not signed in
   *   await songstress.net.fetch('https://api.example.com/scrobbles', {
   *     method: 'POST',
   *     headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
   *     body: JSON.stringify({ artist: song.artist, title: song.title, playedAt: play.playedAt }),
   *   })
   * })
   * ```
   */
  onScrobble(listener: (song: Song, play: ScrobbleEvent) => Awaitable<void>): Disposable
  /** A member marked a song, an album or an artist as a favourite, or took
   * the mark away. Permission `listening.read`.
   * @param listener - Called each time, with what happened.
   * @example
   * ```ts
   * import { songstress } from 'songstress/server'
   *
   * songstress.hooks.onFavorite((item, event) => {
   *   if (item.type === 'song' && event.favorite) console.log(`${event.userId} loves ${item.song.title}`)
   * })
   * ```
   */
  onFavorite(listener: (item: Favorite, event: FavoriteEvent) => Awaitable<void>): Disposable
  /** A public playlist was created, changed or deleted. Permission
   * `library.read`.
   * @param listener - Called each time, with what happened.
   * @example
   * ```ts
   * import { songstress } from 'songstress/server'
   *
   * songstress.hooks.onPlaylistChange(async (playlist, event) => {
   *   if (event.change === 'deleted') await songstress.storage.delete(`mirror:${playlist.id}`)
   * })
   * ```
   */
  onPlaylistChange(listener: (playlist: Playlist, event: PlaylistChangeEvent) => Awaitable<void>): Disposable
  /** Songs came into the library, changed or left it. Permission
   * `library.read`.
   * @param listener - Called each time, with what happened.
   * @example
   * ```ts
   * import { songstress } from 'songstress/server'
   *
   * songstress.hooks.onLibraryChange(async (change) => {
   *   for (const id of change.added) {
   *     const song = await songstress.library.getSong(id)
   *     if (song) console.log(`new in the library: ${song.artist} - ${song.title}`)
   *   }
   * })
   * ```
   */
  onLibraryChange(listener: (change: LibraryChange) => Awaitable<void>): Disposable
  /** A scan of the library finished. Permission `library.read`.
   * @param listener - Called each time, with what happened.
   * @example
   * ```ts
   * import { songstress } from 'songstress/server'
   *
   * songstress.hooks.onScanComplete((scan) => {
   *   console.log(`scanned by ${scan.finishedAt}: ${scan.added} added, ${scan.changed} changed, ${scan.removed} removed`)
   * })
   * ```
   */
  onScanComplete(listener: (scan: ScanSummary) => Awaitable<void>): Disposable
}

/** The hooks of the client entry. They follow the player of the one device
 * the code runs on, live, while its app is open and in front: client code is
 * stopped in the background and told the current state when it comes back.
 * All but onVolumeChange need the permission `listening.read`. */
export interface ClientHooks extends SharedHooks {
  /** Playback started or went on after a pause.
   * @param listener - Called each time, with what happened.
   * @example
   * ```ts
   * import { songstress } from 'songstress/client'
   *
   * songstress.hooks.onPlay((song, state) => {
   *   console.log(`playing ${song.title} from ${Math.round(state.positionS)} s`)
   * })
   * ```
   */
  onPlay(listener: (song: Song, state: PlayerState) => Awaitable<void>): Disposable
  /** Playback paused.
   * @param listener - Called each time, with what happened.
   * @example
   * ```ts
   * import { songstress } from 'songstress/client'
   *
   * songstress.hooks.onPause(async (song, state) => {
   *   await songstress.storage.set('paused-at', { songId: song.id, positionS: state.positionS })
   * })
   * ```
   */
  onPause(listener: (song: Song, state: PlayerState) => Awaitable<void>): Disposable
  /** Another song became the current one; null when the player emptied.
   * @param listener - Called each time, with what happened.
   * @example
   * ```ts
   * import { songstress } from 'songstress/client'
   *
   * songstress.hooks.onTrackChange(async (song) => {
   *   if (song) await songstress.ui.refresh({ panel: 'song-facts' })
   * })
   * ```
   */
  onTrackChange(listener: (song: Song | null, state: PlayerState) => Awaitable<void>): Disposable
  /** The listener moved to another place in the song.
   * @param listener - Called each time, with what happened.
   * @example
   * ```ts
   * import { songstress } from 'songstress/client'
   *
   * songstress.hooks.onSeek((positionS, state) => {
   *   console.log(`moved to ${Math.round(positionS)} of ${Math.round(state.durationS)} s`)
   * })
   * ```
   */
  onSeek(listener: (positionS: number, state: PlayerState) => Awaitable<void>): Disposable
  /** The volume changed; from 0 to 1. No permission.
   * @param listener - Called each time, with what happened.
   * @example
   * ```ts
   * import { songstress } from 'songstress/client'
   *
   * songstress.hooks.onVolumeChange(async (volume) => {
   *   await songstress.storage.set('volume', volume)
   * })
   * ```
   */
  onVolumeChange(listener: (volume: number) => Awaitable<void>): Disposable
  /** Songs were added to the queue, removed from it or moved.
   * @param listener - Called each time, with what happened.
   * @example
   * ```ts
   * import { songstress } from 'songstress/client'
   *
   * songstress.hooks.onQueueChange((queue) => {
   *   console.log(`${queue.songs.length - queue.index - 1} songs to come`)
   * })
   * ```
   */
  onQueueChange(listener: (queue: QueueState) => Awaitable<void>): Disposable
  /** Playback moved on: at most once a second, and only while a song plays.
   * @param listener - Called each time, with what happened.
   * @example
   * ```ts
   * import { songstress } from 'songstress/client'
   *
   * songstress.hooks.onProgress(async (positionS, state) => {
   *   // Half of a song counts as heard.
   *   if (state.song && positionS >= state.durationS / 2) await songstress.storage.set(`heard:${state.song.id}`, true)
   * })
   * ```
   */
  onProgress(listener: (positionS: number, state: PlayerState) => Awaitable<void>): Disposable
}
