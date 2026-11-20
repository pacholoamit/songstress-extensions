import { describe, expect, it } from 'vitest'
import engines from '../../corpus/engines.json'
import { compareVersions, parseRange, parseVersion, satisfiesRange, type Version } from './semver'

// corpus/engines.json is the table every host's parser must pass: this file
// only holds this package's parser to it.

function version(text: string): Version {
  const parsed = parseVersion(text)
  if (!parsed) throw new Error(`${text} should be a version`)
  return parsed
}

describe('versions', () => {
  it.each(engines.versions.valid)('reads %s', (text) => {
    expect(parseVersion(text)).not.toBeNull()
  })

  it.each(engines.versions.invalid)('refuses "%s"', (text) => {
    expect(parseVersion(text)).toBeNull()
  })

  it('keeps the parts apart', () => {
    expect(parseVersion('1.2.3-beta.4+exp.sha')).toEqual({
      major: 1,
      minor: 2,
      patch: 3,
      prerelease: ['beta', '4'],
      build: 'exp.sha',
    })
  })

  it('refuses text too long to be a version before reading it', () => {
    expect(parseVersion(`1.0.0-${'a'.repeat(300)}`)).toBeNull()
    expect(parseRange(`^1.0.0-${'a'.repeat(300)}`)).toBeNull()
  })
})

describe('order', () => {
  const ascending = engines.order.ascending.map(version)

  it('ranks every version of the list above the ones before it', () => {
    ascending.forEach((later, index) => {
      for (const earlier of ascending.slice(0, index)) {
        expect(compareVersions(earlier, later)).toBe(-1)
        expect(compareVersions(later, earlier)).toBe(1)
      }
    })
  })

  it.each(engines.order.equal)('ranks %s and %s the same', (a, b) => {
    expect(compareVersions(version(a), version(b))).toBe(0)
  })
})

describe('ranges', () => {
  it.each(engines.ranges.invalid)('refuses "%s"', (text) => {
    expect(parseRange(text)).toBeNull()
  })

  it.each(engines.ranges.cases)('$range and $version: $satisfies', ({ range, version: text, satisfies }) => {
    const parsed = parseRange(range)
    expect(parsed).not.toBeNull()
    expect(satisfiesRange(version(text), parsed!)).toBe(satisfies)
  })
})
