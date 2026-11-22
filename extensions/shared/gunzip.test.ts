// The sandbox's own gunzip against Node's zlib: every kind of deflate block,
// a header with its optional parts, and what does not read.

import { deflateRawSync, gzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { bytesToText, findInGzip, fromBase64, gunzip, isGzip } from './gunzip'

/** Bytes that repeat (long matches) and bytes that do not (literals), from a seed. */
function sample(size: number, seed: number): Uint8Array {
  const out = new Uint8Array(size)
  let state = seed
  for (let at = 0; at < size; at++) {
    state = (state * 1103515245 + 12345) & 0x7fffffff
    out[at] = at % 97 < 60 ? 97 + (at % 23) : state >> 16
  }
  return out
}

describe('gunzip', () => {
  it.each([
    ['nothing', new Uint8Array(0), {}],
    ['a short text, in a fixed block', new TextEncoder().encode('client_id:"0123456789abcdef0123456789abcdef"'), {}],
    ['a megabyte and a half, in dynamic blocks', sample(1_500_000, 7), {}],
    ['bytes kept as they are, in stored blocks', sample(200_000, 11), { level: 0 }],
    ['the best packing', sample(300_000, 13), { level: 9 }],
  ])('unpacks %s', (_name, plain, options) => {
    const packed = new Uint8Array(gzipSync(plain, options))
    expect(isGzip(packed)).toBe(true)
    expect(Buffer.from(gunzip(packed)).equals(Buffer.from(plain))).toBe(true)
  })

  it('reads past a header that names its file and carries a comment and extra bytes', () => {
    const plain = new TextEncoder().encode('a script, named')
    const header = [0x1f, 0x8b, 8, 4 | 8 | 16, 0, 0, 0, 0, 0, 3, 2, 0, 9, 9, ...new TextEncoder().encode('a.js'), 0, ...new TextEncoder().encode('note'), 0]
    const packed = new Uint8Array([...header, ...deflateRawSync(plain), 0, 0, 0, 0, plain.length, 0, 0, 0])
    expect(bytesToText(gunzip(packed))).toBe('a script, named')
  })

  it('refuses what is not gzip, and a file cut short', () => {
    expect(isGzip(new TextEncoder().encode('n.exports={client_id:"x"}, a script as it is'))).toBe(false)
    expect(() => gunzip(new Uint8Array(40))).toThrow('does not read')
    const packed = new Uint8Array(gzipSync(sample(50_000, 3)))
    expect(() => gunzip(packed.subarray(0, packed.length - 2000))).toThrow('does not read')
  })

  it('finds a token a block at a time, stops reading at the block that holds it, and misses none cut across two', () => {
    const token = 'eyJhbGciOiJFUzI1NiJ9.abc_DEF-123.c2ln'
    const filler = (size: number, seed: number) => Buffer.from(sample(size, seed)).toString('latin1').replace(/e/g, 'f')
    const find = (text: string) => /eyJ[\w-]+\.[\w-]+\.[\w-]+/.exec(text)?.[0] ?? null
    // Early in three megabytes: found without reading the rest.
    let asked = 0
    const early = new Uint8Array(gzipSync(Buffer.from(`${filler(200_000, 1)}"${token}"${filler(2_800_000, 2)}`, 'latin1')))
    expect(findInGzip(early, (text) => (asked++, find(text)))).toBe(token)
    let whole = 0
    expect(findInGzip(early, () => (whole++, null))).toBeNull()
    expect(asked).toBeLessThan(whole)
    // Wherever it lies, a block's edge among the places.
    for (const before of [0, 30_000, 65_535, 65_536, 131_071, 500_000]) {
      const packed = new Uint8Array(gzipSync(Buffer.from(`${filler(before, 3)}"${token}"${filler(100_000, 4)}`, 'latin1'), { level: 0 }))
      expect(findInGzip(packed, find), String(before)).toBe(token)
    }
  })

  it('reads base64 as the host writes it, and bytes as text', () => {
    const bytes = sample(1000, 5)
    expect(Buffer.from(fromBase64(Buffer.from(bytes).toString('base64'))).equals(Buffer.from(bytes))).toBe(true)
    expect(bytesToText(new TextEncoder().encode('eyJhbGciOi.abc_DEF-123'))).toBe('eyJhbGciOi.abc_DEF-123')
  })
})
