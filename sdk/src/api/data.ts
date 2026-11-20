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
  userId: string
}

export interface SettingChange {
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
   * A secret is undefined here: it never leaves the server. */
  get<Value extends SettingValue = SettingValue>(key: string): Promise<Value | undefined>
  /** Hears each change to a setting this side can read, for as long as the
   * entry is running. A change does not start an entry: code that is started
   * later reads the setting when it needs it. */
  onChange(listener: (change: SettingChange) => Awaitable<void>): Disposable
}

/** The settings as the server entry reads them: settings of scope "server",
 * secrets included, and with `{ userId }` one member's settings of scope
 * "user". A device's settings stay on the device. */
export interface ServerSettings extends Settings {
  get<Value extends SettingValue = SettingValue>(key: string, user?: ForUser): Promise<Value | undefined>
}

/** The extension's own store, as code in an app uses it: the signed-in
 * member's part of it. Small JSON values under text keys, under a quota.
 * Permission `storage`. */
export interface Store {
  /** What was last set under the key; undefined when nothing is. The type is
   * the caller's word for it: nothing checks it. */
  get<Value = unknown>(key: string): Promise<Value | undefined>
  /** Keeps a JSON value under the key, in place of what was there. */
  set(key: string, value: unknown): Promise<void>
  delete(key: string): Promise<void>
  /** The keys held, in order; those that start with `prefix` when given. */
  keys(prefix?: string): Promise<string[]>
}

/** The store as the server entry uses it: one part for the extension as a
 * whole, and with `{ userId }` one part for each member, which is the part
 * code in that member's apps sees. A sandbox is started and stopped as
 * needed: what must last goes here, not in a variable. */
export interface ServerStore extends Store {
  get<Value = unknown>(key: string, user?: ForUser): Promise<Value | undefined>
  set(key: string, value: unknown, user?: ForUser): Promise<void>
  delete(key: string, user?: ForUser): Promise<void>
  keys(prefix?: string, user?: ForUser): Promise<string[]>
}

/** The extension's own credentials: tokens it was handed, kept sealed, never
 * sent to an app and never shown again. Server entry; permission `secrets`.
 * For a key a person types, declare a setting of type "secret" instead. */
export interface Secrets {
  get(key: string, user?: ForUser): Promise<string | undefined>
  set(key: string, value: string, user?: ForUser): Promise<void>
  delete(key: string, user?: ForUser): Promise<void>
}

/** A request, as plain data. */
export interface NetRequest {
  /** Left out, "GET". */
  method?: 'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  headers?: Record<string, string>
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
  status: number
  /** The address that answered, after redirects. */
  url: string
  /** Header names in lowercase. */
  headers: Record<string, string>
  body: string
}

/** The network. There is no global `fetch`: this is the only way out, and it
 * goes where the manifest's `network` permission names hosts (or, on the
 * user's own network, its `network.local` targets) and nowhere else. The
 * address a name resolves to is checked when connecting and on every
 * redirect, and an answer larger than the host allows is refused. */
export interface Net {
  fetch(url: string, request?: NetRequest): Promise<NetResponse>
}
