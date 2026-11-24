import { afterEach, describe, expect, it } from 'vitest'
import type { CatalogTrack, ProviderContext, SearchQuery } from '../api/providers'
import { createMockHost, type MockHost } from '../testing/host'
import { registerCatalog } from './catalog'

let host: MockHost | undefined
afterEach(() => host?.remove())

const context: ProviderContext = {}
const query: SearchQuery = { text: 'halo', types: ['track'], limit: 10, offset: 0 }
const HALO: CatalogTrack = { id: '9', title: 'Halo', artists: ['Beyoncé'] }

describe('registerCatalog', () => {
  it('registers the search, a lookup of the types it opens, and the links, under one id', async () => {
    const mock = (host = createMockHost({ manifest: { permissions: { providers: {} } } }))
    registerCatalog('example', {
      search: () => ({ tracks: [HALO] }),
      track: (id) => (id === '9' ? HALO : null),
      album: () => null,
      resolve: (url) => (url.endsWith('/track/9') ? { type: 'track', track: HALO } : null),
    })
    expect(mock.calls.map((call) => [call.member, call.args[0]])).toEqual([
      ['providers.search.register', 'example'],
      ['providers.lookup.register', 'example'],
      ['providers.links.register', 'example'],
    ])
    expect(await mock.provider('search', 'example').search(query, context)).toEqual({ tracks: [HALO] })
    const lookup = mock.provider('lookup', 'example')
    expect(Object.keys(lookup).sort()).toEqual(['album', 'track'])
    expect(await lookup.track!('9', context)).toEqual(HALO)
    expect(await mock.provider('links', 'example').resolve('https://example.com/track/9', context)).toEqual({ type: 'track', track: HALO })
  })

  it('registers no lookup without a type to open, and no links without resolve', () => {
    const mock = (host = createMockHost())
    registerCatalog('search-only', { search: () => ({}) })
    expect(mock.calls.map((call) => call.member)).toEqual(['providers.search.register'])
  })

  it("calls each method on the catalogue itself, and takes all three back at once", async () => {
    const mock = (host = createMockHost())
    class Example {
      readonly prefix = 'https://example.com/track/'
      search() {
        return { tracks: [HALO] }
      }
      track(id: string) {
        return id === HALO.id ? HALO : null
      }
      resolve(url: string, at: ProviderContext) {
        const track = url.startsWith(this.prefix) ? this.track(url.slice(this.prefix.length)) : null
        return track && at ? { type: 'track' as const, track } : null
      }
    }
    const registered = registerCatalog('example', new Example())
    expect(await mock.provider('links', 'example').resolve('https://example.com/track/9', context)).toEqual({ type: 'track', track: HALO })
    registered.dispose()
    expect(() => mock.provider('search', 'example')).toThrow('Nothing is registered')
    expect(() => mock.provider('lookup', 'example')).toThrow('Nothing is registered')
    expect(() => mock.provider('links', 'example')).toThrow('Nothing is registered')
  })
})
