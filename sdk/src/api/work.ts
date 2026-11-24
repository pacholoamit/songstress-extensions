// Work on the server: jobs that run by themselves or when started, and
// routes other programs call. Both are declared in the manifest and get
// their handlers here, in the server entry.

import type { Awaitable, Disposable, JsonValue } from './common'

/** One run of a job. */
export interface JobRun {
  /** The run's id, as Activity knows it. */
  runId: string
  /** What `jobs.start` was given; undefined for a run on the job's own
   * schedule. */
  input?: JsonValue
  /** The member who started it, when one did. */
  userId?: string
  /** Tells Activity how far the run is: `done` of `total`, and a few words.
   * @param done - How much is done.
   * @param total - How much there is, when known.
   * @param note - A few words for Activity.
   */
  progress(done: number, total?: number, note?: string): void
}

/** Does one run. A run has a deadline of the host's: do a slice, keep where
 * you are in storage, and let the next run go on. Throwing marks the run as
 * failed, with the error's message. */
export type JobHandler = (run: JobRun) => Awaitable<void>

/** Jobs (the manifest's `contributes.jobs`), each shown in Activity while it
 * runs. Server entry; permission `jobs`. */
export interface Jobs {
  /** Registers the handler of a declared job.
   * @param id - The id the manifest declares it under.
   * @param handler - Does one run.
   * @example
   * ```ts
   * import { songstress } from 'songstress/server'
   *
   * songstress.jobs.register('mark-live', async (run) => {
   *   const { songs } = await songstress.library.search('live', { types: ['song'], limit: 100 })
   *   for (const [done, song] of songs.entries()) {
   *     await songstress.storage.set(`live:${song.id}`, true)
   *     run.progress(done + 1, songs.length, song.title)
   *   }
   * })
   * ```
   */
  register(id: string, handler: JobHandler): Disposable
  /** Queues a run of one of the extension's jobs, with `input` (JSON) for
   * its handler; resolves to the run's id. A job already waiting or running
   * is not queued twice.
   * @param id - The id of one of the extension's jobs.
   * @param input - JSON for the run's handler, as `run.input`.
   * @example
   * ```ts
   * import { songstress } from 'songstress/server'
   *
   * songstress.commands.register('mark-live-now', async () => {
   *   const runId = await songstress.jobs.start('mark-live')
   *   return { action: { type: 'toast', message: `Started (${runId})` } }
   * })
   * ```
   */
  start(id: string, input?: unknown): Promise<string>
}

/** A request to one of the extension's routes. */
export interface RouteRequest {
  /** The method the route was called with, one the manifest declares for it. */
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  /** The `:name` parts of the route's path. */
  params: Record<string, string>
  /** The query string's values, by name. */
  query: Record<string, string>
  /** The request's JSON body, when it has one. */
  body?: JsonValue
  /** The signed-in member who asked. A route is never open to the world. */
  userId: string
}

/** What a route answers: JSON, and nothing else. */
export interface RouteResponse {
  /** Left out, 200. */
  status?: number
  /** JSON. */
  body?: unknown
}

/** Answers one of the extension's declared routes. Registered with `songstress.routes.register`. */
export type RouteHandler = (request: RouteRequest) => Awaitable<RouteResponse>

/** Routes (the manifest's `contributes.routes`), served under a prefix that
 * belongs to the extension. Server entry; permission `routes`. */
export interface Routes {
  /** Registers the handler of a declared route.
   * @param id - The id the manifest declares it under.
   * @param handler - Answers the route's requests.
   * @example
   * ```ts
   * import { songstress } from 'songstress/server'
   *
   * songstress.routes.register('plays', async (request) => {
   *   const plays = (await songstress.storage.get<number>(`plays:${request.query.song}`, { userId: request.userId })) ?? 0
   *   return { status: 200, body: { plays } }
   * })
   * ```
   */
  register(id: string, handler: RouteHandler): Disposable
}
