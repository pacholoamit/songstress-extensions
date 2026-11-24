// A catalogue source's providers, registered in one call: its search, its
// lookups by id, and the links it reads, under one id. The rest of what a
// source offers (lyrics, metadata, play, download) it registers itself.

import type { Disposable } from '../api/common'
import type { LinkProvider, LookupProvider, SearchProvider } from '../api/providers'
import { serverApi as songstress } from '../host'

/** A catalogue source as one object: its search, a lookup for each type it
 * opens by id, and, when its manifest declares `links`, the links it reads.
 * Each method is what the provider of its kind answers (SPEC.md, section 11). */
export interface CatalogProvider extends SearchProvider, LookupProvider, Partial<LinkProvider> {}

const LOOKUPS = ['track', 'album', 'artist', 'playlist'] as const

/** Registers a catalogue source's `search`, `lookup` and `links` providers
 * under one id, as its manifest declares them under
 * `contributes.providers`: the search always, a lookup with the methods the
 * catalogue has of `track`, `album`, `artist` and `playlist` (none of them,
 * no lookup), and the links when it has `resolve`. Its methods are called
 * on the catalogue itself, so one written as a class keeps its `this`.
 * @param id - The source's id, as the manifest declares it under each kind.
 * @param catalog - The catalogue's methods.
 * @returns What takes all of them back at once.
 * @example
 * ```ts
 * import { fetchJson, nullIfMissing, queryString, registerCatalog, type CatalogTrack } from 'songstress/server'
 *
 * const API = 'https://api.example.com'
 *
 * registerCatalog('example', {
 *   async search(query) {
 *     const tracks = await fetchJson<CatalogTrack[]>(`${API}/search?${queryString({ q: query.text, limit: query.limit })}`)
 *     return { tracks }
 *   },
 *   track: (id) => nullIfMissing(() => fetchJson<CatalogTrack>(`${API}/tracks/${encodeURIComponent(id)}`)),
 *   async resolve(url, context) {
 *     const id = /example\.com\/track\/(\d+)/.exec(url)?.[1]
 *     const track = id ? await this.track?.(id, context) : null
 *     return track ? { type: 'track', track } : null
 *   },
 * })
 * ```
 */
export function registerCatalog(id: string, catalog: CatalogProvider): Disposable {
  const registered = [songstress.providers.search.register(id, { search: (query, context) => catalog.search(query, context) })]
  const lookup: Record<string, unknown> = {}
  for (const type of LOOKUPS) {
    const open = catalog[type]
    if (open) lookup[type] = open.bind(catalog)
  }
  if (Object.keys(lookup).length > 0) registered.push(songstress.providers.lookup.register(id, lookup as LookupProvider))
  const { resolve } = catalog
  if (resolve) registered.push(songstress.providers.links.register(id, { resolve: resolve.bind(catalog) }))
  return {
    dispose() {
      for (const one of registered) one.dispose()
    },
  }
}
