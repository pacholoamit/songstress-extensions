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
  userId: string
  /** When the play started, as an ISO 8601 time: the play's own time, not the
   * time it was reported. A phone that was offline reports late. */
  playedAt: string
  client?: string
}

/** What a member marked as a favourite, or no longer does. */
export type Favorite =
  | { type: 'song'; song: Song }
  | { type: 'album'; album: Album }
  | { type: 'artist'; artist: Artist }

export interface FavoriteEvent {
  userId: string
  /** True when it became a favourite, false when it stopped being one. */
  favorite: boolean
  /** When, as an ISO 8601 time. */
  at: string
}

export interface PlaylistChangeEvent {
  change: 'created' | 'updated' | 'deleted'
  /** When, as an ISO 8601 time. */
  at: string
}

/** Songs that came into the library, changed or left it, by id. A large
 * change arrives as several calls. */
export interface LibraryChange {
  added: string[]
  changed: string[]
  removed: string[]
}

/** A finished scan of the library. */
export interface ScanSummary {
  /** ISO 8601 times. */
  startedAt: string
  finishedAt: string
  /** How many songs the scan added, changed and removed. */
  added: number
  changed: number
  removed: number
}

/** This device's player at one moment. */
export interface PlayerState {
  /** The song in the player; null when it holds none. */
  song: Song | null
  playing: boolean
  positionS: number
  durationS: number
  /** From 0 to 1. */
  volume: number
}

/** This device's queue. */
export interface QueueState {
  songs: Song[]
  /** Where the current song is in `songs`; -1 when the player holds none. */
  index: number
}

/** The one hook both entries have, as code that runs on either side may use
 * it. Each entry's own hooks say more about the moment. */
export interface SharedHooks {
  onPlay(listener: (song: Song) => Awaitable<void>): Disposable
}

/** The hooks of the server entry. They see every app of every member who
 * granted the extension their listening, phones included. */
export interface ServerHooks extends SharedHooks {
  /** A member started a song: their app reported it, about a second in, once
   * for each song. Live only: a play that starts offline, or on a locked
   * Android phone, may arrive late or never. For "what was played", use
   * onScrobble. Permission `listening.read`. */
  onPlay(listener: (song: Song, play: PlayEvent) => Awaitable<void>): Disposable
  /** A play counted: half the song or four minutes of it was heard. Reliable:
   * a play made offline waits on the device and arrives later, with the time
   * it really happened. Permission `listening.read`. */
  onScrobble(listener: (song: Song, play: ScrobbleEvent) => Awaitable<void>): Disposable
  /** A member marked a song, an album or an artist as a favourite, or took
   * the mark away. Permission `listening.read`. */
  onFavorite(listener: (item: Favorite, event: FavoriteEvent) => Awaitable<void>): Disposable
  /** A public playlist was created, changed or deleted. Permission
   * `library.read`. */
  onPlaylistChange(listener: (playlist: Playlist, event: PlaylistChangeEvent) => Awaitable<void>): Disposable
  /** Songs came into the library, changed or left it. Permission
   * `library.read`. */
  onLibraryChange(listener: (change: LibraryChange) => Awaitable<void>): Disposable
  /** A scan of the library finished. Permission `library.read`. */
  onScanComplete(listener: (scan: ScanSummary) => Awaitable<void>): Disposable
}

/** The hooks of the client entry. They follow the player of the one device
 * the code runs on, live, while its app is open and in front: client code is
 * stopped in the background and told the current state when it comes back.
 * All but onVolumeChange need the permission `listening.read`. */
export interface ClientHooks extends SharedHooks {
  /** Playback started or went on after a pause. */
  onPlay(listener: (song: Song, state: PlayerState) => Awaitable<void>): Disposable
  /** Playback paused. */
  onPause(listener: (song: Song, state: PlayerState) => Awaitable<void>): Disposable
  /** Another song became the current one; null when the player emptied. */
  onTrackChange(listener: (song: Song | null, state: PlayerState) => Awaitable<void>): Disposable
  /** The listener moved to another place in the song. */
  onSeek(listener: (positionS: number, state: PlayerState) => Awaitable<void>): Disposable
  /** The volume changed; from 0 to 1. No permission. */
  onVolumeChange(listener: (volume: number) => Awaitable<void>): Disposable
  /** Songs were added to the queue, removed from it or moved. */
  onQueueChange(listener: (queue: QueueState) => Awaitable<void>): Disposable
  /** Playback moved on: at most once a second, and only while a song plays. */
  onProgress(listener: (positionS: number, state: PlayerState) => Awaitable<void>): Disposable
}
