import { afterEach, describe, expect, it } from 'vitest'
import packageJson from '../package.json'
import { ProviderFailure, SongstressError } from './api/index'
import { songstress as client } from './client'
import { API_PERMISSIONS, songstress as shared, type ClientApi, type ServerApi } from './index'
import { RESERVED_PUBLISHERS } from './manifest/rules/identity'
import { HOOK_PERMISSIONS } from './manifest/rules/permissions'
import { CLIENT_HOOKS, PERMISSIONS, PROVIDER_KINDS, SERVER_HOOKS, type ProviderKind } from './manifest/schema'
import type { ClientHook, ServerHook } from './manifest/types.generated'
import { songstress as server } from './server'
import { installHost } from './test/host'
import { API_VERSION } from './version'

// The API and the manifest's schema name the same hooks and the same kinds
// of provider: checked by the compiler, which fails this file when one side
// has a name the other lacks.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false
const namesAgree: Same<keyof ServerApi['hooks'], ServerHook> &
  Same<keyof ClientApi['hooks'], ClientHook> &
  Same<keyof ServerApi['providers'], ProviderKind> = true

const ENTRIES = { shared, server, client } as const
type EntryName = keyof typeof ENTRIES

/** The function `name` ("storage.get") names in an entry's API. */
function member(entry: EntryName, name: string): (...args: unknown[]) => unknown {
  const found = name.split('.').reduce<unknown>((at, part) => (at as Record<string, unknown>)[part], ENTRIES[entry])
  return found as (...args: unknown[]) => unknown
}

const ALL = (Object.keys(ENTRIES) as EntryName[]).flatMap((entry) =>
  Object.keys(API_PERMISSIONS[entry]).map((name) => [entry, name] as const),
)

let host: ReturnType<typeof installHost> | undefined

afterEach(() => {
  host?.remove()
  host = undefined
})

describe('with no host', () => {
  it.each(ALL)('%s %s throws "no host"', (entry, name) => {
    expect(() => member(entry, name)()).toThrow(SongstressError)
    expect(() => member(entry, name)()).toThrow(/no host/)
  })

  it('says so with a code a program can read', () => {
    try {
      shared.host.info()
      expect.unreachable()
    } catch (error) {
      expect(error).toMatchObject({ name: 'SongstressError', code: 'no-host' })
    }
  })
})

describe('with a host', () => {
  it.each(ALL)('%s %s hands its call over by name, with its arguments, and hands back the answer', (entry, name) => {
    host = installHost({ [name]: () => 'answered' })
    expect(member(entry, name)('one', 2)).toBe('answered')
    expect(host.calls).toEqual([{ member: name, args: ['one', 2] }])
  })

  it('finds the host at each call, not once at import', () => {
    expect(() => shared.host.info()).toThrow(/no host/)
    host = installHost({ 'host.info': () => 'now' })
    expect(shared.host.info()).toBe('now')
  })
})

describe('the API objects', () => {
  it('cannot be changed by the code that uses them', () => {
    for (const api of Object.values(ENTRIES)) {
      expect(Object.isFrozen(api)).toBe(true)
      expect(Object.isFrozen(api.hooks)).toBe(true)
      expect(Object.isFrozen(api.ui.pages)).toBe(true)
    }
    expect(Object.isFrozen(API_PERMISSIONS)).toBe(true)
    expect(Object.values(API_PERMISSIONS).every((table) => Object.isFrozen(table))).toBe(true)
  })

  it('have the hooks the schema lists for their side, and no other', () => {
    expect(Object.keys(server.hooks).sort()).toEqual([...SERVER_HOOKS].sort())
    expect(Object.keys(client.hooks).sort()).toEqual([...CLIENT_HOOKS].sort())
    expect(Object.keys(shared.hooks)).toEqual(SERVER_HOOKS.filter((hook) => (CLIENT_HOOKS as readonly string[]).includes(hook)))
  })

  it('have a registry for every kind of provider the schema lists', () => {
    expect(namesAgree).toBe(true)
    expect(Object.keys(server.providers)).toEqual([...PROVIDER_KINDS])
  })

  it('share what both sides have', () => {
    for (const name of Object.keys(API_PERMISSIONS.shared)) {
      expect(API_PERMISSIONS.server[name], name).toBe(API_PERMISSIONS.shared[name])
      if (!name.startsWith('hooks.')) expect(API_PERMISSIONS.client[name], name).toBe(API_PERMISSIONS.shared[name])
    }
  })
})

describe('the permission each member needs', () => {
  const needed = (entry: EntryName) => new Set(Object.values(API_PERMISSIONS[entry]).filter((name) => name !== null))

  it('is a permission of the schema', () => {
    for (const entry of Object.keys(ENTRIES) as EntryName[]) {
      expect([...needed(entry)].filter((name) => !PERMISSIONS.includes(name))).toEqual([])
    }
  })

  it('is the same one the validator asks a hook for', () => {
    for (const hook of SERVER_HOOKS) expect(API_PERMISSIONS.server[`hooks.${hook}`]).toBe(HOOK_PERMISSIONS.server[hook])
    for (const hook of CLIENT_HOOKS) expect(API_PERMISSIONS.client[`hooks.${hook}`]).toBe(HOOK_PERMISSIONS.client[hook])
  })

  it('leaves no permission of the schema without a call that uses it', () => {
    // `network.local` is the one that names no member of its own: it widens
    // where net.fetch may go.
    const used = new Set([...needed('server'), ...needed('client')])
    expect(PERMISSIONS.filter((name) => !used.has(name))).toEqual(['network.local'])
  })

  it('tells the validator which permissions only one side can use', () => {
    // rules/permissions.ts calls a permission unused when its side has no
    // code. These are the lists it must hold.
    const only = (side: EntryName, other: EntryName) => [...needed(side)].filter((name) => !needed(other).has(name)).sort()
    expect(only('server', 'client')).toEqual(['jobs', 'library.read', 'providers', 'routes', 'secrets', 'users.read'])
    expect(only('client', 'server')).toEqual(['player.control'])
  })
})

describe('names kept for the API', () => {
  it('cover every namespace and the first part of every permission', () => {
    // An id is lowercase: a namespace that is not (`signIn`) is no publisher's
    // name to begin with, and needs no keeping.
    const publishable = (name: string) => name === name.toLowerCase()
    const namespaces = Object.values(ENTRIES).flatMap((api) => Object.keys(api)).filter(publishable)
    const firstParts = PERMISSIONS.map((name) => name.split('.')[0])
    expect([...new Set([...namespaces, ...firstParts])].filter((name) => !RESERVED_PUBLISHERS.includes(name))).toEqual([])
  })
})

describe('the version', () => {
  it("is the package's own", () => {
    expect(API_VERSION).toBe(packageJson.version)
  })
})

describe('a failure a provider names', () => {
  it('carries its code and how long to wait', () => {
    const failure = new ProviderFailure('rate-limited', { retryAfterS: 30 })
    expect(failure).toBeInstanceOf(Error)
    expect(failure).toMatchObject({ name: 'ProviderFailure', code: 'rate-limited', retryAfterS: 30, message: 'rate-limited' })
    expect(new ProviderFailure('unavailable', { message: 'The source answered 503.' }).message).toBe('The source answered 503.')
  })
})

// What the types must refuse, checked when this file is compiled: an
// expected error that does not happen is itself an error. Nothing here runs.
function typesRefuse(serverApi: ServerApi, clientApi: ClientApi): void {
  // @ts-expect-error onPause is a hook of the client entry
  serverApi.hooks.onPause(() => undefined)
  // @ts-expect-error onScrobble is a hook of the server entry
  clientApi.hooks.onScrobble(() => undefined)
  // @ts-expect-error providers are registered in the server entry
  clientApi.providers.lyrics.register('a', { find: () => ({ status: 'none' }) })
  // @ts-expect-error the player belongs to an app
  serverApi.player.pause()
  // @ts-expect-error in an app the member is the one signed in, and is not named
  void clientApi.storage.get('key', { userId: 'u1' })
  // @ts-expect-error "podcast" is not a kind of provider
  serverApi.providers.podcast.register('a', {})
  // @ts-expect-error a lyrics provider finds lyrics
  serverApi.providers.lyrics.register('a', { search: () => ({}) })
  // @ts-expect-error an action has a known type
  serverApi.commands.register('a', () => ({ action: { type: 'explode' } }))
  // @ts-expect-error server code runs no command: it calls its own functions
  void serverApi.commands.execute('a')
  // @ts-expect-error a sign-in is the server entry's
  clientApi.signIn.register({ start: () => ({ url: '' }), finish: () => ({ account: '' }) })
  // @ts-expect-error a sign-in has both halves
  serverApi.signIn.register({ start: () => ({ url: 'https://service.example/sign-in' }) })
}

describe('the types', () => {
  it('refuse a hook, a namespace or a shape on the wrong side (checked by the compiler)', () => {
    expect(typesRefuse).toBeTypeOf('function')
  })
})
