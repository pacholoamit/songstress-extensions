import { describe, expect, it } from 'vitest'
import { bytesOf, CASES, filesIn, pairs, type CorpusCase } from '../test/corpus'
import { MANIFEST_ERROR_CODES, type ManifestErrorCode } from './codes'
import type { SchemaNode } from './json'
import { MAX_MANIFEST_BYTES } from './scan'
import { MANIFEST_SCHEMA } from './schema'
import type { Manifest } from './types.generated'
import { parseManifest, type ManifestResult } from './validate'

// The corpus is the contract: for each case, exactly its set of
// (code, pointer) pairs, whatever the order and whatever the sentences say.

const label = (entry: CorpusCase) =>
  `${entry.file} (${entry.profile}${entry.apiVersion ? `, API ${entry.apiVersion}` : ''})`

function check(entry: CorpusCase, input: string | Uint8Array): ManifestResult {
  return parseManifest(input, { profile: entry.profile, apiVersion: entry.apiVersion })
}

/** The file's text as a host that reads text before handing it over would
 * have it: a byte-order mark kept, and U+FFFD wherever a byte was not UTF-8. */
function textOf(file: string): string {
  return new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytesOf(file))
}

describe('the corpus', () => {
  it.each(CASES.map((entry) => [label(entry), entry] as const))('%s', (_name, entry) => {
    const result = check(entry, bytesOf(entry.file))
    expect(pairs(result.issues), entry.note).toEqual(pairs(entry.errors))
    expect(result.valid).toBe(entry.valid)
  })

  it('answers the same for a file handed over as text, even one whose bytes were not UTF-8', () => {
    for (const entry of CASES) {
      expect(pairs(check(entry, textOf(entry.file)).issues), label(entry)).toEqual(pairs(entry.errors))
    }
  })

  it('hands back the manifest itself when it is valid, and none when it is not', () => {
    for (const entry of CASES) {
      const result = check(entry, bytesOf(entry.file))
      expect(result.valid ? typeof result.manifest.id : 'manifest' in result, label(entry)).toBe(
        entry.valid ? 'string' : false,
      )
    }
  })
})

describe('the table', () => {
  const named = new Set(CASES.map((entry) => entry.file))

  it('names every file of the corpus, and no file that is not there', () => {
    expect([...named].sort()).toEqual([...filesIn('invalid'), ...filesIn('valid')].sort())
  })

  it('has a valid case for every file in valid/ and an invalid one for every file in invalid/', () => {
    for (const folder of ['valid', 'invalid'] as const) {
      const proven = new Set(CASES.filter((entry) => entry.valid === (folder === 'valid')).map((entry) => entry.file))
      expect(filesIn(folder).filter((file) => !proven.has(file))).toEqual([])
    }
  })

  it('has a case for every code but the one no file is kept for, and the one only a theme file earns', () => {
    const pinned = new Set(CASES.flatMap((entry) => entry.errors.map((error) => error.code)))
    const unpinned = (Object.keys(MANIFEST_ERROR_CODES) as ManifestErrorCode[]).filter((code) => !pinned.has(code))
    // A theme file's size limit is held in themes.test.ts, with no file kept for it either.
    expect(unpinned).toEqual(['MANIFEST_TOO_LARGE', 'THEME_FILE_TOO_LARGE'])
  })

  it('says of each case what it shows, and agrees with itself', () => {
    for (const entry of CASES) {
      expect(entry.note.length, label(entry)).toBeGreaterThan(10)
      expect(entry.valid, label(entry)).toBe(entry.errors.length === 0)
      expect(new Set(pairs(entry.errors)).size, label(entry)).toBe(entry.errors.length)
    }
  })
})

describe('what a person reads', () => {
  it('is a sentence for every problem, in a stable order', () => {
    for (const entry of CASES) {
      const { issues } = check(entry, bytesOf(entry.file))
      for (const issue of issues) expect(issue.message, `${label(entry)} ${issue.code}`).toMatch(/^[A-Z"0-9].*[.]$/s)
      const order = issues.map((issue) => `${issue.pointer} ${issue.code}`)
      expect(order, label(entry)).toEqual([...order].sort())
    }
  })
})

describe('the size limit, which no file is kept for', () => {
  const filler = (bytes: number) => `{"name":"${'x'.repeat(bytes - 11)}"}`

  it('reads a manifest of exactly the limit and refuses one byte more', () => {
    expect(pairs(parseManifest(filler(MAX_MANIFEST_BYTES)).issues)).not.toContain('MANIFEST_TOO_LARGE ')
    expect(pairs(parseManifest(filler(MAX_MANIFEST_BYTES + 1)).issues)).toEqual(['MANIFEST_TOO_LARGE '])
  })

  it('counts bytes of UTF-8, not characters', () => {
    // Each of these characters is three bytes: a third of the limit in
    // characters is already over it.
    const wide = `{"name":"${String.fromCodePoint(0x97f3).repeat(MAX_MANIFEST_BYTES / 3)}"}`
    expect(pairs(parseManifest(wide).issues)).toEqual(['MANIFEST_TOO_LARGE '])
    expect(pairs(parseManifest(new TextEncoder().encode(wide)).issues)).toEqual(['MANIFEST_TOO_LARGE '])
  })

  it('is checked before anything else', () => {
    expect(pairs(parseManifest('['.repeat(MAX_MANIFEST_BYTES + 1)).issues)).toEqual(['MANIFEST_TOO_LARGE '])
  })
})

/** What the sources of one provider kind say they answer, `said` of each. */
function answersOf<S>(sources: readonly S[] | undefined, said: (source: S) => readonly string[]): string[] {
  return (sources ?? []).flatMap(said)
}

describe('valid/everything.json', () => {
  // Its case says it uses every contribution point, hook, permission, menu
  // location, provider kind, setting type and scope, and panel location:
  // this holds it to that, by the schema's own lists.
  const manifest = JSON.parse(new TextDecoder().decode(bytesOf('valid/everything.json'))) as Manifest
  const contributes = manifest.contributes ?? {}
  const providers = contributes.providers ?? {}
  const settings = contributes.settings ?? []
  const defs = MANIFEST_SCHEMA.$defs as Record<string, SchemaNode>
  /** What the schema allows at `path` from a definition: its fields, or its values. */
  const allowed = (def: string, ...path: string[]): string[] => {
    const node = path.reduce<SchemaNode>((at, key) => at[key] as SchemaNode, defs[def])
    return Array.isArray(node.enum) ? (node.enum as string[]) : Object.keys(node.properties as object)
  }
  const used = (values: readonly (string | undefined)[]) => [...new Set(values)].sort()

  it.each([
    ['contribution points', Object.keys(contributes), allowed('contributes')],
    ['permissions', Object.keys(manifest.permissions ?? {}), allowed('permissions')],
    ['menu locations', Object.keys(contributes.menus ?? {}), allowed('menus')],
    ['provider kinds', Object.keys(providers), allowed('sourcesByKind')],
    ['server hooks', manifest.hooks?.server ?? [], allowed('serverHook')],
    ['client hooks', manifest.hooks?.client ?? [], allowed('clientHook')],
    ['platforms', manifest.platforms ?? [], allowed('platform')],
    ['setting types', settings.map((setting) => setting.type), allowed('setting', 'properties', 'type')],
    ['setting scopes', settings.map((setting) => setting.scope), allowed('settingScope')],
    ['panel locations', (contributes.panels ?? []).map((panel) => panel.location), allowed('panelLocation')],
    ['route methods', (contributes.routes ?? []).map((route) => route.method), allowed('route', 'properties', 'method')],
    ['catalogue types', [...(providers.search ?? []), ...(providers.lookup ?? [])].flatMap((source) => source.types), allowed('catalogType')],
    ['metadata answers', answersOf(providers.metadata, (source) => source.supports), allowed('metadataSource', 'properties', 'supports', 'items')],
    ['artwork answers', answersOf(providers.artwork, (source) => source.supports), allowed('artworkSource', 'properties', 'supports', 'items')],
    ['artist info answers', answersOf(providers.artistInfo, (source) => source.supports), allowed('artistInfoSource', 'properties', 'supports', 'items')],
    ['recommendation modes', answersOf(providers.recommend, (source) => source.modes), allowed('recommendSource', 'properties', 'modes', 'items')],
  ])('uses every one of the %s', (_what, found, all) => {
    expect(used(found)).toEqual(used(all))
  })
})
