// This device's player, for code that runs in an app. Everything here is a
// request, carried out as a tap on the app's own controls would be: when a
// jam is playing, the jam decides.

import type { PlayerState, QueueState } from './hooks'

/** The player of the device the code runs on. Client entry. Reading needs
 * the permission `listening.read`; the rest needs `player.control`. */
export interface Player {
  getState(): Promise<PlayerState>
  /** Goes on playing after a pause. */
  play(): Promise<void>
  pause(): Promise<void>
  next(): Promise<void>
  previous(): Promise<void>
  /** Moves to a place in the current song, in seconds from its start. */
  seek(positionS: number): Promise<void>
}

/** The queue of the device the code runs on. Client entry. */
export interface Queue {
  /** Permission `listening.read`. */
  get(): Promise<QueueState>
  /** Adds library songs to the queue: at its end, or right after the current
   * song with `next`. What is playing is never touched. Permission
   * `player.control`. */
  add(songIds: string[], options?: { next?: boolean }): Promise<void>
}
