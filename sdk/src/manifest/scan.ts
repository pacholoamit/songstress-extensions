// The reader: from the bytes or text of a songstress.json to a JSON value, or
// to the one reason it cannot be read. Four checks, in this order, the first
// that fails ending the read:
//
//   1. size      at most 256 KiB of UTF-8
//   2. depth     objects and lists nested at most 16 deep, counted on the raw
//                input before anything decodes or parses it, so that no
//                parser is ever handed a text built to exhaust its stack
//   3. syntax    UTF-8, JSON (RFC 8259), every number one a double can hold,
//                every text whole Unicode
//   4. keys      no object names a key twice: the manifest declares
//                permissions, and two parsers must never read two different
//                ones out of the same file
//
// corpus/README.md says the same to the authors of other parsers.

import { gather, issue, type ManifestErrorCode, type ManifestIssue, type Report } from './codes'
import { isRecord } from './json'
import { child } from './pointer'

/** The largest manifest read, in bytes of UTF-8. */
export const MAX_MANIFEST_BYTES = 256 * 1024

/** The deepest nesting of objects and lists read. */
export const MAX_MANIFEST_DEPTH = 16

/** What reading gave: the value, or why there is none. */
export type ReadResult = { ok: true; value: unknown } | { ok: false; issues: ManifestIssue[] }

/** The input one unit at a time: a byte of the bytes, or a UTF-16 unit of the
 * text. What the reader looks for (quotes, brackets, commas) is ASCII, which
 * is one unit either way and is never part of a longer character. */
interface Units {
  readonly length: number
  at(index: number): number
}

const unitsOf = (input: string | Uint8Array): Units =>
  typeof input === 'string'
    ? { length: input.length, at: (index) => input.charCodeAt(index) }
    : { length: input.length, at: (index) => input[index] }

const QUOTE = 0x22
const BACKSLASH = 0x5c
const COMMA = 0x2c
const OPEN_LIST = 0x5b
const CLOSE_LIST = 0x5d
const OPEN_OBJECT = 0x7b
const CLOSE_OBJECT = 0x7d

const opens = (unit: number) => unit === OPEN_LIST || unit === OPEN_OBJECT
const closes = (unit: number) => unit === CLOSE_LIST || unit === CLOSE_OBJECT

function refuse(code: ManifestErrorCode, message: string): ReadResult {
  return { ok: false, issues: [issue(code, '', message)] }
}

const isHighSurrogate = (unit: number) => unit >= 0xd800 && unit <= 0xdbff
const isLowSurrogate = (unit: number) => unit >= 0xdc00 && unit <= 0xdfff

/** The bytes of UTF-8 that one UTF-16 unit takes when it stands alone. */
const unitBytes = (unit: number) => (unit < 0x80 ? 1 : unit < 0x800 ? 2 : 3)

/** The bytes of UTF-8 that `text` takes, counted without encoding it. A
 * surrogate pair is one character of four bytes. */
function utf8Length(text: string): number {
  let bytes = 0
  for (let index = 0; index < text.length; index += 1) {
    const unit = text.charCodeAt(index)
    const paired = isHighSurrogate(unit) && isLowSurrogate(text.charCodeAt(index + 1))
    bytes += paired ? 4 : unitBytes(unit)
    if (paired) index += 1
  }
  return bytes
}

/** The size of `input` in bytes of UTF-8. A text longer than the limit in
 * UTF-16 units is over it already, and is not walked to find by how much. */
function sizeOf(input: string | Uint8Array): number {
  if (typeof input !== 'string') return input.byteLength
  return input.length > MAX_MANIFEST_BYTES ? input.length : utf8Length(input)
}

/** Where the string that opens at `start` closes: a backslash skips the unit
 * after it, a quote ends the string. */
function stringEnd(units: Units, start: number): number {
  let index = start + 1
  while (index < units.length && units.at(index) !== QUOTE) {
    index += units.at(index) === BACKSLASH ? 2 : 1
  }
  return index
}

/** The deepest nesting in the input, by its brackets outside strings. It
 * reads any input, JSON or not, once through. */
function depthOf(units: Units): number {
  let [depth, deepest] = [0, 0]
  for (let index = 0; index < units.length; index += 1) {
    const unit = units.at(index)
    if (unit === QUOTE) index = stringEnd(units, index)
    else if (closes(unit)) depth -= 1
    else if (opens(unit)) {
      depth += 1
      deepest = Math.max(deepest, depth)
    }
  }
  return deepest
}

// The one thing this package uses that is not ECMAScript itself: a UTF-8
// decoder, which every browser, Node, Deno and Bun has. It is looked up by
// name, so that the package compiles with neither the DOM's types nor Node's
// and never reaches for anything else of either.
type Utf8Decoder = new (label: 'utf-8', options: { fatal: true; ignoreBOM: true }) => { decode(bytes: Uint8Array): string }

/** `bytes` as text, or null when they are not UTF-8. A byte-order mark is
 * kept, so that it fails as the JSON it is not. */
function decode(bytes: Uint8Array): string | null {
  const Decoder = (globalThis as { TextDecoder?: Utf8Decoder }).TextDecoder
  if (!Decoder) throw new Error('This JavaScript engine has no TextDecoder: hand the manifest over as text.')
  try {
    return new Decoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes)
  } catch {
    return null
  }
}

/** Whether `text` is whole Unicode: no half of a surrogate pair, and no
 * U+FFFD, the mark a decoder leaves where it could not read. Some JSON
 * parsers keep a lone surrogate and others turn it into U+FFFD, so a text
 * holding either would not be the same text everywhere. */
function isWhole(text: string): boolean {
  for (const char of text) {
    const point = char.codePointAt(0) ?? 0
    if ((point >= 0xd800 && point <= 0xdfff) || point === 0xfffd) return false
  }
  return true
}

/** What JSON allows that the manifest does not, found in a parsed value: a
 * number no double holds (1e400 is read as infinity), or text that is not
 * whole Unicode, in a key or a value. Null when there is neither. */
function unreadable(value: unknown): string | null {
  if (typeof value === 'number') return Number.isFinite(value) ? null : 'a number too large to read'
  if (typeof value === 'string') return isWhole(value) ? null : 'text with a damaged character in it'
  if (Array.isArray(value)) return firstOf(value)
  return isRecord(value) ? firstOf([...Object.keys(value), ...Object.values(value)]) : null
}

function firstOf(values: readonly unknown[]): string | null {
  for (const value of values) {
    const found = unreadable(value)
    if (found) return found
  }
  return null
}

/** One object or list being read: where it is, and what it has held so far. */
interface Frame {
  readonly pointer: string
  /** The keys seen, for an object; null for a list. */
  readonly keys: Set<string> | null
  /** The key whose value comes next, or the index of the next item. */
  slot: string | number
  /** An object waits for a key (true) or for that key's value (false). */
  wantsKey: boolean
}

/** The frame of the object or list that opens inside `parent`. */
function open(parent: Frame | undefined, isObject: boolean): Frame {
  const pointer = parent ? child(parent.pointer, parent.slot) : ''
  return { pointer, keys: isObject ? new Set() : null, slot: 0, wantsKey: isObject }
}

/** A string was read: when it is a key, note it, and report it if it repeats.
 * Keys are compared as the text they stand for, escapes decoded. */
function meetString(frame: Frame | undefined, literal: string, report: Report): void {
  if (!frame?.keys || !frame.wantsKey) return
  const key = JSON.parse(literal) as string
  if (frame.keys.has(key)) {
    report('JSON_DUPLICATE_KEY', child(frame.pointer, key), `"${key}" is written twice in the same object.`)
  }
  frame.keys.add(key)
  frame.slot = key
  frame.wantsKey = false
}

/** A comma was read: an object waits for its next key, a list moves on. */
function meetComma(frame: Frame | undefined): void {
  if (!frame) return
  if (frame.keys) frame.wantsKey = true
  else frame.slot = (frame.slot as number) + 1
}

/** Every key that an object of `text` names twice. `text` is known to be
 * JSON, so the walk only has to tell keys from values. */
function duplicateKeys(text: string): ManifestIssue[] {
  const found = gather()
  const frames: Frame[] = []
  const units = unitsOf(text)
  for (let index = 0; index < text.length; index += 1) {
    const unit = units.at(index)
    if (unit === QUOTE) {
      const end = stringEnd(units, index)
      meetString(frames.at(-1), text.slice(index, end + 1), found.report)
      index = end
    } else if (opens(unit)) frames.push(open(frames.at(-1), unit === OPEN_OBJECT))
    else if (closes(unit)) frames.pop()
    else if (unit === COMMA) meetComma(frames.at(-1))
  }
  return found.list()
}

/** The sentence for text that is not JSON, with what the engine's parser
 * said about where it broke ("... in JSON at position 41"), cut short. Each
 * engine words that its own way: it is for the person, never compared. */
function notJson(error: unknown): string {
  const said = error instanceof Error ? error.message.replace(/\s+/g, ' ').trim().replace(/[.]$/, '') : ''
  if (said === '') return 'The manifest is not JSON.'
  return `The manifest is not JSON: ${said.length > 160 ? `${said.slice(0, 160)}...` : `${said}.`}`
}

function parse(text: string): ReadResult {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch (error) {
    return refuse('JSON_INVALID', notJson(error))
  }
  const problem = unreadable(value)
  if (problem) return refuse('JSON_INVALID', `The manifest holds ${problem}.`)
  const repeated = duplicateKeys(text)
  return repeated.length > 0 ? { ok: false, issues: repeated } : { ok: true, value }
}

/** Reads a manifest from its text, or from its bytes as they are on disk. */
export function readManifest(input: string | Uint8Array): ReadResult {
  if (sizeOf(input) > MAX_MANIFEST_BYTES) {
    return refuse('MANIFEST_TOO_LARGE', `The manifest is larger than ${MAX_MANIFEST_BYTES / 1024} KiB.`)
  }
  if (depthOf(unitsOf(input)) > MAX_MANIFEST_DEPTH) {
    return refuse('MANIFEST_TOO_DEEP', `The manifest nests more than ${MAX_MANIFEST_DEPTH} levels deep.`)
  }
  const text = typeof input === 'string' ? input : decode(input)
  return text === null ? refuse('JSON_INVALID', 'The manifest is not UTF-8 text.') : parse(text)
}
