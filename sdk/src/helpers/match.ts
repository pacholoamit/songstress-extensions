// Finding one song among a source's results: the result whose title, artist
// and length are most like the song's, when it is like enough. A namesake
// is worse than nothing, so a weak best is no answer.

import { lengthLikeness, likeness } from './text'

/** A song as the matcher reads it: its tags. A `TrackQuery` is one. */
export interface MatchTags {
  /** The title. */
  title: string
  /** The artist's name: the main artist's, for a result that lists several. */
  artist: string
  /** The album's title, when known. */
  album?: string
  /** The length, in seconds, when known. */
  durationS?: number
  /** The ISRC, when known. */
  isrc?: string
}

/** How much a result is like the song wanted, from 0 to 100. The same ISRC
 * on both is 100 and two different ones 0, whatever else they say. Without
 * them, the title counts 50, the artist 30 and the length 20, or the album
 * instead of the length when either has no length, or 10 when neither can be
 * compared. Names are compared folded (`foldText`): one that holds the other
 * whole counts 90 %, any other by its spelling; a length within 2 seconds
 * counts whole, one 30 seconds off nothing.
 * @param wanted - The song wanted.
 * @param offered - A result, read as tags.
 * @returns The score, from 0 to 100.
 * @example
 * ```ts
 * import { matchScore } from 'songstress/server'
 *
 * matchScore(
 *   { title: 'Halo', artist: 'Beyoncé', durationS: 261 },
 *   { title: 'Halo', artist: 'Beyonce', durationS: 262 },
 * ) // 100
 * ```
 */
export function matchScore(wanted: MatchTags, offered: MatchTags): number {
  const isrc = wanted.isrc?.toUpperCase()
  if (isrc && offered.isrc) return isrc === offered.isrc.toUpperCase() ? 100 : 0
  let total = likeness(wanted.title, offered.title) * 50 + likeness(wanted.artist, offered.artist) * 30
  if (wanted.durationS && offered.durationS) total += lengthLikeness(wanted.durationS, offered.durationS) * 20
  else if (wanted.album && offered.album) total += likeness(wanted.album, offered.album) * 20
  else total += 10
  return total
}

/** The result most like the song wanted (`matchScore`), when it scores at
 * least `min`; null when none does. Of two that score the same, the first.
 * @param wanted - The song wanted: a provider's `TrackQuery` is one.
 * @param candidates - The source's results, in its order.
 * @param read - Reads a result as tags.
 * @param min - The least score that counts: 65 unless given.
 * @returns The best result, or null.
 * @example
 * ```ts
 * import { bestMatch, songstress, type CatalogTrack } from 'songstress/server'
 *
 * declare function searchTracks(text: string): Promise<CatalogTrack[]> // your source's search
 *
 * songstress.providers.lyrics.register('my-source', {
 *   async find(song) {
 *     const results = await searchTracks(`${song.artist} ${song.title}`)
 *     const found = bestMatch(song, results, (track) => ({ ...track, artist: track.artists[0] ?? '' }))
 *     if (!found) return { status: 'none' }
 *     return { status: 'found', synced: false, lines: [{ text: '…' }] } // the lyrics of `found`
 *   },
 * })
 * ```
 */
export function bestMatch<T>(wanted: MatchTags, candidates: readonly T[], read: (candidate: T) => MatchTags, min = 65): T | null {
  let found: T | null = null
  let top = -1
  for (const candidate of candidates) {
    const score = matchScore(wanted, read(candidate))
    if (score > top) {
      top = score
      found = candidate
    }
  }
  return top >= min ? found : null
}
