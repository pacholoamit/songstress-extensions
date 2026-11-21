// Finding one song among a source's results: the result whose title,
// artist and length are most like the song's, when it is like enough. A
// namesake is worse than nothing, so a weak best is no answer.

import { lengthLikeness, likeness } from './text'

/** What a song is asked for by: its tags. */
export interface Wanted {
  title: string
  artist: string
  album?: string
  durationS?: number
  isrc?: string
}

/** A candidate as the score reads it. */
export interface Offered {
  title: string
  artist: string
  album?: string
  durationS?: number
  isrc?: string
}

/** A score from 0 to 100: the title counts 50, the artist 30, the length
 * 20 (or the album, without a length). The same ISRC is 100. */
export function score(wanted: Wanted, offered: Offered): number {
  const isrc = wanted.isrc?.toUpperCase()
  if (isrc && offered.isrc) return isrc === offered.isrc.toUpperCase() ? 100 : 0
  let total = likeness(wanted.title, offered.title) * 50 + likeness(wanted.artist, offered.artist) * 30
  if (wanted.durationS && offered.durationS) total += lengthLikeness(wanted.durationS, offered.durationS) * 20
  else if (wanted.album && offered.album) total += likeness(wanted.album, offered.album) * 20
  else total += 10
  return total
}

/** The candidate that scores best, when it scores at least min. */
export function best<T>(candidates: readonly T[], read: (candidate: T) => Offered, wanted: Wanted, min = 65): T | null {
  let found: T | null = null
  let top = -1
  for (const candidate of candidates) {
    const s = score(wanted, read(candidate))
    if (s > top) {
      top = s
      found = candidate
    }
  }
  return top >= min ? found : null
}
