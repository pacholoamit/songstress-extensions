import { describe, expect, it } from 'vitest'
import { bytesOf, CASES, pairs, validManifests } from '../test/corpus'
import { oraclePairs } from '../test/oracle'
import { mangle, seeded } from '../test/random'
import { isRecord, type SchemaNode } from './json'
import { PATTERNS } from './patterns.generated'
import { MANIFEST_SCHEMA, MANIFEST_SCHEMA_ID } from './schema'
import { APPLYING_KEYWORDS, checkStructure, KEYWORD_CODES } from './structure'
import { parseManifest, validateManifest } from './validate'

/** Every schema object inside the manifest's schema, with where it is. */
function nodes(node: unknown, at = '#', found: [string, SchemaNode][] = []): [string, SchemaNode][] {
  if (Array.isArray(node)) node.forEach((item, index) => nodes(item, `${at}/${index}`, found))
  if (!isRecord(node)) return found
  found.push([at, node])
  for (const key of ['properties', '$defs']) {
    if (isRecord(node[key])) Object.entries(node[key]).forEach(([name, child]) => nodes(child, `${at}/${key}/${name}`, found))
  }
  for (const key of ['items', 'if', 'then', 'allOf']) nodes(node[key], `${at}/${key}`, found)
  return found
}

const ALL = nodes(MANIFEST_SCHEMA)
const ANNOTATIONS = ['$schema', '$id', '$defs', 'title', 'description', 'then']

describe('the schema', () => {
  it('is draft 2020-12 at a versioned address', () => {
    expect(MANIFEST_SCHEMA.$schema).toBe('https://json-schema.org/draft/2020-12/schema')
    expect(MANIFEST_SCHEMA_ID).toBe('https://songstress.app/schema/extension/v1.json')
  })

  it('cannot be changed by a caller, nor its lists', () => {
    expect(ALL.filter(([, node]) => !Object.isFrozen(node)).map(([at]) => at)).toEqual([])
    expect(ALL.filter(([, node]) => Array.isArray(node.enum) && !Object.isFrozen(node.enum)).map(([at]) => at)).toEqual([])
  })

  it('uses only keywords the reader knows', () => {
    const known = new Set([...Object.keys(KEYWORD_CODES), ...APPLYING_KEYWORDS, ...ANNOTATIONS])
    const unknown = ALL.flatMap(([at, node]) => Object.keys(node).filter((key) => !known.has(key)).map((key) => `${at}: ${key}`))
    expect(unknown).toEqual([])
  })

  it('closes every object', () => {
    // The one exception is the setting, whose shape is one of five closed ones.
    const open = ALL.filter(([, node]) => isRecord(node.properties) && node.additionalProperties !== false && !node.allOf)
    expect(open.map(([at]) => at).filter((at) => !at.includes('/if'))).toEqual([])
  })

  it('bounds every list, and a list of distinct choices by the number of choices', () => {
    const lists = ALL.filter(([, node]) => node.type === 'array')
    expect(lists.filter(([, node]) => typeof node.maxItems !== 'number').map(([at]) => at)).toEqual([])
    const choices = (items: SchemaNode) => {
      const target = typeof items.$ref === 'string' ? (MANIFEST_SCHEMA.$defs as Record<string, SchemaNode>)[items.$ref.replace('#/$defs/', '')] : items
      return Array.isArray(target.enum) ? target.enum.length : null
    }
    const loose = lists.filter(([, node]) => {
      const count = choices(node.items as SchemaNode)
      return count !== null && node.uniqueItems === true && node.maxItems !== count
    })
    expect(loose.map(([at]) => at)).toEqual([])
  })

  it('says a thing once: no type beside an enum or a const, which would report one mistake twice', () => {
    const doubled = ALL.filter(([, node]) => 'type' in node && ('enum' in node || 'const' in node))
    expect(doubled.map(([at]) => at)).toEqual([])
  })

  it('keeps enums and consts to text, numbers and booleans, which compare the same in every language', () => {
    const values = ALL.flatMap(([, node]) => [...((node.enum as unknown[]) ?? []), ...('const' in node ? [node.const] : [])])
    expect(values.filter((value) => !['string', 'number', 'boolean'].includes(typeof value))).toEqual([])
  })

  it('describes every field in words', () => {
    const silent = ALL.filter(([at, node]) => /\/properties\/[^/]+$/.test(at) && !node.description && !node.$ref && !('const' in node))
    expect(silent.map(([at]) => at).filter((at) => !at.endsWith('/type'))).toEqual([])
  })

  it('writes patterns that JavaScript and RE2 (Go) both read', () => {
    // No lookaround, no backreference, no named group, and no class shorthand
    // whose meaning differs between the two (\s, \w, \d, \b).
    const beyond = /\(\?[=!<]|\\[1-9]|\(\?P?<|\\[swdbSWDB]/
    const used = ALL.map(([, node]) => node.pattern).filter((pattern) => typeof pattern === 'string')
    expect(used.length).toBeGreaterThan(10)
    expect(used.filter((pattern) => beyond.test(pattern))).toEqual([])
  })

  it('has a literal for every pattern, which says what the pattern says', () => {
    for (const [, node] of ALL) {
      if (typeof node.pattern !== 'string') continue
      expect(node.pattern).not.toContain('\\/')
      expect(PATTERNS.get(node.pattern)?.source.replaceAll('\\/', '/')).toBe(node.pattern)
      expect(PATTERNS.get(node.pattern)?.flags).toBe('u')
    }
  })
})

/** The fuzz rounds below compare two validators on 1,500 copies of each valid
 * manifest. The largest takes about 2 s alone but 7 s in the pre-commit hook,
 * where turbo runs every package's suite at once on a loaded machine, past
 * vitest's 5 s default. The work is the point of the test, so it gets room
 * rather than fewer rounds. */
const FUZZ_TIMEOUT_MS = 30_000

describe('the reader against the reference validator', () => {
  it('agrees on every file of the corpus that is JSON', () => {
    for (const file of new Set(CASES.map((entry) => entry.file))) {
      let value: unknown
      try {
        value = JSON.parse(new TextDecoder().decode(bytesOf(file)))
      } catch {
        continue
      }
      expect(pairs(checkStructure(MANIFEST_SCHEMA, value)), file).toEqual(oraclePairs(value))
    }
  })

  it.each(validManifests())('agrees on 1,500 mangled copies of $file, and never throws', ({ file, value }) => {
    const random = seeded(file.length * 7919)
    let [refused, crashes] = [0, 0]
    for (let round = 0; round < 1500; round += 1) {
      const mangled = mangle(value, random)
      const ours = pairs(checkStructure(MANIFEST_SCHEMA, mangled))
      const theirs = oraclePairs(mangled)
      if (theirs === null) crashes += 1
      else expect(ours, JSON.stringify(mangled)).toEqual(theirs)
      // The rules run on whatever the schema lets through, and must take it.
      const result = validateManifest(mangled, { profile: 'listing', apiVersion: '0.1.0' })
      expect(result.valid).toBe(result.issues.length === 0)
      refused += ours.length > 0 ? 1 : 0
    }
    // The manglers do mangle: most copies no longer have the schema's shape.
    expect(refused).toBeGreaterThan(500)
    // The reference validator itself gives up on a few (oracle.ts says which).
    expect(crashes).toBeLessThan(75)
  }, FUZZ_TIMEOUT_MS)

  it('reads the manifest that makes the reference validator throw', () => {
    const item = () => JSON.parse('{ "command": "share", "toString": 1 }') as unknown
    const menus = { 'song/context': [item(), item()] }
    const value = { ...(validManifests()[0].value as object), contributes: { menus } }
    expect(oraclePairs(value)).toBeNull()
    expect(pairs(checkStructure(MANIFEST_SCHEMA, value))).toEqual([
      'SCHEMA_DUPLICATE_ITEM /contributes/menus/song~1context',
      'SCHEMA_UNKNOWN_PROPERTY /contributes/menus/song~1context/0/toString',
      'SCHEMA_UNKNOWN_PROPERTY /contributes/menus/song~1context/1/toString',
    ])
  })

  it.each([null, undefined, 0, 'text', [], [[]], true, () => 1, Symbol('x'), new Date(0), new Map()])(
    'takes %s for a manifest without throwing',
    (value) => {
      expect(validateManifest(value).valid).toBe(false)
    },
  )

  it('takes values deep inside that JSON cannot write, without throwing', () => {
    const base = validManifests().find(({ file }) => file === 'valid/minimal.json')!.value as object
    const loop: Record<string, unknown> = { command: 'a' }
    loop.self = loop
    const odd = [
      { ...base, manifestVersion: 1n },
      { ...base, keywords: [1n, 1n, Number.NaN, null] },
      { ...base, contributes: { menus: { 'song/context': [loop, loop, { command: 'b' }] } } },
    ]
    expect(odd.map((value) => pairs(validateManifest(value).issues))).toEqual([
      ['SCHEMA_CONST /manifestVersion'],
      ['SCHEMA_DUPLICATE_ITEM /keywords', 'SCHEMA_TYPE /keywords/0', 'SCHEMA_TYPE /keywords/1', 'SCHEMA_TYPE /keywords/2', 'SCHEMA_TYPE /keywords/3'],
      [
        'SCHEMA_DUPLICATE_ITEM /contributes/menus/song~1context',
        'SCHEMA_UNKNOWN_PROPERTY /contributes/menus/song~1context/0/self',
        'SCHEMA_UNKNOWN_PROPERTY /contributes/menus/song~1context/1/self',
      ],
    ])
  })
})

describe('a list as long as a manifest can hold', () => {
  // Every item is compared with the ones before it in one pass: comparing
  // each with each would let one upload of 256 KiB keep a server busy for
  // seconds.
  const base = () => validManifests().find(({ file }) => file === 'valid/minimal.json')!.value as object
  /** As many items as fit in 240,000 bytes of JSON. */
  const longest = (item: (index: number) => unknown) => {
    const items: unknown[] = []
    for (let [index, bytes] = [0, 0]; bytes < 240_000; index += 1) {
      items.push(item(index))
      bytes += JSON.stringify(items.at(-1)).length + 1
    }
    return items
  }

  it.each([
    ['text', 'keywords', (index: number) => `k${index}`, 25_000],
    ['objects', 'contributes', (index: number) => ({ command: `c${index}` }), 10_000],
  ] as const)('of distinct %s is checked at once', (_kind, field, item, least) => {
    const items = longest(item)
    const value = field === 'keywords' ? { ...base(), keywords: items } : { ...base(), contributes: { menus: { sidebar: items } } }
    const text = JSON.stringify(value)
    const started = performance.now()
    const { issues } = parseManifest(text)
    expect(performance.now() - started).toBeLessThan(1500)
    expect(items.length).toBeGreaterThan(least)
    expect(pairs(issues).filter((pair) => pair.startsWith('SCHEMA_DUPLICATE_ITEM'))).toEqual([])
    expect(pairs(issues).filter((pair) => pair.startsWith('SCHEMA_ITEM_COUNT'))).toHaveLength(1)
  })
})

describe('a schema this build was not made for', () => {
  it('is a bug, said loudly, not a manifest that passes', () => {
    expect(() => checkStructure({ pattern: '^new$' }, 'new')).toThrow(/pattern this build was not generated with/)
    expect(() => checkStructure({ $ref: '#/$defs/missing', $defs: {} }, 'x')).toThrow(/no definition named missing/)
  })
})
