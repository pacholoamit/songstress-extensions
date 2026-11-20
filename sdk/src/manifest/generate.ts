// What is written from the manifest's schema, so nothing is kept twice by
// hand: the manifest's TypeScript types (types.generated.ts) and the schema's
// patterns as regular expression literals (patterns.generated.ts). The test
// beside this file fails when either is stale; `pnpm generate` rewrites them.
//
// It reads the same subset of JSON Schema as structure.ts and no more.

import { isRecord, type SchemaNode } from './json'

const HEADER = [
  '// Generated from schema/extension.v1.json by src/manifest/generate.ts.',
  '// Never edit it: change the schema, then run `pnpm --dir packages/extensions generate`.',
  '',
].join('\n')

/** "extensionId" as a type's name: "ExtensionId". */
function typeName(def: string): string {
  return def.charAt(0).toUpperCase() + def.slice(1)
}

function refName(ref: unknown): string {
  return typeName(String(ref).replace('#/$defs/', ''))
}

/** A doc comment for `text`, or nothing when there is none. */
function doc(text: unknown, indent = ''): string {
  return typeof text === 'string' ? `${indent}/** ${text.replaceAll('*/', '* /')} */\n` : ''
}

const literals = (values: unknown[]) => values.map((value) => JSON.stringify(value)).join(' | ')

/** The `then` halves of an allOf of if/then pairs: the shapes a value may take. */
function variants(node: SchemaNode): string {
  return (node.allOf as SchemaNode[]).map((part) => typeOf(part.then as SchemaNode)).join(' | ')
}

const PRIMITIVES: Record<string, string> = { string: 'string', number: 'number', integer: 'number', boolean: 'boolean' }

function listOf(items: SchemaNode): string {
  const item = typeOf(items)
  return item.includes(' | ') ? `(${item})[]` : `${item}[]`
}

/** The TypeScript type a schema asks for, written in place. */
function typeOf(node: SchemaNode): string {
  if (node.$ref !== undefined) return refName(node.$ref)
  if (node.const !== undefined) return JSON.stringify(node.const)
  if (Array.isArray(node.enum)) return literals(node.enum)
  if (Array.isArray(node.allOf)) return variants(node)
  if (node.type === 'array') return listOf(node.items as SchemaNode)
  if (node.type === 'object') return `{\n${members(node, '  ')}}`
  const primitive = PRIMITIVES[String(node.type)]
  if (!primitive) throw new Error(`generate.ts cannot write a type for ${JSON.stringify(node)}`)
  return primitive
}

const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/

/** An object schema's fields as interface members. A field that only points
 * at a definition carries no words of its own: an editor shows the
 * definition's. */
function members(node: SchemaNode, indent: string): string {
  const required = new Set((node.required ?? []) as string[])
  return Object.entries((node.properties ?? {}) as Record<string, SchemaNode>)
    .map(([key, schema]) => {
      const name = IDENTIFIER.test(key) ? key : JSON.stringify(key)
      const mark = required.has(key) ? '' : '?'
      return `${doc(schema.description, indent)}${indent}${name}${mark}: ${typeOf(schema)}\n`
    })
    .join('')
}

function declaration(name: string, node: SchemaNode): string {
  const isInterface = node.type === 'object' && isRecord(node.properties) && !Array.isArray(node.allOf)
  if (isInterface) return `${doc(node.description)}export interface ${name} {\n${members(node, '  ')}}\n`
  return `${doc(node.description)}export type ${name} = ${typeOf(node)}\n`
}

/** The manifest's types: `Manifest` for the root, one type for each definition. */
export function generateTypes(schema: SchemaNode): string {
  const defs = Object.entries(schema.$defs as Record<string, SchemaNode>)
  const blocks = [declaration('Manifest', schema), ...defs.map(([def, node]) => declaration(typeName(def), node))]
  return `${HEADER}\n${blocks.join('\n')}`
}

/** Every `pattern` anywhere under `node`. */
function patternsUnder(node: unknown, found: Set<string>): Set<string> {
  if (Array.isArray(node)) node.forEach((item) => patternsUnder(item, found))
  if (!isRecord(node)) return found
  if (typeof node.pattern === 'string') found.add(node.pattern)
  Object.values(node).forEach((value) => patternsUnder(value, found))
  return found
}

/** `pattern` as the body of a regular expression literal: a slash ends a
 * literal unless it is escaped or inside a character class. */
function literalBody(pattern: string): string {
  let [body, inClass] = ['', false]
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index]
    if (char === '\\') {
      body += char + pattern[(index += 1)]
      continue
    }
    if (char === '[') inClass = true
    if (char === ']') inClass = false
    body += char === '/' && !inClass ? '\\/' : char
  }
  return body
}

/** The schema's patterns as literals, by their text: a literal is compiled
 * with the file, and no expression is ever built from a string at run time. */
export function generatePatterns(schema: SchemaNode): string {
  const rows = [...patternsUnder(schema, new Set())]
    .sort()
    .map((pattern) => `  [${JSON.stringify(pattern)}, /${literalBody(pattern)}/u],\n`)
  return [
    HEADER,
    "/** The manifest schema's patterns, each under its own text. */",
    'export const PATTERNS: ReadonlyMap<string, RegExp> = new Map([',
    `${rows.join('')}])`,
    '',
  ].join('\n')
}
