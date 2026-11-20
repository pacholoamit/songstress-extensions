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
    expect(built.validate(input, { profile })).toEqual(loaded.validate(input, { profile }))
  })

  it('reads a theme file and holds a look to the apps’ rules as the repository’s does', async () => {
    const [built, loaded] = await Promise.all([builtIn(), fromSources()])
    for (const file of ['{"dark": {"colors": {"accent": "#f5b556"}}}', '{"light": {}}', '{"dark": {"colors": {"text": "333"}}}']) {
      expect(built.readThemeFile(bytes(file), 'dark'), file).toEqual(loaded.readThemeFile(bytes(file), 'dark'))
    }
    for (const look of [{ seed: '#7fe0a0' }, { colors: { 'text.muted': '#333333', border: '#ffffff1a' } }]) {
      expect(built.checkLook('dark', look)).toEqual(loaded.checkLook('dark', look))
    }
    for (const look of [{ seed: 'hsl(141 61% 69%)' }, { colors: { border: 'rgb(255 255 255 / 10%)', accent: 'red' } }, 'dark']) {
      expect(built.normalizeLook(look)).toEqual(loaded.normalizeLook(look))
    }
  })

  it('refuses a profile there is none of, in the same words', async () => {
    const [built, loaded] = await Promise.all([builtIn(), fromSources()])
    expect(() => built.validate(EXAMPLE, { profile: 'lsiting' })).toThrow('unknown profile: lsiting')
    expect(() => loaded.validate(EXAMPLE, { profile: 'lsiting' })).toThrow('unknown profile: lsiting')
  })
})
