// A gzipped answer, read inside the sandbox, which has no zlib, no atob and
// no TextDecoder: base64 to bytes, gzip (RFC 1952) around deflate (RFC 1951)
// to the bytes it packed, bytes to text. The sandbox runs JavaScript slowly,
// so the reader is built for it: Huffman codes of up to ten bits are read
// from a table, and a caller that looks for one thing (a token in a web
// player's script) is handed the text a block at a time and stops the
// reading at the first block that holds it.

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
const SIXES = new Uint8Array(128).fill(64)
for (let at = 0; at < BASE64.length; at++) SIXES[BASE64.charCodeAt(at)] = at

/** The bytes a base64 text holds; anything that is not base64 is passed over. */
export function fromBase64(text: string): Uint8Array {
  const out = new Uint8Array(Math.floor((text.length * 3) / 4))
  let held = 0
  let bits = 0
  let size = 0
  for (let at = 0; at < text.length; at++) {
    const six = SIXES[text.charCodeAt(at) & 127]!
    if (six === 64) continue
    held = ((held << 6) | six) & 0xffff
    bits += 6
    if (bits < 8) continue
    bits -= 8
    out[size++] = (held >> bits) & 255
  }
  return out.subarray(0, size)
}

/** Bytes as text, one character a byte: what a token or an id is made of. */
export function bytesToText(bytes: Uint8Array): string {
  const parts: string[] = []
  for (let at = 0; at < bytes.length; at += 8192) parts.push(String.fromCharCode(...bytes.subarray(at, at + 8192)))
  return parts.join('')
}

/** Whether bytes open as a gzip file does. */
export function isGzip(bytes: Uint8Array): boolean {
  return bytes.length > 18 && bytes[0] === 0x1f && bytes[1] === 0x8b && bytes[2] === 8
}

/** The most a gzip file is unpacked to: past it, it is not a script. */
const UNPACKED_MAX = 24 * 1024 * 1024
/** How much of the text before a block is handed over with it, so a token
 * that lies across two blocks is still read whole. */
const OVERLAP = 2048

const LENGTH_BASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258]
const LENGTH_EXTRA = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0]
const DISTANCE_BASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577]
const DISTANCE_EXTRA = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13]
/** The order a dynamic block gives its code-length code's lengths in. */
const ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]

/** How many bits of a code the table answers at once. */
const FAST_BITS = 10
const FAST_MASK = (1 << FAST_BITS) - 1

/** A canonical Huffman code. `fast` answers a code of up to FAST_BITS bits
 * from the next bits of the stream: its symbol above its length, or 0 for a
 * longer code, which is then read a bit at a time from `count` (how many
 * codes there are of each length) and `symbol` (the symbols in code order). */
interface Code {
  fast: Uint16Array
  count: Uint16Array
  symbol: Uint16Array
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
    if (len > FAST_BITS) continue
    // The stream gives a code's first bit first: the table is asked by the code's bits in that order.
    let reversed = 0
    for (let bit = 0; bit < len; bit++) reversed |= ((code >> bit) & 1) << (len - 1 - bit)
    for (let index = reversed; index <= FAST_MASK; index += 1 << len) fast[index] = (at << 4) | len
  }
  return { fast, count, symbol }
}

const broken = (): Error => new Error('the gzip file does not read')

/** Where the reading stands between two blocks. */
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

/** One symbol of a code, a bit at a time: for the few a block's own
 * description is written in. */
function symbolOf(r: Reading, code: Code): number {
  let value = 0
  let first = 0
  let index = 0
  for (let len = 1; len <= 15; len++) {
    value |= take(r, 1)
    const count = code.count[len]!
    if (value - count < first) return code.symbol[index + (value - first)]!
    index += count
    first = (first + count) << 1
    value <<= 1
  }
  throw broken()
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

/** A block's literals and matches: the loop nearly all the time goes to, so
 * what it reads and writes is held in variables of its own. */
function block(r: Reading, literals: Code, distances: Code): void {
  const { bytes, out } = r
  const limit = bytes.length + 4
  const room = out.length
  const literalFast = literals.fast
  const distanceFast = distances.fast
  let { at, held, bits, size } = r
  for (;;) {
    // Two bytes past the end read as zeros: a code may end in the last one.
    while (bits < 16) {
      held |= (bytes[at++]! | 0) << bits
      bits += 8
    }
    if (at > limit) throw broken()
    let entry = literalFast[held & FAST_MASK]!
    let symbol: number
    if (entry !== 0) {
      held >>>= entry & 15
      bits -= entry & 15
      symbol = entry >>> 4
    } else {
      r.at = at
      r.held = held
      r.bits = bits
      symbol = symbolOf(r, literals)
      ;({ at, held, bits } = r)
    }
    if (symbol < 256) {
      if (size >= room) throw broken()
      out[size++] = symbol
      continue
    }
    if (symbol === 256) break
    const which = symbol - 257
    if (which >= 29) throw broken()
    while (bits < 16) {
      held |= (bytes[at++]! | 0) << bits
      bits += 8
    }
    let extra = LENGTH_EXTRA[which]!
    const length = LENGTH_BASE[which]! + (held & ((1 << extra) - 1))
    held >>>= extra
    bits -= extra
    while (bits < 16) {
      held |= (bytes[at++]! | 0) << bits
      bits += 8
    }
    entry = distanceFast[held & FAST_MASK]!
    let far: number
    if (entry !== 0) {
      held >>>= entry & 15
      bits -= entry & 15
      far = entry >>> 4
    } else {
      r.at = at
      r.held = held
      r.bits = bits
      far = symbolOf(r, distances)
      ;({ at, held, bits } = r)
    }
    if (far >= 30) throw broken()
    while (bits < 16) {
      held |= (bytes[at++]! | 0) << bits
      bits += 8
    }
    extra = DISTANCE_EXTRA[far]!
    const distance = DISTANCE_BASE[far]! + (held & ((1 << extra) - 1))
    held >>>= extra
    bits -= extra
    if (distance > size || size + length > room) throw broken()
    for (let from = size - distance, end = size + length; size < end; ) out[size++] = out[from++]!
  }
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
    if (symbol === 16 && at === 0) throw broken()
    const value = symbol === 16 ? lengths[at - 1]! : 0
    const times = symbol === 16 ? 3 + take(r, 2) : symbol === 17 ? 3 + take(r, 3) : 11 + take(r, 7)
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
 * Answers what was unpacked. Throws when the file is not gzip, or does not
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

/** What a gzip file packed, whole. */
export function gunzip(bytes: Uint8Array): Uint8Array {
  return unpack(bytes, () => false)
}

/** What `find` reads in a gzip file's text: it is handed the text a block at
 * a time (each with the end of the one before, so nothing is cut in two),
 * and the first thing it finds ends the reading. Null when it finds nothing. */
export function findInGzip<T>(bytes: Uint8Array, find: (text: string) => T | null): T | null {
  let found: T | null = null
  let read = 0
  unpack(bytes, (out, size) => {
    found = find(bytesToText(out.subarray(Math.max(0, read - OVERLAP), size)))
    read = size
    return found !== null
  })
  return found
}
