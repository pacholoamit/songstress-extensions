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
  /** Tells Activity how far the run is: `done` of `total`, and a few words. */
  progress(done: number, total?: number, note?: string): void
}

/** Does one run. A run has a deadline of the host's: do a slice, keep where
 * you are in storage, and let the next run go on. Throwing marks the run as
 * failed, with the error's message. */
export type JobHandler = (run: JobRun) => Awaitable<void>

/** Jobs (the manifest's `contributes.jobs`), each shown in Activity while it
 * runs. Server entry; permission `jobs`. */
export interface Jobs {
  register(id: string, handler: JobHandler): Disposable
  /** Queues a run of one of the extension's jobs, with `input` (JSON) for
   * its handler; resolves to the run's id. A job already waiting or running
   * is not queued twice. */
  start(id: string, input?: unknown): Promise<string>
}

/** A request to one of the extension's routes. */
export interface RouteRequest {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  /** The `:name` parts of the route's path. */
  params: Record<string, string>
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

export type RouteHandler = (request: RouteRequest) => Awaitable<RouteResponse>

/** Routes (the manifest's `contributes.routes`), served under a prefix that
 * belongs to the extension. Server entry; permission `routes`. */
export interface Routes {
  register(id: string, handler: RouteHandler): Disposable
}
