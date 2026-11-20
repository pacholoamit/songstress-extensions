import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { ProviderFailureCode, SongstressErrorCode } from './api/index'
import { UI_VERSION } from './api/index'
import { API_PERMISSIONS } from './host'
import { MANIFEST_ERROR_CODES } from './manifest/codes'
import { isRecord } from './manifest/json'
import { RESERVED_PUBLISHERS } from './manifest/rules/identity'
import { LISTING_FIELDS, LISTING_LICENSES } from './manifest/rules/listing'
import { MAX_MANIFEST_BYTES, MAX_MANIFEST_DEPTH } from './manifest/scan'
import { MANIFEST_SCHEMA, MANIFEST_SCHEMA_ID } from './manifest/schema'
import { API_VERSION } from './version'

// SPEC.md is written by hand, for people. This holds it to the things that
// are written for programs: whatever the schema, the validator or the API
// names, the specification names too.

const read = (file: string) => readFileSync(new URL(file, import.meta.url), 'utf8')
const SPEC = read('../SPEC.md')

/** Whether the specification names `word` as code: `word`, or the start of a
 * longer name (`word.more`, `word(`). */
function names(word: string): boolean {
  return ['`', '.', '(', '"'].some((after) => SPEC.includes(`\`${word}${after}`) || SPEC.includes(`.${word}${after}`) || SPEC.includes(`"${word}${after}`))
}

const unnamed = (words: Iterable<string>) => [...new Set(words)].filter((word) => !names(word)).sort()

/** Every field name and every allowed value anywhere in the schema. */
function vocabulary(node: unknown, found: string[] = []): string[] {
  if (Array.isArray(node)) node.forEach((item) => vocabulary(item, found))
  if (!isRecord(node)) return found
  if (isRecord(node.properties)) found.push(...Object.keys(node.properties))
  if (Array.isArray(node.enum)) found.push(...node.enum.map(String))
  Object.values(node).forEach((value) => vocabulary(value, found))
  return found
}

/** Every literal a discriminated union of the API is told apart by. */
const literals = (source: string) => [...source.matchAll(/\btype: '([a-zA-Z-]+)'/g)].map((match) => match[1])

// The compiler fails this file when a code is added and not listed here.
const API_ERRORS = ['no-host', 'permission-denied', 'not-available', 'limit-exceeded', 'invalid', 'failed'] as const
const PROVIDER_FAILURES = ['rate-limited', 'sign-in-required', 'not-configured', 'unavailable'] as const
type Unlisted = Exclude<SongstressErrorCode, (typeof API_ERRORS)[number]> | Exclude<ProviderFailureCode, (typeof PROVIDER_FAILURES)[number]>
const everyCodeIsListed: [Unlisted] extends [never] ? true : false = true

describe('SPEC.md names', () => {
  it('every field and every allowed value of the manifest', () => {
    expect(unnamed(vocabulary(MANIFEST_SCHEMA))).toEqual([])
  })

  it('every code the validator reports', () => {
    expect(unnamed(Object.keys(MANIFEST_ERROR_CODES))).toEqual([])
  })

  it('every publisher name it keeps, and what the official list asks', () => {
    expect(unnamed([...RESERVED_PUBLISHERS, ...LISTING_FIELDS, ...LISTING_LICENSES])).toEqual([])
  })

  it('every member of the API', () => {
    const members = Object.values(API_PERMISSIONS).flatMap((table) => Object.keys(table))
    expect(unnamed(members.flatMap((member) => member.split('.')))).toEqual([])
  })

  it('every component and every action of the declared interface', () => {
    const found = literals(read('./api/ui.ts'))
    expect(found.length).toBeGreaterThan(35)
    expect(unnamed(found)).toEqual([])
  })

  it('every code a failed call or a failed provider carries', () => {
    expect(everyCodeIsListed).toBe(true)
    expect(unnamed([...API_ERRORS, ...PROVIDER_FAILURES])).toEqual([])
  })

  it('the versions and the limits as they are', () => {
    expect(SPEC).toContain(`extension API ${API_VERSION}`)
    expect(SPEC).toContain(`\`${MANIFEST_SCHEMA_ID}\``)
    expect(SPEC).toContain(`at most ${MAX_MANIFEST_BYTES / 1024} KiB`)
    expect(SPEC).toContain(`nested at most ${MAX_MANIFEST_DEPTH} deep`)
    expect(SPEC).toContain(`this document describes version ${UI_VERSION}`)
  })
})

describe('SPEC.md', () => {
  it('links only to sections it has', () => {
    const anchors = new Set(
      [...SPEC.matchAll(/^#{2,3} (.+)$/gm)].map((match) =>
        match[1]
          .toLowerCase()
          .replace(/[^a-z0-9 -]/g, '')
          .replaceAll(' ', '-'),
      ),
    )
    const linked = [...SPEC.matchAll(/\]\(#([^)]+)\)/g)].map((match) => match[1])
    expect(linked.length).toBeGreaterThan(10)
    expect(linked.filter((anchor) => !anchors.has(anchor))).toEqual([])
  })

  it('has no placeholder left in it', () => {
    expect(SPEC).not.toMatch(/TODO|TBD|@@|lorem/i)
  })
})
