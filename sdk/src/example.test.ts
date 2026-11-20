import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import manifest from '../examples/tunelog/songstress.json'
import type { PlayEvent, ScrobbleEvent, Song } from './api/index'
import { validateManifest } from './manifest/validate'
import { bytesOf } from './test/corpus'
import { installHost, type Call } from './test/host'

// The example of SPEC.md is a real extension: its manifest is checked by the
// validator, its code is compiled against the API with the rest of the
// package, and here it runs against a stand-in host.

const SONG: Song = { id: 's1', title: 'Blue in Green', artist: 'Miles Davis', album: 'Kind of Blue', durationS: 337 }
const PLAY: ScrobbleEvent & PlayEvent = { userId: 'u1', playedAt: '2026-11-17T08:00:00Z', startedAt: '2026-11-17T08:00:00Z' }

type Listener = (...args: unknown[]) => Promise<unknown>

let host: ReturnType<typeof installHost>
let registered: Call[]
let status = 200
let stored: unknown

beforeAll(async () => {
  host = installHost({
    'settings.get': (key: string) => (key === 'token' ? 'tl-token' : undefined),
    'storage.get': () => stored,
    'storage.set': (_key: string, value: unknown) => {
      stored = value
    },
    'net.fetch': () => Promise.resolve({ status, url: '', headers: {}, body: '' }),
  })
  await import('../examples/tunelog/src/server')
  registered = [...host.calls]
})

afterAll(() => host.remove())

const listener = (member: string) => registered.find((call) => call.member === member)!.args.at(-1) as Listener
const requests = () => host.calls.filter((call) => call.member === 'net.fetch').map((call) => call.args[0])

describe('the example extension', () => {
  it('has a manifest the official list would take', () => {
    expect(validateManifest(manifest, { profile: 'listing' }).issues).toEqual([])
  })

  it('has the same manifest as the corpus', () => {
    expect(manifest).toEqual(JSON.parse(new TextDecoder().decode(bytesOf('valid/scrobbler.json'))))
  })

  it('registers, as it starts, exactly what its manifest declares', () => {
    const hooks = registered.filter((call) => call.member.startsWith('hooks.')).map((call) => call.member.slice(6))
    expect(hooks).toEqual(manifest.hooks.server)
    const commands = registered.filter((call) => call.member === 'commands.register').map((call) => call.args[0])
    expect(commands).toEqual(manifest.contributes.commands.map((command) => command.id))
  })

  it('reaches only the hosts its manifest asks for', async () => {
    await listener('hooks.onPlay')(SONG, PLAY)
    await listener('hooks.onScrobble')(SONG, PLAY)
    await listener('commands.register')(undefined, { userId: 'u1', source: 'settings' })
    const hosts = requests().map((url) => new URL(String(url)).host)
    expect(hosts.length).toBe(3)
    expect(hosts.filter((name) => !manifest.permissions.network.hosts.includes(name))).toEqual([])
  })

  it('keeps a play Tunelog did not take, and sends it with the next', async () => {
    stored = undefined
    status = 503
    await listener('hooks.onScrobble')(SONG, PLAY)
    expect(stored).toEqual([{ title: 'Blue in Green', artist: 'Miles Davis', album: 'Kind of Blue', playedAt: PLAY.playedAt }])
    status = 200
    await listener('hooks.onScrobble')({ ...SONG, title: 'So What' }, PLAY)
    const sent = JSON.parse((host.calls.findLast((call) => call.member === 'net.fetch')!.args[1] as { body: string }).body)
    expect(sent.listens.map((listen: { title: string }) => listen.title)).toEqual(['Blue in Green', 'So What'])
    expect(stored).toEqual([])
  })

  it("answers the settings page's button with a message for the person", async () => {
    status = 401
    const outcome = await listener('commands.register')(undefined, { userId: 'u1', source: 'settings' })
    expect(outcome).toEqual({ action: { type: 'toast', message: 'Tunelog did not accept the token.', tone: 'danger' } })
  })

  it('is the example SPEC.md shows, to the letter', () => {
    const spec = readFileSync(new URL('../SPEC.md', import.meta.url), 'utf8')
    for (const file of ['songstress.json', 'src/server.ts']) {
      const text = readFileSync(new URL(`../examples/tunelog/${file}`, import.meta.url), 'utf8')
      expect(spec.includes(text.trim()), `SPEC.md should show examples/tunelog/${file} as it is`).toBe(true)
    }
  })
})
