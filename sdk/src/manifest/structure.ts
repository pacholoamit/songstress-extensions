// A JSON Schema reader for the manifest's own schema, with no dependency and
// no generated code, so it runs wherever JavaScript does: a terminal, a
// browser under a strict content policy, a sandbox.
//
// It reads the keywords the manifest's schema uses and no others. The test
// beside it fails when the schema starts using a keyword this file does not
// know, and holds every answer against Ajv, the reference validator, over the
// corpus and over thousands of mangled manifests.
//
// One keyword that fails is one issue, at the place the keyword looked at. A
// keyword that only applies others ($ref, allOf, if, items, properties)
// reports nothing itself.

import { gather, type ManifestErrorCode, type ManifestIssue, type Report } from './codes'
import { isRecord, type SchemaNode } from './json'
import { PATTERNS } from './patterns.generated'
import { child } from './pointer'

/** The code each keyword reports when it fails: the contract every reader of
 * the schema keeps, whatever validator it is built on. */
export const KEYWORD_CODES = {
  type: 'SCHEMA_TYPE',
  required: 'SCHEMA_REQUIRED',
  additionalProperties: 'SCHEMA_UNKNOWN_PROPERTY',
  enum: 'SCHEMA_ENUM',
  const: 'SCHEMA_CONST',
  pattern: 'SCHEMA_PATTERN',
  minLength: 'SCHEMA_LENGTH',
  maxLength: 'SCHEMA_LENGTH',
  minimum: 'SCHEMA_RANGE',
  maximum: 'SCHEMA_RANGE',
  exclusiveMinimum: 'SCHEMA_RANGE',
  minItems: 'SCHEMA_ITEM_COUNT',
  maxItems: 'SCHEMA_ITEM_COUNT',
  uniqueItems: 'SCHEMA_DUPLICATE_ITEM',
  minProperties: 'SCHEMA_PROPERTY_COUNT',
} as const satisfies Record<string, ManifestErrorCode>

type FailingKeyword = keyof typeof KEYWORD_CODES

interface Run {
  readonly root: SchemaNode
  readonly report: Report
}

type Keyword = (node: SchemaNode, value: unknown, at: string, run: Run) => void

const TYPE_CHECKS: Record<string, (value: unknown) => boolean> = {
  object: isRecord,
  array: Array.isArray,
  string: (value) => typeof value === 'string',
  number: (value) => typeof value === 'number' && Number.isFinite(value),
  integer: (value) => Number.isInteger(value),
  boolean: (value) => typeof value === 'boolean',
  null: (value) => value === null,
}

const TYPE_WORDS: Record<string, string> = {
  object: 'an object',
  array: 'a list',
  string: 'text',
  number: 'a number',
  integer: 'a whole number',
  boolean: 'true or false',
  null: 'null',
}

const WORD_ORDER = ['null', 'array', 'object', 'string', 'boolean', 'number']

/** What a value is, in the words a message uses. */
function wordFor(value: unknown): string {
  const type = WORD_ORDER.find((name) => TYPE_CHECKS[name](value))
  return type ? TYPE_WORDS[type] : 'a value JSON cannot hold'
}

/** A value as JSON writes it, or null when JSON cannot write it (a BigInt, a
 * value that holds itself), as can happen with a value that never came from
 * JSON text. */
function jsonOf(value: unknown): string | null {
  try {
    return JSON.stringify(value) ?? null
  } catch {
    return null
  }
}

/** A value as a message quotes it: its JSON, cut short when it is long. */
function quote(value: unknown): string {
  const text = jsonOf(value) ?? wordFor(value)
  return text.length > 60 ? `${text.slice(0, 57)}...` : text
}

/** The schema a "#/$defs/name" reference points at. */
function resolve(root: SchemaNode, ref: unknown): SchemaNode {
  const defs = root.$defs as Record<string, SchemaNode>
  const name = String(ref).replace('#/$defs/', '')
  if (!Object.hasOwn(defs, name)) throw new Error(`the manifest schema has no definition named ${name}`)
  return defs[name]
}

/** What the schema says a value should be, when it says so in words. */
function hint(node: SchemaNode, root: SchemaNode): string {
  const own = node.description ?? (node.$ref ? resolve(root, node.$ref).description : undefined)
  return typeof own === 'string' ? ` Expected: ${own}` : ''
}

/** Whether `value` passes `node`, with nothing reported. */
function passes(node: SchemaNode, value: unknown, run: Run): boolean {
  let ok = true
  evaluate(node, value, '', { root: run.root, report: () => (ok = false) })
  return ok
}

/** A text two values share exactly when uniqueItems calls them the same:
 * an object's fields in any order, a number by its value (1.0 is 1). Kept
 * to one walk of each item, so a list of thousands is checked in one pass
 * and never by comparing every item with every other. `depth` keeps a value
 * that holds itself from being walked for ever; JSON text never nests that
 * deep (the reader stops at 16). */
function sameness(value: unknown, depth = 0): string {
  if (depth > 32) return '…'
  if (Array.isArray(value)) return `[${value.map((item) => sameness(item, depth + 1)).join(',')}]`
  if (isRecord(value)) {
    const fields = Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${sameness(value[key], depth + 1)}`)
    return `{${fields.join(',')}}`
  }
  // Finite numbers, text, true, false and null as JSON writes them; what
  // JSON cannot hold (NaN, a BigInt, undefined) by type and value, apart.
  if (typeof value === 'number' && !Number.isFinite(value)) return `number ${String(value)}`
  return jsonOf(value) ?? `${typeof value} ${String(value)}`
}

/** The schema's pattern as an expression. They are literals written from the
 * schema (patterns.generated.ts): no expression is built from text at run
 * time, so a pattern this build was not generated with is a bug, not input. */
function matcher(pattern: string): RegExp {
  const found = PATTERNS.get(pattern)
  if (!found) throw new Error(`the manifest schema has a pattern this build was not generated with: ${pattern}`)
  return found
}

/** A keyword comparing a size with the schema's own number: how the size is
 * measured, the test that fails it, and the words for the limit. */
function limit(
  key: FailingKeyword,
  measure: (value: unknown) => number | undefined,
  fails: (size: number, bound: number) => boolean,
  words: (bound: number) => string,
): Keyword {
  return (node, value, at, run) => {
    const size = measure(value)
    const bound = node[key] as number
    if (size !== undefined && fails(size, bound)) run.report(KEYWORD_CODES[key], at, words(bound))
  }
}

// A string's length is counted in characters (code points), as JSON Schema
// counts it, not in UTF-16 units.
const textLength = (value: unknown) => (typeof value === 'string' ? Array.from(value).length : undefined)
const numberValue = (value: unknown) => (TYPE_CHECKS.number(value) ? (value as number) : undefined)
const itemCount = (value: unknown) => (Array.isArray(value) ? value.length : undefined)
const fieldCount = (value: unknown) => (isRecord(value) ? Object.keys(value).length : undefined)
const below = (size: number, bound: number) => size < bound
const above = (size: number, bound: number) => size > bound
const notAbove = (size: number, bound: number) => size <= bound
const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? '' : 's'}`

function typeKeyword(node: SchemaNode, value: unknown, at: string, run: Run): void {
  const wanted = String(node.type)
  if (TYPE_CHECKS[wanted]?.(value)) return
  run.report(KEYWORD_CODES.type, at, `Expected ${TYPE_WORDS[wanted] ?? wanted} here, found ${wordFor(value)}.`)
}

function propertiesKeyword(node: SchemaNode, value: unknown, at: string, run: Run): void {
  if (!isRecord(value)) return
  for (const [key, schema] of Object.entries(node.properties as Record<string, SchemaNode>)) {
    if (Object.hasOwn(value, key)) evaluate(schema, value[key], child(at, key), run)
  }
}

function requiredKeyword(node: SchemaNode, value: unknown, at: string, run: Run): void {
  if (!isRecord(value)) return
  for (const key of node.required as string[]) {
    if (!Object.hasOwn(value, key)) run.report(KEYWORD_CODES.required, child(at, key), `"${key}" is missing.`)
  }
}

/** The manifest's objects are all closed: the keyword is only ever `false`. */
function additionalPropertiesKeyword(node: SchemaNode, value: unknown, at: string, run: Run): void {
  if (node.additionalProperties !== false || !isRecord(value)) return
  const known = (node.properties ?? {}) as Record<string, unknown>
  for (const key of Object.keys(value)) {
    if (Object.hasOwn(known, key)) continue
    const message = `${quote(key)} is not a field the manifest has here.`
    run.report(KEYWORD_CODES.additionalProperties, child(at, key), message)
  }
}

function itemsKeyword(node: SchemaNode, value: unknown, at: string, run: Run): void {
  if (!Array.isArray(value)) return
  value.forEach((item, index) => evaluate(node.items as SchemaNode, item, child(at, index), run))
}

function uniqueItemsKeyword(node: SchemaNode, value: unknown, at: string, run: Run): void {
  if (node.uniqueItems !== true || !Array.isArray(value)) return
  const seen = new Set<string>()
  const repeated = value.findIndex((item) => {
    const key = sameness(item)
    if (seen.has(key)) return true
    seen.add(key)
    return false
  })
  if (repeated >= 0) run.report(KEYWORD_CODES.uniqueItems, at, `Listed more than once: ${quote(value[repeated])}.`)
}

function patternKeyword(node: SchemaNode, value: unknown, at: string, run: Run): void {
  if (typeof value !== 'string' || matcher(node.pattern as string).test(value)) return
  run.report(KEYWORD_CODES.pattern, at, `${quote(value)} is not in the form asked here.${hint(node, run.root)}`)
}

function enumKeyword(node: SchemaNode, value: unknown, at: string, run: Run): void {
  const allowed = node.enum as unknown[]
  if (allowed.includes(value)) return
  run.report(KEYWORD_CODES.enum, at, `${quote(value)} is not one of: ${allowed.join(', ')}.`)
}

function constKeyword(node: SchemaNode, value: unknown, at: string, run: Run): void {
  if (value === node.const) return
  run.report(KEYWORD_CODES.const, at, `Must be ${quote(node.const)}, found ${quote(value)}.`)
}

function ifKeyword(node: SchemaNode, value: unknown, at: string, run: Run): void {
  if (passes(node.if as SchemaNode, value, run)) evaluate(node.then as SchemaNode, value, at, run)
}

/** The keywords that can fail, each reporting its own code. */
const FAILING: Record<FailingKeyword, Keyword> = {
  type: typeKeyword,
  required: requiredKeyword,
  additionalProperties: additionalPropertiesKeyword,
  enum: enumKeyword,
  const: constKeyword,
  pattern: patternKeyword,
  minLength: limit('minLength', textLength, below, (n) => `Must be at least ${plural(n, 'character')} long.`),
  maxLength: limit('maxLength', textLength, above, (n) => `Must be at most ${plural(n, 'character')} long.`),
  minimum: limit('minimum', numberValue, below, (n) => `Must be at least ${n}.`),
  maximum: limit('maximum', numberValue, above, (n) => `Must be at most ${n}.`),
  exclusiveMinimum: limit('exclusiveMinimum', numberValue, notAbove, (n) => `Must be more than ${n}.`),
  minItems: limit('minItems', itemCount, below, (n) => `Must list at least ${plural(n, 'item')}.`),
  maxItems: limit('maxItems', itemCount, above, (n) => `Must list at most ${plural(n, 'item')}.`),
  uniqueItems: uniqueItemsKeyword,
  minProperties: limit('minProperties', fieldCount, below, (n) => `Must have at least ${plural(n, 'field')}.`),
}

/** The keywords that only apply other schemas. */
const APPLYING: Record<string, Keyword> = {
  $ref: (node, value, at, run) => evaluate(resolve(run.root, node.$ref), value, at, run),
  allOf: (node, value, at, run) => (node.allOf as SchemaNode[]).forEach((part) => evaluate(part, value, at, run)),
  if: ifKeyword,
  items: itemsKeyword,
  properties: propertiesKeyword,
}

const KEYWORDS: Record<string, Keyword> = { ...APPLYING, ...FAILING }

/** The keywords that apply other schemas and report nothing themselves. */
export const APPLYING_KEYWORDS: readonly string[] = Object.keys(APPLYING)

function evaluate(node: SchemaNode, value: unknown, at: string, run: Run): void {
  for (const keyword of Object.keys(node)) {
    if (Object.hasOwn(KEYWORDS, keyword)) KEYWORDS[keyword](node, value, at, run)
  }
}

/** Every way `value` departs from `schema`, each (code, pointer) pair once. */
export function checkStructure(schema: SchemaNode, value: unknown): ManifestIssue[] {
  const found = gather()
  evaluate(schema, value, '', { root: schema, report: found.report })
  return found.list()
}
