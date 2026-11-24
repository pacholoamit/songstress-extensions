// songstress/sandbox: the globals an entry's code finds in Songstress's
// sandbox, and nothing more (SPEC.md, section 1, "The sandbox"). Name it in
// an extension's tsconfig.json:
//
//   "compilerOptions": { "lib": ["ES2023"], "types": ["songstress/sandbox"] }
//
// With the ES2023 library and these alone, code that reaches for `fetch`,
// `process`, `window` or `document` does not compile, which is the truth:
// they are not there. The way out is songstress.net.fetch.

/** The extension's log: `songstress dev` prints it, and the server keeps the
 * last of it for its admin. */
interface Console {
  /** Writes a line to the log.
   * @example
   * ```ts
   * console.log('synced', 12, 'songs')
   * ```
   */
  log(...data: unknown[]): void
  /** Writes a line to the log, as information.
   * @example
   * ```ts
   * console.info('signed in as', 'ana')
   * ```
   */
  info(...data: unknown[]): void
  /** Writes a line to the log, as a warning.
   * @example
   * ```ts
   * console.warn('the source asks to slow down: waiting 60 s')
   * ```
   */
  warn(...data: unknown[]): void
  /** Writes a line to the log, as an error.
   * @example
   * ```ts
   * console.error('the source answered', 503)
   * ```
   */
  error(...data: unknown[]): void
  /** Writes a line to the log, as detail for debugging.
   * @example
   * ```ts
   * console.debug('answer', { status: 200, bytes: 5120 })
   * ```
   */
  debug(...data: unknown[]): void
}

/** The extension's log. */
declare var console: Console

/** Calls `handler` once, after `ms` milliseconds. A timer does not keep a
 * call alive past the promise its handler returned.
 * @param handler - What to call.
 * @param ms - How long to wait, in milliseconds.
 * @param args - What `handler` is called with.
 * @returns The timer's id, for `clearTimeout`.
 * @example
 * ```ts
 * const pause = (ms: number) => new Promise<void>((done) => setTimeout(done, ms))
 *
 * await pause(500)
 * ```
 */
declare function setTimeout(handler: (...args: never[]) => void, ms?: number, ...args: unknown[]): number
/** Calls `handler` every `ms` milliseconds, until `clearInterval`. Like every
 * timer, it does not keep a call alive past the promise its handler returned.
 * @param handler - What to call.
 * @param ms - How long between calls, in milliseconds.
 * @param args - What `handler` is called with.
 * @returns The timer's id, for `clearInterval`.
 * @example
 * ```ts
 * let beats = 0
 * const timer = setInterval(() => {
 *   beats += 1
 *   if (beats === 3) clearInterval(timer)
 * }, 1000)
 * ```
 */
declare function setInterval(handler: (...args: never[]) => void, ms?: number, ...args: unknown[]): number
/** Stops a timer `setTimeout` set.
 * @param id - The timer's id.
 * @example
 * ```ts
 * const slow = setTimeout(() => console.warn('the source is slow to answer'), 5000)
 * // ...the answer came in time:
 * clearTimeout(slow)
 * ```
 */
declare function clearTimeout(id: number | undefined): void
/** Stops a timer `setInterval` set.
 * @param id - The timer's id.
 * @example
 * ```ts
 * const timer = setInterval(() => console.log('still working'), 10_000)
 * // ...the work is done:
 * clearInterval(timer)
 * ```
 */
declare function clearInterval(id: number | undefined): void
