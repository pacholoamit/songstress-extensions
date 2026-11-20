import { describe, expect, it } from 'vitest'
import { pairs, validManifests } from '../test/corpus'
import { isPlainPath } from './rules/files'
import { LISTING_LICENSES } from './rules/listing'
import { HOOK_PERMISSIONS } from './rules/permissions'
import { UNSAFE_CODE_POINTS } from './unsafe'
import { CLIENT_HOOKS, PERMISSIONS, SERVER_HOOKS } from './schema'
import { parseManifest, validateManifest, type ValidateOptions } from './validate'

// The corpus pins what each rule reports. These are the edges it has no
// file for.

const minimal = () => structuredClone(validManifests().find(({ file }) => file === 'valid/minimal.json')!.value) as Record<string, unknown>

const found = (change: Record<string, unknown>, options?: ValidateOptions) =>
  pairs(validateManifest({ ...minimal(), ...change }, options).issues)

describe('paths', () => {
  it.each(['a.png', 'assets/icon.png', 'a/b/c/d/e.png', 'My Icon.v2.png', '.hidden/a.png', 'a/..b/c.png', ' lead/a.png', '~/a.png'])(
    'takes %s',
    (path) => expect(isPlainPath(path)).toBe(true),
  )

  it.each(['', '/', '/a.png', 'a/', 'a//b.png', '.', '..', './a.png', '../a.png', 'a/../b.png', 'a/./b.png', 'a./b.png', 'a /b.png', 'a\\b.png', 'C:/a.png', 'a.png:stream', 'a*.png', 'a?.png', 'a%20b.png', 'a#b.png', '"a".png', '<a>.png', 'a|b.png'])(
    'refuses "%s"',
    (path) => expect(isPlainPath(path)).toBe(false),
  )
})

describe('hooks and their permissions', () => {
  it('names every hook of the schema, and only those', () => {
    expect(Object.keys(HOOK_PERMISSIONS.server).sort()).toEqual([...SERVER_HOOKS].sort())
    expect(Object.keys(HOOK_PERMISSIONS.client).sort()).toEqual([...CLIENT_HOOKS].sort())
  })

  it('asks only for permissions the schema has', () => {
    const asked = [...Object.values(HOOK_PERMISSIONS.server), ...Object.values(HOOK_PERMISSIONS.client)]
    expect(asked.filter((name) => name !== null && !PERMISSIONS.includes(name))).toEqual([])
  })
})

describe('unsafe characters', () => {
  it('are listed as ranges in order, none overlapping', () => {
    const flat = UNSAFE_CODE_POINTS.flat()
    expect(flat).toEqual([...flat].sort((a, b) => a - b))
  })

  it.each([0x200c, 0x200d, 0x200e, 0x200f, 0x061c, 0x00a0, 0x180b, 0x180e, 0x180f, 0xfe00, 0xfe0f, 0xe0100, 0xe01ef, 0x1f3b5, 0x0020, 0x007e])(
    'leave U+%s alone',
    (point) => expect(found({ name: `a${String.fromCodePoint(point)}b` })).toEqual([]),
  )

  it.each(UNSAFE_CODE_POINTS.flat())('refuse the edge U+%s of a range', (point) => {
    expect(found({ name: `a${String.fromCodePoint(point)}b` })).toEqual(['TEXT_UNSAFE /name'])
  })

  it('look inside the address of the schema too', () => {
    expect(found({ $schema: `https://example.com/${String.fromCodePoint(0x202e)}` })).toEqual(['TEXT_UNSAFE /$schema'])
  })

  it('are written by name in every sentence that quotes them', () => {
    const override = String.fromCodePoint(0x202e)
    const quoting = [
      validateManifest({ ...minimal(), version: `1.0.0${override}` }),
      validateManifest({ ...minimal(), id: `acme${override}.x` }),
      parseManifest(`{"a${override}": 1, "a${override}": 2}`),
    ]
    const messages = quoting.flatMap((result) => result.issues.map((issue) => issue.message))
    expect(messages.length).toBeGreaterThan(3)
    expect(messages.filter((message) => message.includes(override))).toEqual([])
    expect(messages.filter((message) => message.includes('<U+202E>')).length).toBeGreaterThan(1)
  })
})

describe('a manifest that is not JSON', () => {
  it("is told where it broke, in the parser's own words", () => {
    const [problem] = parseManifest('{"name": "a",\n "id": }').issues
    expect(problem.code).toBe('JSON_INVALID')
    expect(problem.message).toMatch(/^The manifest is not JSON: .+\.$/)
  })
})

describe('the host that checks', () => {
  it.each([
    ['^0.1.0', '0.1.0', []],
    ['^0.1.0', '0.1.9', []],
    ['^0.1.0', '0.2.0', ['ENGINE_UNSUPPORTED /engines/songstress']],
    ['>=0.1.0', '7.0.0', []],
    ['>=1.0.0 <2.0.0', '0.9.0', ['ENGINE_UNSUPPORTED /engines/songstress']],
    ['0.1.0', '0.1.0+build', []],
    ['nonsense', '0.1.0', ['ENGINE_RANGE_INVALID /engines/songstress']],
  ])('asked for %s, a host with API %s', (songstress, apiVersion, expected) => {
    expect(found({ engines: { songstress } }, { apiVersion })).toEqual(expected)
  })

  it('is not asked about when it does not say what it has', () => {
    expect(found({ engines: { songstress: '^99.0.0' } })).toEqual([])
  })
})

describe('the official list', () => {
  it('accepts each licence of its list, and no other', () => {
    for (const license of LISTING_LICENSES) {
      expect(found({ license }, { profile: 'listing' })).not.toContain('LISTING_LICENSE /license')
    }
    expect(found({ license: 'mit' }, { profile: 'listing' })).toContain('LISTING_LICENSE /license')
  })

  it.each([
    'https://github.com/acme/thing',
    'https://github.com/a/b',
    'https://github.com/Acme-Org/thing.js',
  ])('takes the repository %s', (repository) => {
    expect(found({ repository }, { profile: 'listing' })).not.toContain('LISTING_REPOSITORY /repository')
  })

  it.each([
    'https://github.com/acme',
    'https://github.com/acme/thing/',
    'https://github.com/acme/thing/issues',
    'https://github.com/-acme/thing',
    'https://gitlab.com/acme/thing',
    'https://github.com.evil.example/acme/thing',
    'https://example.com/github.com/acme/thing',
  ])('refuses the repository %s', (repository) => {
    expect(found({ repository }, { profile: 'listing' })).toContain('LISTING_REPOSITORY /repository')
  })
})

describe('a caller who asks wrongly', () => {
  it.each([
    [{ profile: 'store' }, /unknown profile: store/],
    [{ apiVersion: 'latest' }, /apiVersion is not a semantic version: latest/],
  ])('is told so at once: %o', (options, message) => {
    expect(() => validateManifest(minimal(), options as ValidateOptions)).toThrow(message)
    expect(() => parseManifest('not even JSON', options as ValidateOptions)).toThrow(message)
  })

  it.each([
    ['an ArrayBuffer', new TextEncoder().encode('{}').buffer],
    ['a parsed manifest', { manifestVersion: 1 }],
    ['nothing', undefined],
  ])('is told so at once when the manifest is handed over as %s', (_name, input) => {
    expect(() => parseManifest(input as unknown as string)).toThrow(TypeError)
  })
})

describe('a manifest that passes', () => {
  it('comes back as the value that went in, typed', () => {
    const value = minimal()
    const result = validateManifest(value)
    expect(result.valid && result.manifest).toBe(value)
  })

  it('is not changed by being checked', () => {
    for (const { value } of validManifests()) {
      const before = JSON.stringify(value)
      validateManifest(value, { profile: 'listing', apiVersion: '0.1.0' })
      expect(JSON.stringify(value)).toBe(before)
    }
  })
})
