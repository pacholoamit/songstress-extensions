// A value a source hands out for a while (a token, a client id): kept in
// memory while the entry runs, and in the extension's own store so the next
// start, or another instance, does not ask the source again.

import { serverApi as songstress } from '../host'

interface Stored<T> {
  value: T
  /** When it stops being good, in milliseconds since 1970. */
  until: number
}

const good = <T>(stored: Stored<T> | null | undefined): stored is Stored<T> =>
  typeof stored === 'object' && stored !== null && typeof stored.until === 'number' && Date.now() < stored.until

/** A value that is good for a while, kept until then: in memory, and under
 * its key in the extension's store (`songstress.storage`), so a restart
 * does not ask the source for a new one. Without the `storage` permission
 * it is kept in memory only: a store that refuses is passed over, never
 * thrown. What it keeps crosses to Songstress, so it is JSON.
 * @example
 * ```ts
 * import { fetchJson, KeptValue } from 'songstress/server'
 *
 * const token = new KeptValue<string>('token')
 *
 * // The token while it is good; else a new one, kept until the source says it ends.
 * async function currentToken(): Promise<string> {
 *   return token.getOr(async () => {
 *     const got = await fetchJson<{ token: string; expiresInS: number }>('https://api.example.com/token')
 *     return { value: got.token, until: Date.now() + got.expiresInS * 1000 }
 *   })
 * }
 * ```
 */
export class KeptValue<T> {
  private held: Stored<T> | null = null
  private pending: Promise<T> | null = null

  /** A value kept under `key` in the extension's store.
   * @param key - Its key in the store: one of the extension's own, as `songstress.storage` keys are.
   */
  constructor(private readonly key: string) {}

  /** The value while it is good, from memory or the store; null when there is none, or it has run out.
   * @returns The value, or null.
   * @example
   * ```ts
   * import { KeptValue } from 'songstress/server'
   *
   * const token = new KeptValue<string>('token')
   *
   * const current = await token.get()
   * if (current === null) console.log('no token, or it ran out')
   * ```
   */
  async get(): Promise<T | null> {
    if (good(this.held)) return this.held.value
    const stored = await songstress.storage.get<Stored<T>>(this.key).catch(() => null)
    if (!good(stored)) return null
    this.held = stored
    return stored.value
  }

  /** Keeps a value until a time, in memory and in the store.
   * @param value - The value.
   * @param until - When it stops being good, in milliseconds since 1970 (as `Date.now()` counts).
   * @example
   * ```ts
   * import { fetchJson, KeptValue } from 'songstress/server'
   *
   * const token = new KeptValue<string>('token')
   *
   * const got = await fetchJson<{ token: string; expiresInS: number }>('https://api.example.com/token')
   * await token.set(got.token, Date.now() + got.expiresInS * 1000)
   * ```
   */
  async set(value: T, until: number): Promise<void> {
    this.held = { value, until }
    await songstress.storage.set(this.key, this.held).catch(() => undefined)
  }

  /** Forgets the value, in memory and in the store: the source refused it.
   * @example
   * ```ts
   * import { fetchResponse, KeptValue } from 'songstress/server'
   *
   * const token = new KeptValue<string>('token')
   *
   * const answer = await fetchResponse('https://api.example.com/me', { headers: { authorization: `Bearer ${await token.get()}` } })
   * if (answer.status === 401) await token.delete() // refused: the next call asks for a new one
   * ```
   */
  async delete(): Promise<void> {
    this.held = null
    await songstress.storage.delete(this.key).catch(() => undefined)
  }

  /** The value while it is good; else what `fetch` brings, kept until the
   * time it gives. Calls made while `fetch` runs wait for that one: the
   * source is asked once. A `fetch` that throws keeps nothing, and the next
   * call asks again.
   * @param fetch - Brings a new value, and when it stops being good.
   * @returns The value.
   * @example
   * ```ts
   * import { findInAnswer, KeptValue, ProviderFailure } from 'songstress/server'
   *
   * const clientId = new KeptValue<string>('client-id')
   *
   * const id = await clientId.getOr(async () => {
   *   const found = await findInAnswer('https://player.example.com/app.js', (text) => /client_id:"(\w+)"/.exec(text)?.[1] ?? null)
   *   if (!found) throw new ProviderFailure('unavailable', { message: 'the player holds no client id' })
   *   return { value: found, until: Date.now() + 24 * 60 * 60 * 1000 } // good for a day
   * })
   * ```
   */
  async getOr(fetch: () => Promise<{ value: T; until: number }>): Promise<T> {
    const current = await this.get()
    if (current !== null) return current
    this.pending ??= fetch().then(
      async (got) => {
        await this.set(got.value, got.until)
        this.pending = null
        return got.value
      },
      (error: unknown) => {
        this.pending = null
        throw error
      },
    )
    return this.pending
  }
}
