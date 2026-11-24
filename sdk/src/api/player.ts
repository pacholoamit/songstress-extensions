// This device's player, for code that runs in an app. Everything here is a
// request, carried out as a tap on the app's own controls would be: when a
// jam is playing, the jam decides.

import type { PlayerState, QueueState } from './hooks'

/** The player of the device the code runs on. Client entry. Reading needs
 * the permission `listening.read`; the rest needs `player.control`. */
export interface Player {
  /** What the player is doing now: the song, where it is in it, whether it plays.
   * @example
   * ```ts
   * import { songstress } from 'songstress/client'
   *
   * const state = await songstress.player.getState()
   * if (state.song) console.log(`${state.playing ? 'playing' : 'paused'}: ${state.song.title}`)
   * ```
   */
  getState(): Promise<PlayerState>
  /** Goes on playing after a pause.
   * @example
   * ```ts
   * import { songstress } from 'songstress/client'
   *
   * songstress.commands.register('resume', async () => {
   *   await songstress.player.play()
   * })
   * ```
   */
  play(): Promise<void>
  /** Pauses what is playing.
   * @example
   * ```ts
   * import { songstress } from 'songstress/client'
   *
   * songstress.commands.register('pause', async () => {
   *   await songstress.player.pause()
   * })
   * ```
   */
  pause(): Promise<void>
  /** Skips to the next song in the queue.
   * @example
   * ```ts
   * import { songstress } from 'songstress/client'
   *
   * songstress.commands.register('skip', async () => {
   *   await songstress.player.next()
   * })
   * ```
   */
  next(): Promise<void>
  /** Goes back to the song before, as the app's own Previous does.
   * @example
   * ```ts
   * import { songstress } from 'songstress/client'
   *
   * songstress.commands.register('back', async () => {
   *   await songstress.player.previous()
   * })
   * ```
   */
  previous(): Promise<void>
  /** Moves to a place in the current song, in seconds from its start.
   * @param positionS - Where to go, in seconds from the song's start.
   * @example
   * ```ts
   * import { songstress } from 'songstress/client'
   *
   * // Back ten seconds.
   * const { positionS } = await songstress.player.getState()
   * await songstress.player.seek(Math.max(0, positionS - 10))
   * ```
   */
  seek(positionS: number): Promise<void>
}

/** The queue of the device the code runs on. Client entry. */
export interface Queue {
  /** Permission `listening.read`.
   * @example
   * ```ts
   * import { songstress } from 'songstress/client'
   *
   * const queue = await songstress.queue.get()
   * console.log(queue.songs[queue.index + 1]?.title ?? 'nothing next')
   * ```
   */
  get(): Promise<QueueState>
  /** Adds library songs to the queue: at its end, or right after the current
   * song with `next`. What is playing is never touched. Permission
   * `player.control`.
   * @param songIds - The library ids of the songs, in order.
   * @param options - With `next: true`, right after the current song instead of at the end.
   * @example
   * ```ts
   * import { songstress } from 'songstress/client'
   *
   * // Two songs, to play after this one.
   * await songstress.queue.add(['s1', 's2'], { next: true })
   * ```
   */
  add(songIds: string[], options?: { next?: boolean }): Promise<void>
}
