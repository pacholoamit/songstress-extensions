import { THEME_TOKENS as ENGINE_TOKENS } from '@songstress/theme/tokens'
import { describe, expect, it } from 'vitest'
import { bytesOf, filesIn, pairs, THEME_CASES } from '../test/corpus'
import { isRecord } from './json'
import { PATTERNS } from './patterns.generated'
import { MANIFEST_SCHEMA, THEME_FILE_SCHEMA, THEME_TOKENS } from './schema'
import { MAX_THEME_FILE_BYTES, parseThemeFile } from './themes'

// A theme file is read as the manifest is, and its corpus is the contract in
// the same way: for each case, exactly its set of (code, pointer) pairs.

const defsOf = (schema: unknown) => (schema as { $defs: Record<string, unknown> }).$defs

describe('the theme file corpus', () => {
  it.each(THEME_CASES.map((entry) => [`${entry.file} (${entry.appearance})`, entry] as const))('%s', (_name, entry) => {
    const result = parseThemeFile(bytesOf(entry.file), entry.appearance)
    expect(pairs(result.issues), entry.note).toEqual(pairs(entry.errors))
    expect(result.valid).toBe(entry.valid)
    expect(result.valid ? typeof result.file : 'file' in result).toBe(entry.valid ? 'object' : false)
  })

  it('answers the same for a file handed over as text', () => {
    for (const entry of THEME_CASES) {
      const text = new TextDecoder().decode(bytesOf(entry.file))
      expect(pairs(parseThemeFile(text, entry.appearance).issues), entry.file).toEqual(pairs(entry.errors))
    }
  })

  it('names every file of corpus/themes, and no file that is not there', () => {
    expect([...new Set(THEME_CASES.map((entry) => entry.file))].sort()).toEqual(filesIn('themes'))
  })

  it("says the reader's problems are about a theme file, not a manifest", () => {
    const [problem] = parseThemeFile(bytesOf('themes/not-json.json'), 'dark').issues
    expect(problem?.message).toMatch(/^The theme file is not JSON/)
  })
})

describe('the size limit of a theme file', () => {
  const [head, tail] = ['{"dark":{"accent":"#f5b556"},"$schema":"', '"}']
  const filler = (bytes: number) => `${head}${'x'.repeat(bytes - head.length - tail.length)}${tail}`

  it('reads a file of exactly the limit, as far as its size goes, and refuses one byte more', () => {
    expect(new TextEncoder().encode(filler(MAX_THEME_FILE_BYTES)).length).toBe(MAX_THEME_FILE_BYTES)
    expect(pairs(parseThemeFile(filler(MAX_THEME_FILE_BYTES), 'dark').issues)).not.toContain('THEME_FILE_TOO_LARGE ')
    expect(pairs(parseThemeFile(filler(MAX_THEME_FILE_BYTES + 1), 'dark').issues)).toEqual(['THEME_FILE_TOO_LARGE '])
  })

  it('counts bytes of UTF-8, not characters', () => {
    const wide = `{"$schema":"${String.fromCodePoint(0x97f3).repeat(MAX_THEME_FILE_BYTES / 3)}"}`
    expect(pairs(parseThemeFile(wide, 'dark').issues)).toEqual(['THEME_FILE_TOO_LARGE '])
    expect(pairs(parseThemeFile(new TextEncoder().encode(wide), 'dark').issues)).toEqual(['THEME_FILE_TOO_LARGE '])
  })
})

describe("the theme file's schema", () => {
  it("names the very tokens the apps' engine fills and checks (@songstress/theme), none more and none fewer", () => {
    expect([...THEME_TOKENS].sort()).toEqual([...ENGINE_TOKENS].sort())
  })

  it("is the manifest schema's own looks: the same definitions, and the root its themeFile", () => {
    const manifest = defsOf(MANIFEST_SCHEMA)
    for (const [name, def] of Object.entries(defsOf(THEME_FILE_SCHEMA))) expect(def, name).toEqual(manifest[name])
    const root = THEME_FILE_SCHEMA as Record<string, unknown>
    const filed = manifest.themeFile as Record<string, unknown>
    for (const keyword of ['type', 'additionalProperties', 'properties']) expect(root[keyword], keyword).toEqual(filed[keyword])
  })

  it('compiles every pattern it holds into the generated table', () => {
    const patterns = JSON.stringify(THEME_FILE_SCHEMA).match(/"pattern":"((?:[^"\\]|\\.)*)"/g) ?? []
    for (const found of patterns) expect(PATTERNS.has(JSON.parse(`{${found}}`).pattern as string), found).toBe(true)
  })

  it("keeps one look for dark and light, its colours in one map of the tokens, each token one colour", () => {
    const defs = defsOf(MANIFEST_SCHEMA)
    const fields = (def: string) => {
      const node = defs[def]
      return isRecord(node) && isRecord(node.properties) ? node.properties : {}
    }
    const refOf = (def: string, field: string) => (fields(def)[field] as { $ref?: string } | undefined)?.$ref
    // songstress/theme writes the tokens out (it carries no schema): they are the schema's, in its order.
    expect(Object.keys(fields('themeColors'))).toEqual([...THEME_TOKENS])
    // No part of the app has a look of its own: the player's is made from the theme's, Wrapped's is Songstress's.
    expect(Object.keys(fields('themeLook'))).toEqual(['seed', 'colors', 'glow'])
    for (const def of ['theme', 'themeFile']) {
      for (const look of ['dark', 'light']) expect(refOf(def, look), `${def}.${look}`).toBe('#/$defs/themeLook')
    }
    expect(refOf('themeLook', 'colors')).toBe('#/$defs/themeColors')
    for (const token of THEME_TOKENS) expect(refOf('themeColors', token), token).toBe('#/$defs/themeColor')
  })
})
