import { describe, expect, it } from 'vitest'
import { bestMatch, matchScore } from './match'

describe('matchScore and bestMatch', () => {
  const wanted = { title: 'Halo', artist: 'Beyoncé', album: 'I Am... Sasha Fierce', durationS: 261 }

  it('score an ISRC alone, else title 50, artist 30 and length 20, or the album without a length', () => {
    expect(matchScore({ ...wanted, isrc: 'usc10800337' }, { title: 'Other', artist: 'Else', isrc: 'USC10800337' })).toBe(100)
    expect(matchScore({ ...wanted, isrc: 'USC10800337' }, { ...wanted, isrc: 'GBX000000001' })).toBe(0)
    expect(matchScore(wanted, { title: 'Halo', artist: 'Beyonce', durationS: 262 })).toBe(100)
    expect(matchScore(wanted, { title: 'Halo', artist: 'Beyonce', durationS: 276 })).toBeCloseTo(90.7, 1)
    expect(matchScore({ title: 'Halo', artist: 'Beyoncé', album: 'Sasha Fierce' }, { title: 'Halo', artist: 'Beyoncé', album: 'I Am... Sasha Fierce' })).toBe(98)
    expect(matchScore({ title: 'Halo', artist: 'Beyoncé' }, { title: 'Halo', artist: 'Beyoncé' })).toBe(90)
  })

  it('take the best result of those that score at least min, the first of equals, and none below it', () => {
    const results = [
      { name: 'Halo', by: ['Haley Reinhart'], seconds: 230 },
      { name: 'Halo', by: ['Beyoncé'], seconds: 261 },
      { name: 'Halo', by: ['Beyoncé'], seconds: 261 },
    ]
    const read = (result: (typeof results)[number]) => ({ title: result.name, artist: result.by[0] ?? '', durationS: result.seconds })
    expect(bestMatch(wanted, results, read)).toBe(results[1])
    expect(bestMatch({ title: 'Single Ladies', artist: 'Beyoncé' }, results, read)).toBeNull()
    expect(bestMatch(wanted, results.slice(0, 1), read)).toBeNull()
    expect(bestMatch(wanted, results.slice(0, 1), read, 40)).toBe(results[0])
    expect(bestMatch(wanted, [], read)).toBeNull()
  })
})
