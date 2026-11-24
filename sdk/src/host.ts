// Where the SDK meets a host. This package holds no implementation of the
// API: `songstress` is an object of functions that each hand their call to
// whatever host is present, by the member's name ("hooks.onPlay",
// "providers.lyrics.register"). The host is one object with one function,
// found under a well-known symbol on the global object. A sandbox's own
// runtime puts it there before an entry's code runs, and so does a test's
// mock. With none, every call throws "no host".
//
// The tables below are the API's members, each with the permission its call
// needs. They are checked against the API's types when this file compiles, so
// a member cannot be added to one and forgotten in the other.

import type { ClientApi, ServerApi, SharedApi } from './api/api'
import { SongstressError } from './api/common'
import { HOOK_PERMISSIONS } from './manifest/rules/permissions'
import type { PermissionName } from './manifest/schema'

/** The permission a member's call needs; null when it needs none. */
export type Needs = PermissionName | null

/** An API's shape, with each function replaced by what calling it needs. */
type Members<Api> = {
  readonly [Name in keyof Api]-?: Api[Name] extends (...args: never[]) => unknown ? Needs : Members<Api[Name]>
}

/** What a host gives the SDK: the one function every call goes through. */
export interface HostBridge {
  call(member: string, args: readonly unknown[]): unknown
}

/** Where the host is looked for on the global object. */
export const HOST_KEY = Symbol.for('songstress.host')

function bridge(): HostBridge {
  const found = (globalThis as { [HOST_KEY]?: HostBridge })[HOST_KEY]
  if (found) return found
  const where = 'The extension API works only inside Songstress, or in a test that put a mock host in place.'
  throw new SongstressError('no-host', `songstress: no host. ${where}`)
}

const REGISTER = { register: null } as const
const PROVIDER = { register: 'providers' } as const

const SHARED: Members<SharedApi> = {
  hooks: { onPlay: HOOK_PERMISSIONS.server.onPlay },
  commands: { register: null },
  ui: { pages: REGISTER, panels: REGISTER, status: REGISTER },
  settings: { get: null, onChange: null },
  storage: { get: 'storage', set: 'storage', delete: 'storage', keys: 'storage' },
  // The user's own network needs `network.local` instead: the address decides.
  net: { fetch: 'network' },
  host: { info: null },
}

/** A notice, and rendering again: no permission, under the host's caps. */
const UI_TOLD = { ...SHARED.ui, notify: null, refresh: null } as const

const SERVER: Members<ServerApi> = {
  ...SHARED,
  hooks: HOOK_PERMISSIONS.server,
  ui: UI_TOLD,
  secrets: { get: 'secrets', set: 'secrets', delete: 'secrets' },
  providers: {
    search: PROVIDER,
    lookup: PROVIDER,
    links: PROVIDER,
    lyrics: PROVIDER,
    metadata: PROVIDER,
    artwork: PROVIDER,
    artistInfo: PROVIDER,
    scrobble: PROVIDER,
    recommend: PROVIDER,
    play: PROVIDER,
    download: PROVIDER,
  },
  jobs: { register: 'jobs', start: 'jobs' },
  routes: { register: 'routes' },
  // The handlers keep the account's tokens: the permission that keeps them.
  signIn: { register: 'secrets' },
  library: {
    getSong: 'library.read',
    getAlbum: 'library.read',
    getArtist: 'library.read',
    getPlaylist: 'library.read',
    getAlbumSongs: 'library.read',
    getPlaylistSongs: 'library.read',
    search: 'library.read',
  },
  users: { get: 'users.read', list: 'users.read' },
}

const CLIENT: Members<ClientApi> = {
  ...SHARED,
  hooks: HOOK_PERMISSIONS.client,
  commands: { register: null, execute: null },
  ui: UI_TOLD,
  player: {
    getState: 'listening.read',
    play: 'player.control',
    pause: 'player.control',
    next: 'player.control',
    previous: 'player.control',
    seek: 'player.control',
  },
  queue: { get: 'listening.read', add: 'player.control' },
}

type Table = { readonly [name: string]: Needs | Table }

const isTable = (entry: Needs | Table): entry is Table => typeof entry === 'object' && entry !== null

/** The API object a table describes: each member a function that hands its
 * call to the host. */
function build(table: Table, path: readonly string[] = []): object {
  const members = Object.entries(table).map(([name, entry]) => {
    const member = [...path, name]
    const call = (...args: unknown[]) => bridge().call(member.join('.'), args)
    return [name, isTable(entry) ? build(entry, member) : call]
  })
  return Object.freeze(Object.fromEntries(members))
}

/** A table's members by their full names: "storage.get" → "storage". */
function flatten(table: Table, path: readonly string[] = []): [string, Needs][] {
  return Object.entries(table).flatMap(([name, entry]) =>
    isTable(entry) ? flatten(entry, [...path, name]) : [[[...path, name].join('.'), entry] as [string, Needs]],
  )
}

const permissions = (table: Table): Readonly<Record<string, Needs>> => Object.freeze(Object.fromEntries(flatten(table)))

/** The API code that runs in either entry imports: `import { songstress } from 'songstress'`. */
export const sharedApi = build(SHARED) as SharedApi
/** The server entry's API: `import { songstress } from 'songstress/server'`. */
export const serverApi = build(SERVER) as ServerApi
/** The client entry's API: `import { songstress } from 'songstress/client'`. */
export const clientApi = build(CLIENT) as ClientApi

/** Every member of the API by its full name, with the permission its call
 * needs (null for none), for each entry. A host checks grants from this
 * table, and its tests prove each member refuses without its grant.
 * `net.fetch` is listed under `network`: a request to a target on the user's
 * own network needs `network.local` instead. */
export const API_PERMISSIONS = Object.freeze({
  shared: permissions(SHARED),
  server: permissions(SERVER),
  client: permissions(CLIENT),
})
