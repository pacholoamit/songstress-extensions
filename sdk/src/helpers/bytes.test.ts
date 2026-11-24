import { describe, expect, it } from 'vitest'
import { base64Bytes, base64Text, byteText, utf8Text } from './bytes'

const bytesOf = (text: string) => [...new TextEncoder().encode(text)]

describe('base64Bytes', () => {
  it('reads both alphabets, with or without padding, past anything that is not base64', () => {
    const bytes = Uint8Array.from({ length: 256 }, (_, at) => at)
    const standard = Buffer.from(bytes).toString('base64')
    expect(base64Bytes(standard)).toEqual(bytes)
    expect(base64Bytes(Buffer.from(bytes).toString('base64url'))).toEqual(bytes)
    expect(base64Bytes(standard.replace(/=+$/, ''))).toEqual(bytes)
    expect(base64Bytes(standard.replace(/(.{76})/g, '$1\r\n'))).toEqual(bytes)
    // A character past ASCII is no base64 character, not one of the alphabet's.
    expect(base64Bytes('QUÁJD')).toEqual(base64Bytes('QUJD'))
    expect(base64Bytes('')).toEqual(new Uint8Array(0))
  })
})

describe('utf8Text', () => {
  it('reads every length of sequence, from an array or from bytes', () => {
    const text = 'A é ♫ 𝄞 아이유'
    expect(utf8Text(bytesOf(text))).toBe(text)
    expect(utf8Text(new TextEncoder().encode(text))).toBe(text)
  })

  it('reads what is not UTF-8 as U+FFFD and never throws', () => {
    expect(utf8Text([0x41, 0x80, 0x42])).toBe('A�B')
    // Overlong forms: U+0000 in two bytes, U+002F in three, U+FFFF in four.
    expect(utf8Text([0xc0, 0x80])).toBe('�')
    expect(utf8Text([0xe0, 0x80, 0xaf])).toBe('�')
    expect(utf8Text([0xf0, 0x8f, 0xbf, 0xbf])).toBe('�')
    expect(utf8Text([0xc2, 0x80, 0xe0, 0xa0, 0x80, 0xf0, 0x90, 0x80, 0x80])).toBe('\u0080\u0800\u{10000}')
    expect(utf8Text([0xe2, 0x99])).toBe('��')
    expect(utf8Text([0xe2, 0x41, 0x42])).toBe('�AB')
    expect(utf8Text([0xf7, 0xbf, 0xbf, 0xbf])).toBe('�')
    expect(utf8Text([0xed, 0xa0, 0x80])).toBe('�')
    expect(utf8Text([0xff, 0x41])).toBe('�A')
  })

  it('reads a text longer than one call to String.fromCodePoint takes', () => {
    const long = 'é'.repeat(100_000)
    expect(utf8Text(new TextEncoder().encode(long))).toBe(long)
  })
})

describe('base64Text and byteText', () => {
  it("read a token's claims, and bytes one character each", () => {
    const claims = Buffer.from(JSON.stringify({ exp: 1_900_000_000, name: 'Amélie' })).toString('base64url')
    expect(JSON.parse(base64Text(claims))).toEqual({ exp: 1_900_000_000, name: 'Amélie' })
    expect(byteText(new TextEncoder().encode('eyJhbGciOi.abc_DEF-123'))).toBe('eyJhbGciOi.abc_DEF-123')
    expect(byteText(new Uint8Array(20_000).fill(0x61))).toBe('a'.repeat(20_000))
  })
})
