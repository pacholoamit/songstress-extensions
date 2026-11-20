import { afterEach, describe, expect, it, vi } from 'vitest'
import manifest from '../examples/tunelog/songstress.json'
import type { PlayEvent, ScrobbleEvent, Song } from './api/index'
import { songstress as client } from './client'
import { validateManifest } from './manifest/validate'
import { songstress as server } from './server'
import { createMockHost, type MockHost } from './testing'

// The test kit an extension's author gets: held here to what a real host
// does, with the example of SPEC.md as the extension under test.

const SONG: Song = { id: 's1', title: 'Blue in Green', artist: 'Miles Davis', album: 'Kind of Blue', durationS: 337 }
const PLAY: PlayEvent & ScrobbleEvent = { userId: 'u1', startedAt: '2026-11-20T08:00:00Z', playedAt: '2026-11-20T08:00:00Z' }

let host: MockHost | undefined

afterEach(() => {
  host?.remove()
  host = undefined
})

/** The example's server entry, loaded afresh into `made`. */
async function tunelog(made: MockHost): Promise<MockHost> {
  host = made
  vi.resetModules()
  await import('../examples/tunelog/src/server')
  return made
}

describe('an entry under the mock host', () => {
  it('is called as Songstress calls it: a hook, then a command', async () => {
    const made = await tunelog(
      createMockHost({ manifest, settings: { token: (userId) => (userId === 'u1' ? 'tl-token' : undefined) }, fetch: () => ({ status: 200 }) }),
    )
    await made.emit('onScrobble', SONG, PLAY)
    expect(made.requests.map((sent) => sent.url)).toEqual(['https://api.tunelog.example/v1/listens'])
    expect(made.requests[0]!.request.headers).toMatchObject({ authorization: 'Bearer tl-token' })
    expect(await made.run('test-connection', undefined, { userId: 'u1' })).toEqual({
      action: { type: 'toast', message: 'Tunelog is connected.', tone: 'success' },
    })
    // A member with no token is told so, and nothing is sent for them.
    expect(await made.run('test-connection')).toMatchObject({ action: { tone: 'danger' } })
    expect(made.requests).toHaveLength(2)
  })

  it('keeps what the entry stores, each member apart, as the JSON it would become', async () => {
    const made = await tunelog(createMockHost({ manifest, settings: { token: 'tl-token' }, fetch: () => ({ status: 503 }) }))
    await made.emit('onScrobble', SONG, PLAY)
    expect(await server.storage.get('waiting', { userId: 'u1' })).toEqual([
      { title: 'Blue in Green', artist: 'Miles Davis', album: 'Kind of Blue', playedAt: PLAY.playedAt },
    ])
    expect(await server.storage.get('waiting', { userId: 'u2' })).toBeUndefined()
    expect(await server.storage.keys('wait', { userId: 'u1' })).toEqual(['waiting'])
    await expect(server.storage.set('bad', () => 1)).rejects.toMatchObject({ code: 'invalid' })
    const held = { at: new Date(0) }
    await server.storage.set('held', held)
    expect(await server.storage.get('held')).toEqual({ at: '1970-01-01T00:00:00.000Z' })
    // What is read is a copy: changing it changes nothing kept, as on a real host.
    const read = (await server.storage.get<{ at: string; more?: number }>('held'))!
    read.more = 1
    expect(await server.storage.get('held')).toEqual({ at: '1970-01-01T00:00:00.000Z' })
  })

  it('hands back what was registered, and forgets what was disposed', async () => {
    host = createMockHost()
    const find = () => ({ status: 'none' as const })
    const lyrics = server.providers.lyrics.register('words', { find })
    const job = server.jobs.register('sync', () => undefined)
    expect(host.provider('lyrics', 'words').find).toBe(find)
    expect(host.registered('jobs.register', 'sync')).toBeTypeOf('function')
    lyrics.dispose()
    lyrics.dispose()
    expect(() => host!.provider('lyrics', 'words')).toThrow(/Nothing is registered with songstress.providers.lyrics.register under "words"/)
    job.dispose()
    await expect(host.emit('onPlay', SONG, PLAY)).rejects.toThrow(/Nothing listens to onPlay/)
  })

  it('answers what it is told to, in place of its own answers too', async () => {
    host = createMockHost({
      answers: { 'library.getSong': (id: string) => ({ ...SONG, id }), 'storage.get': () => 'always this' },
    })
    expect(await server.library.getSong('s9')).toMatchObject({ id: 's9' })
    expect(await server.storage.get('anything')).toBe('always this')
    await expect(server.users.list()).rejects.toMatchObject({ code: 'not-available', message: expect.stringContaining("answers: { 'users.list'") })
    expect(await server.host.info()).toMatchObject({ side: 'server', extension: { id: 'mock.extension' } })
    expect(host.calls.map((call) => call.member)).toEqual(['library.getSong', 'storage.get', 'users.list', 'host.info'])
  })
})

describe('the mock host with a manifest', () => {
  it('refuses a call whose permission the manifest does not ask for', async () => {
    host = createMockHost({ manifest })
    await expect(server.secrets.get('token')).rejects.toMatchObject({
      code: 'permission-denied',
      message: 'secrets.get needs the permission "secrets", which the manifest does not ask for.',
    })
    // A registration is refused at once, as on a real host.
    expect(() => server.jobs.register('sync', () => undefined)).toThrow(/needs the permission "jobs"/)
    await expect(server.storage.get('waiting')).resolves.toBeUndefined()
    expect((await server.host.info()).extension).toEqual({ id: 'acme.tunelog', version: '1.2.0' })
  })

  it('takes the manifest as the validator answers it, as well as the file as imported', async () => {
    const answered = validateManifest(manifest, { profile: 'install' })
    if (!answered.valid) throw new Error('the example is valid')
    host = createMockHost({ manifest: answered.manifest })
    await expect(server.users.list()).rejects.toMatchObject({ code: 'permission-denied' })
  })

  it('lets a request go only to the hosts the manifest names', async () => {
    const hosts = ['api.tunelog.example', '*.cdn.example', 'radio.example:8443', 'secure.example:443', '93.184.216.34']
    host = createMockHost({ manifest: { permissions: { network: { reason: 'Reach them.', hosts } } }, fetch: () => ({}) })
    const reach = (url: string) => server.net.fetch(url).then((answer) => answer.status)
    const taken = [
      'https://api.tunelog.example/v1/me',
      'http://api.tunelog.example/v1/me',
      'https://API.Tunelog.Example:443/',
      'http://api.tunelog.example:80/',
      'https://a.b.cdn.example/x.jpg',
      'http://radio.example:8443/stream',
      // A pattern that names the scheme's own port takes an address that leaves it out.
      'https://secure.example/',
    ]
    for (const url of taken) await expect(reach(url), url).resolves.toBe(200)
    const refused = [
      // The domain itself is not a name under it.
      'https://cdn.example/',
      // A pattern with a port takes that port alone; one without, the scheme's own alone.
      'https://radio.example/',
      'https://api.tunelog.example:8443/',
      'http://api.tunelog.example:443/',
      'https://api.tunelog.example:80/',
      'http://secure.example/',
      'https://user@elsewhere.example/',
      // An address is never a named host, and nothing but http and https leaves.
      'https://93.184.216.34/',
      'ftp://api.tunelog.example/',
      'no address',
    ]
    for (const url of refused) await expect(reach(url), url).rejects.toMatchObject({ code: 'permission-denied' })
    await expect(reach('https://elsewhere.example/')).rejects.toThrow(/A request to elsewhere.example is refused/)
    expect(host.requests).toHaveLength(taken.length + refused.length + 1)
  })

  it('cannot tell what is on your network, so lets a request go once network.local is asked for', async () => {
    host = createMockHost({ manifest: { permissions: { 'network.local': { reason: 'Reach the player in the hall.' } } }, fetch: () => ({ body: 'ok' }) })
    expect(await server.net.fetch('http://192.168.1.20:9000/status')).toEqual({ status: 200, url: 'http://192.168.1.20:9000/status', headers: {}, body: 'ok' })
  })

  it('says so when no network was given, and when a hook is not listed', async () => {
    host = createMockHost({ manifest: { ...manifest, hooks: { server: ['onScrobble'] } } })
    await expect(server.net.fetch('https://api.tunelog.example/')).rejects.toMatchObject({ code: 'failed', message: expect.stringContaining('has no network') })
    server.hooks.onPlay(() => undefined)
    await expect(host.emit('onPlay', SONG, PLAY)).rejects.toThrow('The manifest does not list onPlay under hooks.server')
  })
})

describe('the client entry under the mock host', () => {
  it('has its own members, runs its own commands, and lacks the server’s', async () => {
    host = createMockHost({ side: 'client', answers: { 'player.getState': () => ({ song: null, playing: false, positionS: 0, durationS: 0, volume: 1 }) } })
    client.commands.register('double', (input: number) => ({ value: input * 2 }))
    expect(await client.commands.execute('double', 21)).toBe(42)
    expect((await client.player.getState()).playing).toBe(false)
    const heard: number[] = []
    client.hooks.onVolumeChange((volume) => void heard.push(volume))
    await host.emit('onVolumeChange', 0.5)
    expect(heard).toEqual([0.5])
    await expect(server.secrets.get('token')).rejects.toMatchObject({ code: 'not-available', message: "secrets.get is not in the client entry's API." })
  })

  it('is gone once removed, and a later one takes its place', () => {
    const first = createMockHost()
    host = createMockHost()
    first.remove()
    expect(() => server.commands.register('still', () => undefined)).not.toThrow()
    host.remove()
    expect(() => server.commands.register('gone', () => undefined)).toThrow(/no host/)
  })
})
