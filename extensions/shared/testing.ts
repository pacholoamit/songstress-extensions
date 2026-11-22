// A stand-in Songstress for these extensions' tests: it answers what the
// code asks of the host (the network from a table of routes, the store and
// the settings from memory), keeps the providers the code registers, and
// lets a test call them as the server does.

import { vi } from 'vitest'

const HOST_KEY = Symbol.for('songstress.host')

export interface Answer {
  status?: number
  body?: string
  /** A script larger than the host answers in one request, as bytes: a
   * request for it as it is fails as the host's does ("limit-exceeded"), and
   * one that asks for it gzipped, as base64, gets these bytes. */
  large?: Uint8Array
  headers?: Record<string, string>
  /** The address that answered, when a redirect led elsewhere. */
  url?: string
}

/** A route: requests whose method and address match get its answer. */
export type Route = [method: string, url: RegExp, answer: Answer | ((url: string, request: Request) => Answer)]

interface Request {
  method?: string
  headers?: Record<string, string>
  body?: string
  responseEncoding?: 'text' | 'base64'
}

export const ok = (value: unknown): Answer => ({ status: 200, body: JSON.stringify(value), headers: { 'content-type': 'application/json' } })
export const page = (body: string, status = 200): Answer => ({ status, body, headers: { 'content-type': 'text/html' } })

type Methods = Record<string, (...args: unknown[]) => Promise<unknown>>

export interface StandIn {
  /** The requests the code made, as "METHOD url". */
  seen: string[]
  routes: Route[]
  store: Map<string, unknown>
  settings: Record<string, unknown>
  /** Calls a registered provider's method as the server does, the context
   * last. */
  ask(kind: string, source: string, method: string, ...args: unknown[]): Promise<unknown>
}

/** Puts a stand-in host in place and loads the extension's server entry
 * into it afresh. */
export async function load(entry: () => Promise<unknown>, settings: Record<string, unknown> = {}): Promise<StandIn> {
  const providers = new Map<string, Methods>()
  const stand: StandIn = {
    seen: [],
    routes: [],
    store: new Map(),
    settings,
    async ask(kind, source, method, ...args) {
      const provider = providers.get(`${kind}/${source}`)
      const fn = provider?.[method]
      if (!fn) throw new Error(`no ${kind} provider ${source} with ${method}`)
      return fn(...args, {})
    },
  }
  const answer = (member: string, args: readonly unknown[]): unknown => {
    const registered = /^providers\.(\w+)\.register$/.exec(member)
    if (registered) {
      providers.set(`${registered[1]}/${String(args[0])}`, args[1] as Methods)
      return { dispose: () => undefined }
    }
    switch (member) {
      case 'net.fetch':
        return fetchFrom(stand, String(args[0]), (args[1] ?? {}) as Request)
      case 'storage.get':
        return Promise.resolve(stand.store.get(String(args[0])) ?? null)
      case 'storage.set':
        stand.store.set(String(args[0]), args[1])
        return Promise.resolve()
      case 'storage.delete':
        stand.store.delete(String(args[0]))
        return Promise.resolve()
      case 'settings.get':
        return Promise.resolve(stand.settings[String(args[0])] ?? null)
    }
    return Promise.reject(new Error(`the stand-in host does not answer ${member}`))
  }
  ;(globalThis as Record<symbol, unknown>)[HOST_KEY] = { call: answer }
  vi.resetModules()
  await entry()
  return stand
}

function fetchFrom(stand: StandIn, url: string, request: Request): Promise<unknown> {
  const method = request.method ?? 'GET'
  stand.seen.push(`${method} ${url}`)
  for (const [m, pattern, reply] of stand.routes) {
    if (m !== method || !pattern.test(url)) continue
    const a = typeof reply === 'function' ? reply(url, request) : reply
    if (!a.large) return Promise.resolve({ status: a.status ?? 200, url: a.url ?? url, headers: a.headers ?? {}, body: a.body ?? '' })
    const gzipped = request.headers?.['accept-encoding'] === 'gzip' && request.responseEncoding === 'base64'
    // The host's own refusal: an Error that looks like the SDK's, made outside the bundle.
    if (!gzipped) return Promise.reject(Object.assign(new Error('net.fetch: the answer is larger than 2621440 bytes'), { name: 'SongstressError', code: 'limit-exceeded' }))
    return Promise.resolve({ status: a.status ?? 200, url: a.url ?? url, headers: { 'content-encoding': 'gzip' }, body: Buffer.from(a.large).toString('base64') })
  }
  return Promise.resolve({ status: 404, url, headers: {}, body: 'not found' })
}

/** Whether every request went to one of the hosts (an exact name, or every
 * name under "*.domain"). */
export function onlyTo(stand: StandIn, hosts: readonly string[]): boolean {
  return stand.seen.every((line) => {
    const host = /^\w+ https?:\/\/([^/?#]+)/.exec(line)?.[1] ?? ''
    return hosts.some((h) => (h.startsWith('*.') ? host.endsWith(h.slice(1)) : host === h))
  })
}
