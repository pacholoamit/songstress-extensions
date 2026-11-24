// A gzip file read inside the server's sandbox, which has no zlib: gzip
// (RFC 1952) around deflate (RFC 1951), to the bytes it packed. The sandbox
// runs JavaScript slowly, so the reader is built for it: Huffman codes of up
// to ten bits are read from a table, and a caller that looks for one thing
// (a token in a web player's script) is handed the text a block at a time
// and stops the reading at the first block that holds it.

import { byteText } from './bytes'

/** Whether bytes open as a gzip file does. */
export function isGzip(bytes: Uint8Array): boolean {
  return bytes.length > 18 && bytes[0] === 0x1f && bytes[1] === 0x8b && bytes[2] === 8
}

/** The most a gzip file is unpacked to. */
const UNPACKED_MAX = 24 * 1024 * 1024
/** How much of the text before a block is handed over with it, so a token
 * that lies across two blocks is still read whole. */
const OVERLAP = 2048

/** A length's base and extra bits, by its symbol less 257. The last two
 * are no length (the fixed code's 286 and 287): their base is past any
 * output, so the copy refuses them. */
const LENGTH_BASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258, 1 << 30, 1 << 30]
const LENGTH_EXTRA = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0, 0, 0]
const DISTANCE_BASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577]
const DISTANCE_EXTRA = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13]
/** The order a dynamic block gives its code-length code's lengths in. */
const ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]

/** How many bits of a code the table answers at once. */
const FAST_BITS = 10
const FAST_MASK = (1 << FAST_BITS) - 1

/** A canonical Huffman code. `fast` answers a code of up to FAST_BITS bits
 * from the next bits of the stream: its symbol above its length, or 0 for a
 * longer code, which is then read from `count` (how many codes there are of
 * each length) and `symbol` (the symbols in code order). */
interface Code {
  fast: Uint16Array
  count: Uint16Array
  symbol: Uint16Array
}

/** The table entries of one code: every index whose low bits are the code's, first bit first. */
function fillFast(fast: Uint16Array, code: number, len: number, symbol: number): void {
  let reversed = 0
  for (let bit = 0; bit < len; bit++) reversed |= ((code >> bit) & 1) << (len - 1 - bit)
  for (let index = reversed; index <= FAST_MASK; index += 1 << len) fast[index] = (symbol << 4) | len
}

function codeOf(lengths: ArrayLike<number>, from: number, n: number): Code {
  const count = new Uint16Array(16)
  for (let at = 0; at < n; at++) count[lengths[from + at]!]!++
  count[0] = 0
  const offset = new Uint16Array(16)
  const next = new Uint16Array(16)
  for (let len = 1, code = 0; len <= 15; len++) {
    code = (code + count[len - 1]!) << 1
    next[len] = code
    if (len < 15) offset[len + 1] = offset[len]! + count[len]!
  }
  const symbol = new Uint16Array(n)
  const fast = new Uint16Array(1 << FAST_BITS)
  for (let at = 0; at < n; at++) {
    const len = lengths[from + at]!
    if (len === 0) continue
    symbol[offset[len]!++] = at
    const code = next[len]!++
    if (len <= FAST_BITS) fillFast(fast, code, len, at)
  }
  return { fast, count, symbol }
}

/** What gunzip throws: bytes that are not gzip, or do not read. */
export class GzipError extends Error {
  override readonly name = 'GzipError'
}

const broken = (): GzipError => new GzipError('gunzip: the bytes do not read as gzip')

/** Where the reading stands. `held` holds the next `bits` bits of the
 * stream, its first bit lowest. */
interface Reading {
  bytes: Uint8Array
  at: number
  held: number
  bits: number
  out: Uint8Array
  size: number
}

/** The next `need` bits (16 at most), taken. */
function take(r: Reading, need: number): number {
  while (r.bits < need) {
    if (r.at >= r.bytes.length) throw broken()
    r.held |= r.bytes[r.at++]! << r.bits
    r.bits += 8
  }
  const value = r.held & ((1 << need) - 1)
  r.held >>>= need
  r.bits -= need
  return value
}

/** The entry of a code longer than the table answers, `(symbol << 4) | length`,
 * read from the next 15 bits held. */
function slowEntry(code: Code, held: number): number {
  let value = 0
  let first = 0
  let index = 0
  for (let len = 1; len <= 15; len++) {
    value |= (held >>> (len - 1)) & 1
    const count = code.count[len]!
    if (value - count < first) return (code.symbol[index + (value - first)]! << 4) | len
    index += count
    first = (first + count) << 1
    value <<= 1
  }
  throw broken()
}

/** The next symbol of a code. Past the end the stream reads as zeros, a few
 * bytes at most: a code may end in the last byte. */
function symbolOf(r: Reading, code: Code): number {
  if (r.bits < 16) {
    if (r.at > r.bytes.length + 4) throw broken()
    r.held |= (r.bytes[r.at]! | (r.bytes[r.at + 1]! << 8)) << r.bits
    r.at += 2
    r.bits += 16
  }
  const entry = code.fast[r.held & FAST_MASK]! || slowEntry(code, r.held)
  r.held >>>= entry & 15
  r.bits -= entry & 15
  return entry >>> 4
}

/** A match: what is already out, from its distance back, copied for its
 * length. The loop of `block` hands its state over in `r`, and takes it back. */
function copyMatch(r: Reading, which: number, distances: Code): void {
  const { bytes, out } = r
  let { at, held, bits, size } = r
  if (bits < 16) {
    held |= (bytes[at]! | (bytes[at + 1]! << 8)) << bits
    at += 2
    bits += 16
  }
  let extra = LENGTH_EXTRA[which]!
  const length = LENGTH_BASE[which]! + (held & ((1 << extra) - 1))
  held >>>= extra
  bits -= extra
  if (bits < 16) {
    held |= (bytes[at]! | (bytes[at + 1]! << 8)) << bits
    at += 2
    bits += 16
  }
  const entry = distances.fast[held & FAST_MASK]! || slowEntry(distances, held)
  held >>>= entry & 15
  bits -= entry & 15
  if (bits < 16) {
    held |= (bytes[at]! | (bytes[at + 1]! << 8)) << bits
    at += 2
    bits += 16
  }
  extra = DISTANCE_EXTRA[entry >>> 4]!
  const distance = DISTANCE_BASE[entry >>> 4]! + (held & ((1 << extra) - 1))
  held >>>= extra
  bits -= extra
  if (distance > size || size + length > out.length || at > bytes.length + 4) throw broken()
  // A copy that does not reach into itself is the runtime's own; one that
  // does repeats what it copies, so it goes a byte at a time.
  if (distance >= length) out.copyWithin(size, size - distance, size - distance + length)
  else for (let from = size - distance, to = size; to < size + length; ) out[to++] = out[from++]!
  size += length
  r.at = at
  r.held = held
  r.bits = bits
  r.size = size
}

function stored(r: Reading): void {
  r.held = 0
  r.bits = 0
  if (r.at + 4 > r.bytes.length) throw broken()
  const len = r.bytes[r.at]! | (r.bytes[r.at + 1]! << 8)
  const not = r.bytes[r.at + 2]! | (r.bytes[r.at + 3]! << 8)
  r.at += 4
  if (len !== (~not & 0xffff) || r.at + len > r.bytes.length || r.size + len > r.out.length) throw broken()
  r.out.set(r.bytes.subarray(r.at, r.at + len), r.size)
  r.size += len
  r.at += len
}

/** A block's literals and matches, to its end: the loop nearly all the
 * time goes to, so a literal is read and written with the state in
 * variables of its own, and only a match is handed to `copyMatch`. A
 * literal past the output's end is written nowhere, and refused at the
 * block's end. */
function block(r: Reading, literals: Code, distances: Code): void {
  const { bytes, out } = r
  const fast = literals.fast
  const limit = bytes.length + 4
  let { at, held, bits, size } = r
  for (;;) {
    if (bits < 16) {
      if (at > limit) throw broken()
      held |= (bytes[at]! | (bytes[at + 1]! << 8)) << bits
      at += 2
      bits += 16
    }
    const entry = fast[held & FAST_MASK]! || slowEntry(literals, held)
    held >>>= entry & 15
    bits -= entry & 15
    const symbol = entry >>> 4
    if (symbol < 256) {
      out[size++] = symbol
      continue
    }
    if (symbol === 256) break
    r.at = at
    r.held = held
    r.bits = bits
    r.size = size
    copyMatch(r, symbol - 257, distances)
    ;({ at, held, bits, size } = r)
  }
  if (size > out.length) throw broken()
  // Whole bytes read ahead and not used go back: a stored block starts on the next byte.
  while (bits >= 8) {
    bits -= 8
    at--
  }
  r.at = at
  r.held = held & ((1 << bits) - 1)
  r.bits = bits
  r.size = size
}

let fixedCodes: [Code, Code] | null = null

function fixed(r: Reading): void {
  if (!fixedCodes) {
    const lengths = new Uint8Array(288 + 30)
    lengths.fill(8, 0, 144)
    lengths.fill(9, 144, 256)
    lengths.fill(7, 256, 280)
    lengths.fill(8, 280, 288)
    lengths.fill(5, 288)
    fixedCodes = [codeOf(lengths, 0, 288), codeOf(lengths, 288, 30)]
  }
  block(r, fixedCodes[0], fixedCodes[1])
}

/** A run of the code-length code: how many lengths it sets, and to what. */
function lengthRun(r: Reading, symbol: number, lengths: Uint8Array, at: number): readonly [value: number, times: number] {
  if (symbol === 16) {
    if (at === 0) throw broken()
    return [lengths[at - 1]!, 3 + take(r, 2)]
  }
  return symbol === 17 ? [0, 3 + take(r, 3)] : [0, 11 + take(r, 7)]
}

function dynamic(r: Reading): void {
  const literals = take(r, 5) + 257
  const distances = take(r, 5) + 1
  const codes = take(r, 4) + 4
  if (literals > 286 || distances > 30) throw broken()
  const lengths = new Uint8Array(286 + 30)
  for (let at = 0; at < codes; at++) lengths[ORDER[at]!] = take(r, 3)
  const lengthCode = codeOf(lengths, 0, 19)
  lengths.fill(0, 0, 19)
  for (let at = 0; at < literals + distances; ) {
    const symbol = symbolOf(r, lengthCode)
    if (symbol < 16) {
      lengths[at++] = symbol
      continue
    }
    const [value, times] = lengthRun(r, symbol, lengths, at)
    if (at + times > literals + distances) throw broken()
    lengths.fill(value, at, at + times)
    at += times
  }
  block(r, codeOf(lengths, 0, literals), codeOf(lengths, literals, distances))
}

/** Where a gzip file's deflate data starts, past its header's optional parts. */
function dataStart(bytes: Uint8Array): number {
  const flags = bytes[3]!
  let at = 10
  if (flags & 4) at += 2 + (bytes[at]! | (bytes[at + 1]! << 8))
  for (const named of [8, 16]) {
    if (!(flags & named)) continue
    while (at < bytes.length && bytes[at] !== 0) at++
    at++
  }
  if (flags & 2) at += 2
  return at
}

/** A gzip file read a block at a time. After each block `seen` is told how
 * much is unpacked so far, and the reading stops when it answers true.
 * Answers what was unpacked. Throws when the bytes are not gzip, or do not
 * read. */
function unpack(bytes: Uint8Array, seen: (out: Uint8Array, size: number) => boolean): Uint8Array {
  if (!isGzip(bytes)) throw broken()
  const end = bytes.length
  // The trailer's last four bytes say how long the unpacked data is.
  const expected = (bytes[end - 4]! | (bytes[end - 3]! << 8) | (bytes[end - 2]! << 16) | (bytes[end - 1]! << 24)) >>> 0
  if (expected > UNPACKED_MAX) throw broken()
  const r: Reading = { bytes, at: dataStart(bytes), held: 0, bits: 0, out: new Uint8Array(expected), size: 0 }
  for (let last = 0; last === 0; ) {
    last = take(r, 1)
    const kind = take(r, 2)
    if (kind === 0) stored(r)
    else if (kind === 1) fixed(r)
    else if (kind === 2) dynamic(r)
    else throw broken()
    if (seen(r.out, r.size)) break
  }
  return r.out.subarray(0, r.size)
}

/** The bytes a gzip file packed: what zlib's `gunzip` gives, in the sandbox,
 * which has no zlib. It reads one gzip member, of up to 24 MiB unpacked (its
 * trailer says how much); it does not check the CRC.
 * @param bytes - The gzip file's bytes.
 * @returns The bytes it packed.
 * @throws When the bytes are not gzip, do not read, or unpack to more than 24 MiB.
 * @example
 * ```ts
 * import { base64Bytes, gunzip, songstress, utf8Text } from 'songstress/server'
 *
 * // A gzipped file, asked for as it is: the host unpacks only what it asked to be packed.
 * const answer = await songstress.net.fetch('https://example.com/catalogue.json.gz', { responseEncoding: 'base64' })
 * const catalogue = JSON.parse(utf8Text(gunzip(base64Bytes(answer.body)))) as unknown
 * ```
 */
export function gunzip(bytes: Uint8Array): Uint8Array {
  return unpack(bytes, () => false)
}

/** What `find` reads in a gzip file's text: it is handed the text a block at
 * a time (each with the end of the one before, so nothing is cut in two),
 * one character a byte, and the first thing it finds ends the reading. Null
 * when it finds nothing. */
export function findInGzip<T>(bytes: Uint8Array, find: (text: string) => T | null): T | null {
  let found: T | null = null
  let read = 0
  unpack(bytes, (out, size) => {
    found = find(byteText(out.subarray(Math.max(0, read - OVERLAP), size)))
    read = size
    return found !== null
  })
  return found
}
