// The mock host of songstress/testing: one object under the key the SDK looks
// for (src/host.ts), which keeps what an entry registers, answers the store,
// the secrets, the settings and `host.info` from memory, and holds each call
// to the manifest it was given.

import type {
  Awaitable,
  ClientHooks,
  CommandContext,
  CommandHandler,
  CommandOutcome,
  Disposable,
  ForUser,
  HostInfo,
  NetRequest,
  NetResponse,
  ProviderRegistry,
  Providers,
  ServerHooks,
  SettingValue,
  Side,
} from '../api/index'
import { SongstressError } from '../api/common'
import { API_PERMISSIONS, HOST_KEY, type HostBridge, type Needs } from '../host'
import { API_VERSION } from '../version'
import { hostOf, reaches } from './network'

/** A call the code under test made, by the member's full name ("storage.get"). */
export interface MockCall {
  readonly member: string
  readonly args: readonly unknown[]
}

/** A request the code under test made through `net.fetch`. */
export interface MockRequest {
  readonly url: string
  readonly request: NetRequest
}

/** The parts of a manifest the mock host reads. Hand it your songstress.json
 * as you import it, or a `Manifest` the validator answered. */
export interface MockManifest {
  readonly id?: string
  readonly version?: string
  readonly hooks?: { readonly server?: readonly string[]; readonly client?: readonly string[] }
  /** Keyed by the permission's name, as the manifest writes it. */
  readonly permissions?: object
}

export interface MockHostOptions {
  /** The entry under test. Left out, "server". */
  side?: Side
  /** The extension's manifest. With it the mock host refuses what a real one
   * would: a call whose permission the manifest does not ask for, a request
   * to a host its `network` permission does not name (anything goes once it
   * asks for `network.local`: a test cannot tell what is on your network),
   * and a hook it does not list. Left out, nothing is refused. */
  manifest?: MockManifest
  /** What the settings hold, by key. A function answers for one member: it
   * is given the `userId` the code asked for, if any. */
  settings?: Record<string, SettingValue | undefined | ((userId: string | undefined) => SettingValue | undefined)>
  /** The network: what answers `net.fetch`. Whatever it leaves out is filled
   * in (status 200, the address asked, no headers, an empty body). With no
   * `fetch`, every request fails. */
  fetch?: (url: string, request: NetRequest) => Awaitable<Partial<NetResponse>>
  /** Answers for any other member, by its full name ("library.getSong"), or
   * in place of the mock host's own ("storage.get"). */
  answers?: Record<string, (...args: never[]) => unknown>
}

type ListenerOf<Hooks, Name> = Name extends keyof Hooks
  ? Hooks[Name] extends (listener: infer Listener) => Disposable
    ? Listener
    : never
  : never

type ArgumentsOf<Listener> = Listener extends (...args: infer Arguments) => unknown ? Arguments : never

/** A hook's name, on either side. */
export type HookName = keyof ServerHooks | keyof ClientHooks

/** What a hook's listeners are called with. */
export type HookArguments<Name extends HookName> = ArgumentsOf<ListenerOf<ServerHooks, Name> | ListenerOf<ClientHooks, Name>>

/** The provider a kind registers: `ProviderOf<'lyrics'>` is a LyricsProvider. */
export type ProviderOf<Kind extends keyof Providers> = Providers[Kind] extends ProviderRegistry<infer Provider> ? Provider : never

/** The mock host, as a test holds it. */
export interface MockHost {
  /** Every call the code made, in order. */
  readonly calls: readonly MockCall[]
  /** Every request it made through `net.fetch`, in order, refused ones too. */
  readonly requests: readonly MockRequest[]
  /** Fires a hook: each of its listeners is called in turn and waited for.
   * It throws when nothing listens, or when the manifest does not list the
   * hook. */
  emit<Name extends HookName>(hook: Name, ...args: HookArguments<Name>): Promise<void>
  /** Runs a command the code registered, as a person picking it would.
   * `context` is laid over `{ userId: 'member', source: 'menu' }`. */
  run(command: string, input?: unknown, context?: Partial<CommandContext>): Promise<CommandOutcome | undefined>
  /** The provider the code registered under a kind and an id. */
  provider<Kind extends keyof Providers>(kind: Kind, id: string): ProviderOf<Kind>
  /** What the code handed to any registering member, by the member's full
   * name and, where it takes one, the id: `registered('jobs.register', 'sync')`
   * is that job's handler, `registered('signIn.register')` the sign-in's. */
  registered<Handler = unknown>(member: string, id?: string): Handler
  /** Takes the mock host away. Later calls throw "no host" again. */
  remove(): void
}

/** An answer of the table; called with whatever the code passed. */
type Answer = (...args: never[]) => unknown

const ask = (answer: Answer, args: readonly unknown[]) => (answer as (...given: readonly unknown[]) => unknown)(...args)

/** The member a command runs for when the test names none. */
const MEMBER = 'member'

interface Registration {
  readonly id?: string
  readonly handler: unknown
}

/** A member that hands code over instead of asking for something. */
const registers = (member: string) => member.startsWith('hooks.') || member.endsWith('.register') || member === 'settings.onChange'

/** What an entry registered, by member. */
function createRegistry() {
  const kept = new Map<string, Registration[]>()
  const all = (member: string): Registration[] => {
    const list = kept.get(member) ?? []
    kept.set(member, list)
    return list
  }
  return {
    all,
    add(member: string, args: readonly unknown[]): Disposable {
      const entry: Registration = args.length > 1 ? { id: String(args[0]), handler: args[1] } : { handler: args[0] }
      const list = all(member)
      list.push(entry)
      return {
        dispose() {
          const at = list.indexOf(entry)
          if (at >= 0) list.splice(at, 1)
        },
      }
    },
    /** The last one registered under the id. */
    one(member: string, id?: string): unknown {
      const found = all(member).findLast((entry) => id === undefined || entry.id === id)
      if (found) return found.handler
      throw new Error(`Nothing is registered with songstress.${member}${id === undefined ? '' : ` under "${id}"`}.`)
    },
  }
}

/** A value as it would arrive after crossing to Songstress: JSON, and a copy. */
function crossed(value: unknown): unknown {
  const text = JSON.stringify(value)
  if (text === undefined) throw new SongstressError('invalid', 'Only JSON crosses to Songstress, and this value is not JSON.')
  return JSON.parse(text)
}

/** A store in memory: one part for the extension, one for each member. */
function createStore() {
  const parts = new Map<string, Map<string, unknown>>()
  const part = (user?: ForUser): Map<string, unknown> => {
    const name = user?.userId ?? ''
    const found = parts.get(name) ?? new Map<string, unknown>()
    parts.set(name, found)
    return found
  }
  return {
    // A copy, as on a real host: what was read can be changed without changing what is kept.
    get(key: string, user?: ForUser): unknown {
      const kept = part(user).get(key)
      return kept === undefined ? undefined : crossed(kept)
    },
    set(key: string, value: unknown, user?: ForUser): void {
      part(user).set(key, crossed(value))
    },
    delete(key: string, user?: ForUser): void {
      part(user).delete(key)
    },
    keys: (prefix = '', user?: ForUser) => [...part(user).keys()].filter((key) => key.startsWith(prefix)).sort(),
  }
}

/** What the manifest lets through. With no manifest, everything of the side's API. */
function createRules(side: Side, manifest: MockManifest | undefined) {
  const table: Readonly<Record<string, Needs>> = API_PERMISSIONS[side]
  const asked: { readonly [name: string]: unknown } = { ...manifest?.permissions }
  return {
    /** Refuses a member this side lacks, or one whose permission the manifest does not ask for. */
    allow(member: string): void {
      const needs = table[member]
      if (needs === undefined) throw new SongstressError('not-available', `${member} is not in the ${side} entry's API.`)
      // A request is judged by its address, in reach().
      if (manifest === undefined || needs === null || needs === 'network' || needs in asked) return
      throw new SongstressError('permission-denied', `${member} needs the permission "${needs}", which the manifest does not ask for.`)
    },
    /** Refuses a request to a host the manifest's `network` permission does not name. */
    reach(url: string): void {
      if (manifest === undefined || 'network.local' in asked) return
      const hosts = (asked.network as { hosts?: readonly string[] } | undefined)?.hosts ?? []
      if (reaches(hosts, url)) return
      const where = hostOf(url) || url
      throw new SongstressError('permission-denied', `A request to ${where} is refused: the manifest's "network" permission does not name that host.`)
    },
    /** Refuses a hook the manifest does not list: Songstress would not start the entry for it. */
    hears(hook: string): void {
      if (manifest === undefined || manifest.hooks?.[side]?.includes(hook)) return
      throw new Error(`The manifest does not list ${hook} under hooks.${side}, so Songstress would never start the entry for it.`)
    },
  }
}

interface Parts {
  readonly options: MockHostOptions
  readonly side: Side
  readonly requests: MockRequest[]
  readonly registry: ReturnType<typeof createRegistry>
  readonly rules: ReturnType<typeof createRules>
}

/** The members the mock host answers itself. */
function ownAnswers({ options, side, requests, registry, rules }: Parts): Record<string, Answer> {
  const store = createStore()
  const secrets = createStore()
  const info = (): HostInfo => ({
    apiVersion: API_VERSION,
    side,
    extension: { id: options.manifest?.id ?? 'mock.extension', version: options.manifest?.version ?? '0.0.0' },
  })
  const setting = (key: string, user?: ForUser) => {
    const held = options.settings?.[key]
    return typeof held === 'function' ? held(user?.userId) : held
  }
  const fetch = async (url: string, request: NetRequest = {}): Promise<NetResponse> => {
    requests.push({ url, request })
    rules.reach(url)
    if (!options.fetch) throw new SongstressError('failed', `The mock host has no network: give createMockHost a "fetch" to answer ${url}.`)
    return { status: 200, url, headers: {}, body: '', ...(await options.fetch(url, request)) }
  }
  const execute = async (id: string, input?: unknown) => {
    const handler = registry.one('commands.register', id) as CommandHandler
    return (await handler(input, { userId: MEMBER, source: 'code' }))?.value
  }
  return {
    'storage.get': store.get,
    'storage.set': store.set,
    'storage.delete': store.delete,
    'storage.keys': store.keys,
    'secrets.get': secrets.get,
    'secrets.set': secrets.set,
    'secrets.delete': secrets.delete,
    'settings.get': setting,
    'net.fetch': fetch,
    'host.info': info,
    'commands.execute': execute,
    // A notice and a render again reach no app here: each is in `calls`, for
    // a test to look at.
    'ui.notify': () => undefined,
    'ui.refresh': () => undefined,
  }
}

/** The bridge the SDK calls: registrations answer at once, as on a real host; everything else with a promise. */
function createBridge(parts: Parts, calls: MockCall[]): HostBridge {
  const { options, registry, rules } = parts
  const answers: Record<string, Answer> = { ...ownAnswers(parts), ...options.answers }
  const answerOf = (member: string): Answer => {
    const answer = answers[member]
    if (answer) return answer
    throw new SongstressError('not-available', `The mock host has no answer for ${member}: give one in createMockHost({ answers: { '${member}': ... } }).`)
  }
  return {
    call(member, args) {
      calls.push({ member, args })
      if (registers(member)) {
        rules.allow(member)
        return options.answers?.[member] ? ask(answerOf(member), args) : registry.add(member, args)
      }
      return new Promise((resolve) => {
        rules.allow(member)
        resolve(ask(answerOf(member), args))
      })
    },
  }
}

const slot = globalThis as { [HOST_KEY]?: HostBridge }

/** Puts a mock Songstress in place, for the entry a test then imports. */
export function createMockHost(options: MockHostOptions = {}): MockHost {
  const side = options.side ?? 'server'
  const calls: MockCall[] = []
  const requests: MockRequest[] = []
  const registry = createRegistry()
  const rules = createRules(side, options.manifest)
  const bridge = createBridge({ options, side, requests, registry, rules }, calls)
  slot[HOST_KEY] = bridge
  return {
    calls,
    requests,
    async emit(hook, ...args) {
      rules.hears(hook)
      const listeners = registry.all(`hooks.${hook}`)
      if (listeners.length === 0) throw new Error(`Nothing listens to ${hook}: the entry did not call songstress.hooks.${hook}.`)
      for (const { handler } of [...listeners]) await ask(handler as Answer, args)
    },
    async run(command, input, context) {
      const handler = registry.one('commands.register', command) as CommandHandler
      return (await handler(input, { userId: MEMBER, source: 'menu', ...context })) ?? undefined
    },
    provider: <Kind extends keyof Providers>(kind: Kind, id: string) => registry.one(`providers.${kind}.register`, id) as ProviderOf<Kind>,
    registered: <Handler>(member: string, id?: string) => registry.one(member, id) as Handler,
    remove() {
      if (slot[HOST_KEY] === bridge) delete slot[HOST_KEY]
    },
  }
}
