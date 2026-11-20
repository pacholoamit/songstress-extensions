// The few shapes every part of the extension API shares.

/** Something that can be taken back: a listener, a handler, a provider.
 * `dispose()` removes it; calling it again does nothing. Everything an
 * extension registers is removed for it when the extension is stopped. */
export interface Disposable {
  dispose(): void
}

/** What crosses between an extension and Songstress: JSON, and nothing else.
 * No function, no date object, no binary value survives the crossing.
 *
 * What Songstress hands to an extension is typed as this. What an extension
 * hands to Songstress (a value to store, a route's answer, a command's input)
 * is typed `unknown`, because TypeScript cannot tell that an interface of
 * yours is JSON: it must be all the same, and a value that is not is refused
 * with the code "invalid". */
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

/** A value, or a promise of it: a handler may answer either way. */
export type Awaitable<Value> = Value | Promise<Value>

/** Why a call to the API failed.
 * - `no-host`: the code is not running inside Songstress (a test with no mock host)
 * - `permission-denied`: the manifest did not ask for it, or nobody granted it
 * - `not-available`: this side, this app or this build cannot do it
 * - `limit-exceeded`: a quota, a size, a rate or a deadline was passed
 * - `invalid`: an argument is wrong, or names something that does not exist
 * - `failed`: anything else; the message says what */
export type SongstressErrorCode =
  | 'no-host'
  | 'permission-denied'
  | 'not-available'
  | 'limit-exceeded'
  | 'invalid'
  | 'failed'

/** The error every call to the API rejects or throws with. */
export class SongstressError extends Error {
  override readonly name = 'SongstressError'
  readonly code: SongstressErrorCode

  constructor(code: SongstressErrorCode, message: string) {
    super(message)
    this.code = code
  }
}
