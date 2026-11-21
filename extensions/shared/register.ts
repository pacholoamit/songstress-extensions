// A catalogue source's providers, registered in one call: its search, the
// lookups by id it has (one per kind it opens), and its links. Each port
// registers the rest (lyrics, metadata, play, download) itself.

import { songstress, type CatalogAlbumDetail, type CatalogArtistDetail, type CatalogPlaylistDetail, type CatalogTrack, type LinkResult, type SearchResults } from 'songstress/server'

export interface Catalog {
  search(text: string, types: readonly string[], limit: number, offset: number): Promise<SearchResults>
  track(id: string): Promise<CatalogTrack | null>
  album?(id: string): Promise<CatalogAlbumDetail | null>
  playlist?(id: string): Promise<CatalogPlaylistDetail | null>
  artist?(id: string): Promise<CatalogArtistDetail | null>
  resolve(url: string): Promise<LinkResult | null>
}

export function registerCatalog(source: string, catalog: Catalog): void {
  songstress.providers.search.register(source, { search: (q) => catalog.search(q.text, q.types, q.limit, q.offset) })
  const lookups: Record<string, (id: string) => Promise<unknown>> = { track: (id) => catalog.track(id) }
  if (catalog.album) lookups.album = (id) => catalog.album!(id)
  if (catalog.playlist) lookups.playlist = (id) => catalog.playlist!(id)
  if (catalog.artist) lookups.artist = (id) => catalog.artist!(id)
  songstress.providers.lookup.register(source, lookups)
  songstress.providers.links.register(source, { resolve: (url) => catalog.resolve(url) })
}

/** A value, or undefined when it is empty: "", 0, NaN. */
export function some<T>(value: T | '' | 0 | null | undefined): T | undefined {
  return value === '' || value === 0 || value === null || value === undefined || (typeof value === 'number' && Number.isNaN(value)) ? undefined : value
}

/** The first of the values that is not empty. */
export function firstOf<T>(...values: (T | '' | 0 | null | undefined)[]): T | undefined {
  for (const value of values) {
    const found = some(value)
    if (found !== undefined) return found
  }
  return undefined
}
