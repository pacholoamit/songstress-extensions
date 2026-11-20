// A value a source hands out for a while (a token, a client id): kept in
// memory while the instance lives, and in the extension's own store so
// another instance, or the next start, does not ask the source again.

import { songstress } from 'songstress/server'

interface Stored<T> {
  value: T
  /** When it stops being good, in ms since the epoch. */
  until: number
}

export class Kept<T> {
  private held: Stored<T> | null = null

  constructor(private readonly key: string) {}

  /** The value while it is good, from memory or the store; else null. */
  async get(): Promise<T | null> {
    if (this.held && Date.now() < this.held.until) return this.held.value
    const stored = await songstress.storage.get<Stored<T>>(this.key).catch(() => null)
    if (stored && typeof stored.until === 'number' && Date.now() < stored.until) {
      this.held = stored
      return stored.value
    }
    return null
  }

  /** Keeps value until `until`, in memory and in the store. */
  async set(value: T, until: number): Promise<void> {
    this.held = { value, until }
    await songstress.storage.set(this.key, this.held).catch(() => undefined)
  }

  /** Forgets it: the source refused it. */
  async drop(): Promise<void> {
    this.held = null
    await songstress.storage.delete(this.key).catch(() => undefined)
  }

  /** The value while it is good, else what fetch brings, kept until it
   * says. Two calls at once share one fetch. */
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

  private pending: Promise<T> | null = null
}
