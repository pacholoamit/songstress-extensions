import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { loadBuiltValidator as builtIn } from './validator.built.ts'
import { loadValidator as fromSources } from './validator.ts'

// The published command reads manifests with validator.built.ts, the
// repository's with validator.ts (scripts/build.ts swaps the one for the
// other). The two must answer every manifest alike.

const bytes = (text: string) => new TextEncoder().encode(text)
const EXAMPLE = readFileSync(new URL('../../examples/tunelog/songstress.json', import.meta.url))

const CASES: readonly (readonly [what: string, input: Uint8Array, profile: string])[] = [
  ['the example', EXAMPLE, 'install'],
  ['the example, held to a listing', EXAMPLE, 'listing'],
  ['a manifest with nothing but its version', bytes('{"manifestVersion": 1}'), 'install'],
  ['bytes that are not JSON', bytes('{"id": '), 'install'],
]

describe('the validator the published command carries', () => {
  it.each(CASES)('answers %s as the repository’s does', async (_what, input, profile) => {
    const [built, loaded] = await Promise.all([builtIn(), fromSources()])
    expect(built(input, { profile })).toEqual(loaded(input, { profile }))
  })

  it('refuses a profile there is none of, in the same words', async () => {
    const [built, loaded] = await Promise.all([builtIn(), fromSources()])
    expect(() => built(EXAMPLE, { profile: 'lsiting' })).toThrow('unknown profile: lsiting')
    expect(() => loaded(EXAMPLE, { profile: 'lsiting' })).toThrow('unknown profile: lsiting')
  })
})
