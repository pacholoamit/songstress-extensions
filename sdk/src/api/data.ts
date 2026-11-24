// What an extension keeps and reaches: its settings, its own store, its own
// credentials, the network. Every call crosses to the host and so answers
// with a promise; every value that crosses is JSON.
//
// On the server one extension serves every member, so a call that concerns
// one member names them (`{ userId }`). In an app the member is the one
// signed in, and is never named.

import type { Awaitable, Disposable } from './common'

/** What a setting holds. A select holds the `value` of its option, a secret
 * holds text. */
export type SettingValue = string | number | boolean

/** One member, for a call that concerns them. */
export interface ForUser {
  /** The member the call concerns. */
  userId: string
}

/** What `settings.onChange` is told: a setting changed. */
export interface SettingChange {
  /** The setting's key. */
  key: string
  /** The new value; undefined when the setting was cleared. A secret's value
   * is never handed to code in an app. */
  value: SettingValue | undefined
  /** The member whose setting it is, for a setting of scope "user". */
  userId?: string
}

/** The extension's settings (the manifest's `contributes.settings`), as code
 * in an app reads them: the server's, this member's and this device's.
 * No permission. */
export interface Settings {
  /** What the setting holds: what was set, else its default, else undefined.
   * A secret is undefined here: it never leaves the server.
   * @param key - The setting's key, as the manifest declares it.
   * @example
   * ```ts
   * import { songstress } from 'songstress'
   *
   * const language = (await songstress.settings.get<string>('language')) ?? 'en'
   * console.log(language)
   * ```
   */
  get<Value extends SettingValue = SettingValue>(key: string): Promise<Value | undefined>
  /** Hears each change to a setting this side can read, for as long as the
   * entry is running. A change does not start an entry: code that is started
   * later reads the setting when it needs it.
   * @param listener - Called with each change.
   * @example
   * ```ts
   * import { songstress } from 'songstress'
   *
   * songstress.settings.onChange(async (change) => {
   *   // Another account's answers are no use: forget them.
   *   if (change.key !== 'account') return
   *   for (const key of await songstress.storage.keys('cache:')) await songstress.storage.delete(key)
   * })
   * ```
   */
  onChange(listener: (change: SettingChange) => Awaitable<void>): Disposable
}

/** The settings as the server entry reads them: settings of scope "server",
 * secrets included, and with `{ userId }` one member's settings of scope
 * "user". A device's settings stay on the device. */
export interface ServerSettings extends Settings {
  /** What the setting holds: what was set, else its default, else undefined. Secrets included.
   * @param key - The setting's key, as the manifest declares it.
   * @param user - With `{ userId }`, that member's setting of scope "user".
   * @example
   * ```ts
   * import { songstress } from 'songstress/server'
   *
   * songstress.hooks.onScrobble(async (song, play) => {
   *   // A setting of scope "user": this member's own choice.
   *   const share = await songstress.settings.get<boolean>('share-plays', { userId: play.userId })
   *   if (share !== false) console.log(`${play.userId} played ${song.title}`)
   * })
   * ```
   */
  get<Value extends SettingValue = SettingValue>(key: string, user?: ForUser): Promise<Value | undefined>
}

/** The extension's own store, as code in an app uses it: the signed-in
 * member's part of it. Small JSON values under text keys, under a quota.
 * Permission `storage`. */
export interface Store {
  /** What was last set under the key; undefined when nothing is. The type is
   * the caller's word for it: nothing checks it.
   * @param key - The key.
   * @example
   * ```ts
   * import { songstress } from 'songstress/client'
   *
   * const seen = (await songstress.storage.get<string[]>('seen')) ?? []
   * console.log(`${seen.length} songs seen`)
   * ```
   */
  get<Value = unknown>(key: string): Promise<Value | undefined>
  /** Keeps a JSON value under the key, in place of what was there.
   * @param key - The key.
   * @param value - A JSON value.
   * @example
   * ```ts
   * import { songstress } from 'songstress/client'
   *
   * songstress.hooks.onPlay(async (song) => {
   *   const seen = (await songstress.storage.get<string[]>('seen')) ?? []
   *   if (!seen.includes(song.id)) await songstress.storage.set('seen', [...seen, song.id])
   * })
   * ```
   */
  set(key: string, value: unknown): Promise<void>
  /** Forgets a key.
   * @param key - The key.
   * @example
   * ```ts
   * import { songstress } from 'songstress/client'
   *
   * await songstress.storage.delete('seen')
   * ```
   */
  delete(key: string): Promise<void>
  /** The keys held, in order; those that start with `prefix` when given.
   * @param prefix - Only the keys that start with it.
   * @example
   * ```ts
   * import { songstress } from 'songstress'
   *
   * for (const key of await songstress.storage.keys('cache:')) await songstress.storage.delete(key)
   * ```
   */
  keys(prefix?: string): Promise<string[]>
}

/** The store as the server entry uses it: one part for the extension as a
 * whole, and with `{ userId }` one part for each member, which is the part
 * code in that member's apps sees. A sandbox is started and stopped as
 * needed: what must last goes here, not in a variable. */
export interface ServerStore extends Store {
  /** What was last set under the key; undefined when nothing is.
   * @param key - The key.
   * @param user - With `{ userId }`, that member's part; left out, the extension's own.
   * @example
   * ```ts
   * import { songstress } from 'songstress/server'
   *
   * songstress.hooks.onPlay(async (song, play) => {
   *   const plays = (await songstress.storage.get<number>(`plays:${song.id}`, { userId: play.userId })) ?? 0
   *   console.log(`${song.title}, played ${plays} times before`)
   * })
   * ```
   */
  get<Value = unknown>(key: string, user?: ForUser): Promise<Value | undefined>
  /** Keeps a JSON value under the key, in place of what was there.
   * @param key - The key.
   * @param value - A JSON value.
   * @param user - With `{ userId }`, that member's part; left out, the extension's own.
   * @example
   * ```ts
   * import { songstress } from 'songstress/server'
   *
   * songstress.hooks.onPlay(async (song, play) => {
   *   await songstress.storage.set('last-played', { songId: song.id, at: play.startedAt }, { userId: play.userId })
   * })
   * ```
   */
  set(key: string, value: unknown, user?: ForUser): Promise<void>
  /** Forgets a key, the extension's or, with `{ userId }`, one member's.
   * @param key - The key.
   * @param user - With `{ userId }`, that member's part; left out, the extension's own.
   * @example
   * ```ts
   * import { songstress } from 'songstress/server'
   *
   * songstress.commands.register<{ songId: string }>('forget-plays', async (input, context) => {
   *   await songstress.storage.delete(`plays:${input.songId}`, { userId: context.userId })
   * })
   * ```
   */
  delete(key: string, user?: ForUser): Promise<void>
  /** The keys held, in order; those that start with `prefix` when given.
   * @param prefix - Only the keys that start with it.
   * @param user - With `{ userId }`, that member's part; left out, the extension's own.
   * @example
   * ```ts
   * import { songstress } from 'songstress/server'
   *
   * songstress.commands.register('forget-all-plays', async (_input, context) => {
   *   const member = { userId: context.userId }
   *   for (const key of await songstress.storage.keys('plays:', member)) await songstress.storage.delete(key, member)
   * })
   * ```
   */
  keys(prefix?: string, user?: ForUser): Promise<string[]>
}

/** The extension's own credentials: tokens it was handed, kept sealed, never
 * sent to an app and never shown again. Server entry; permission `secrets`.
 * For a key a person types, declare a setting of type "secret" instead. */
export interface Secrets {
  /** A secret kept under this key, the extension's or, with `{ userId }`, one member's; undefined when there is none.
   * @param key - The key.
   * @param user - With `{ userId }`, that member's secret; left out, the extension's own.
   * @example
   * ```ts
   * import { songstress } from 'songstress/server'
   *
   * songstress.hooks.onScrobble(async (song, play) => {
   *   const token = await songstress.secrets.get('token', { userId: play.userId })
   *   if (!token) return // this member has not signed in
   *   console.log(`scrobbling ${song.title} for ${play.userId}`)
   * })
   * ```
   */
  get(key: string, user?: ForUser): Promise<string | undefined>
  /** Keeps a secret, sealed, under this key.
   * @param key - The key.
   * @param value - The secret.
   * @param user - With `{ userId }`, that member's secret; left out, the extension's own.
   * @example
   * ```ts
   * import { fetchJson, songstress } from 'songstress/server'
   *
   * songstress.commands.register<{ apiKey: string }>('save-key', async (input, context) => {
   *   const me = await fetchJson<{ name: string }>('https://api.example.com/me', { headers: { 'x-api-key': input.apiKey } })
   *   await songstress.secrets.set('api-key', input.apiKey, { userId: context.userId })
   *   return { action: { type: 'toast', message: `Signed in as ${me.name}`, tone: 'success' } }
   * })
   * ```
   */
  set(key: string, value: string, user?: ForUser): Promise<void>
  /** Forgets the secret under this key.
   * @param key - The key.
   * @param user - With `{ userId }`, that member's secret; left out, the extension's own.
   * @example
   * ```ts
   * import { songstress } from 'songstress/server'
   *
   * songstress.commands.register('forget-key', async (_input, context) => {
   *   await songstress.secrets.delete('api-key', { userId: context.userId })
   * })
   * ```
   */
  delete(key: string, user?: ForUser): Promise<void>
}

/** A request, as plain data. */
export interface NetRequest {
  /** Left out, "GET". */
  method?: 'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  /** Sent as given. Without a `User-Agent` of its own the request says
   * `songstress-extension/<API version>`; one named here replaces it, for a
   * service that asks a client to say who it is. */
  headers?: Record<string, string>
  /** The request's body, written as `bodyEncoding` says. */
  body?: string
  /** How `body` is written: as text (the default) or as base64 for bytes. */
  bodyEncoding?: 'text' | 'base64'
  /** How the answer's body is wanted: text (the default) or base64. */
  responseEncoding?: 'text' | 'base64'
  /** Give up after this long. The host has its own limit, which wins. */
  timeoutMs?: number
  /** Left out, "follow": each hop is held to the hosts granted. "manual"
   * hands back the redirect itself. */
  redirect?: 'follow' | 'manual'
}

/** An answer, as plain data. */
export interface NetResponse {
  /** The HTTP status of the answer: 200, 404. */
  status: number
  /** The address that answered, after redirects. */
  url: string
  /** Header names in lowercase. */
  headers: Record<string, string>
  /** The answer's body, as text or as base64, as the request's `responseEncoding` asked. */
  body: string
}

/** The network. There is no global `fetch`: this is the only way out, and it
 * goes where the manifest's `network` permission names hosts and nowhere
 * else. Server code may also reach the user's own network, the targets of
 * `network.local`; client code never does: from an app, a request goes to
 * the public hosts `network` names alone, which the server's host holds it
 * to. The address a name resolves to is checked when connecting and on every
 * redirect, and an answer larger than the host allows is refused. */
export interface Net {
  /** Makes a request to a host the manifest names.
   * @param url - The address, at a host the manifest names.
   * @param request - The method, the headers and the body; a GET with none left out.
   * @example
   * ```ts
   * import { songstress } from 'songstress/server'
   *
   * const answer = await songstress.net.fetch('https://api.example.com/v1/charts', {
   *   headers: { accept: 'application/json' },
   *   timeoutMs: 10_000,
   * })
   * if (answer.status === 200) console.log(JSON.parse(answer.body))
   * ```
   */
  fetch(url: string, request?: NetRequest): Promise<NetResponse>
}
