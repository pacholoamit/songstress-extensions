import { describe, expect, it } from 'vitest'
import { bytesOf, filesIn, pairs } from '../test/corpus'
import { pick, seeded } from '../test/random'
import { MAX_MANIFEST_DEPTH, readManifest } from './scan'

const read = (text: string | Uint8Array) => {
  const result = readManifest(text)
  return result.ok ? result.value : pairs(result.issues)
}

const nested = (levels: number, open = '[', close = ']') => open.repeat(levels) + close.repeat(levels)

describe('depth', () => {
  it.each([
    ['sixteen lists', nested(MAX_MANIFEST_DEPTH), 'read'],
    ['seventeen lists', nested(MAX_MANIFEST_DEPTH + 1), 'MANIFEST_TOO_DEEP '],
    ['seventeen objects', `${'{"a":'.repeat(17)}1${'}'.repeat(17)}`, 'MANIFEST_TOO_DEEP '],
    ['lists and objects in turn', `${'[{"a":'.repeat(9)}1${'}]'.repeat(9)}`, 'MANIFEST_TOO_DEEP '],
    ['many shallow lists side by side', `[${'[[]],'.repeat(500)}[]]`, 'read'],
    ['brackets inside a string', JSON.stringify({ a: nested(40) }), 'read'],
    ['a quote escaped inside a string', JSON.stringify({ a: `"${'['.repeat(40)}` }), 'read'],
    ['a string that ends with a backslash', JSON.stringify({ a: '\\', b: nested(15) }).replace('"[', '[').replace(']"', ']'), 'read'],
    ['seventeen brackets after a string that ends with a backslash', `["\\\\",${nested(16)}]`, 'MANIFEST_TOO_DEEP '],
    ['brackets in a string that never closes', `"${'['.repeat(40)}`, 'JSON_INVALID '],
    ['closing brackets first', `${']'.repeat(40)}${nested(16)}`, 'JSON_INVALID '],
  ])('%s', (_name, text, expected) => {
    const result = read(text)
    expect(Array.isArray(result) && typeof result[0] === 'string' && result.length === 1 ? result[0] : 'read').toBe(expected)
  })
})

describe('depth, on bytes', () => {
  const bytes = (text: string) => new TextEncoder().encode(text)

  it('is counted the same as on text', () => {
    expect(read(bytes(nested(MAX_MANIFEST_DEPTH)))).toEqual(JSON.parse(nested(MAX_MANIFEST_DEPTH)))
    expect(read(bytes(nested(MAX_MANIFEST_DEPTH + 1)))).toEqual(['MANIFEST_TOO_DEEP '])
  })

  it('is counted before the bytes are decoded', () => {
    const notUtf8 = Uint8Array.from([...bytes('['.repeat(17)), 0x22, 0xff, 0x22, ...bytes(']'.repeat(17))])
    expect(read(notUtf8)).toEqual(['MANIFEST_TOO_DEEP '])
  })

  it('does not take a byte of a longer character for a bracket or a quote', () => {
    // Every byte of these characters is above 0x7F: none is a quote, a
    // bracket or a backslash, however many of them there are.
    const wide = String.fromCodePoint(0x5b57, 0x1f3b5, 0xe9).repeat(40)
    expect(read(bytes(JSON.stringify({ a: wide, b: [[]] })))).toEqual({ a: wide, b: [[]] })
  })
})

describe('duplicate keys', () => {
  it.each([
    ['at the top', '{"a":1,"a":2}', ['/a']],
    ['three times is one problem', '{"a":1,"a":2,"a":3}', ['/a']],
    ['inside an object', '{"a":{"b":1,"b":2}}', ['/a/b']],
    ['inside a list', '[{"a":1},{"a":1,"a":2}]', ['/1/a']],
    ['inside a list inside an object', '{"x":[[],[{"k":1,"k":1}]]}', ['/x/1/0/k']],
    ['written with an escape', '{"caf\\u00e9":1,"caf\u{e9}":2}', ['/caf\u{e9}']],
    ['a slash and a tilde in the key', '{"a/b~c":1,"a/b~c":2}', ['/a~1b~0c']],
    ['the empty key', '{"":1,"":2}', ['/']],
    ['a key every object has', '{"__proto__":1,"__proto__":2,"constructor":1,"constructor":2}', ['/__proto__', '/constructor']],
    ['two objects at once', '{"a":{"b":1,"b":2},"a":{"c":1}}', ['/a', '/a/b']],
    ['after a nested object closes', '{"a":{"x":1},"b":[1,2],"a":3}', ['/a']],
  ])('%s', (_name, text, pointers) => {
    expect(read(text)).toEqual(pointers.map((pointer) => `JSON_DUPLICATE_KEY ${pointer}`).sort())
  })

  it.each([
    ['the same key in two objects', '{"a":{"k":1},"b":{"k":1}}'],
    ['the same key in two items of a list', '[{"k":1},{"k":1}]'],
    ['a value equal to a key', '{"a":"a","b":"a"}'],
    ['a value equal to its own key, then that key in a nested object', '{"a":"b","b":{"a":1}}'],
    ['keys that differ by case', '{"a":1,"A":2}'],
    ['a key that looks like another once escaped twice', '{"a":1,"\\\\u0061":2}'],
    ['a string with a colon and a comma in it', '{"a":"x,\\"a\\":1","b":1}'],
  ])('%s is no duplicate', (_name, text) => {
    expect(read(text)).toEqual(JSON.parse(text))
  })
})

describe('what is not JSON', () => {
  it.each([
    ['nothing', ''],
    ['only space', '  \n'],
    ['a single quote string', "{'a':1}"],
    ['an unquoted key', '{a:1}'],
    ['NaN', '{"a":NaN}'],
    ['Infinity', '{"a":Infinity}'],
    ['a number no double holds', '{"a":1e999}'],
    ['a negative number no double holds', '[-1e999]'],
    ['a leading zero', '{"a":01}'],
    ['a line break in a string', '{"a":"x\ny"}'],
    ['two values', '{}{}'],
    ['a byte-order mark', '\u{feff}{}'],
  ])('%s', (_name, text) => {
    expect(read(text)).toEqual(['JSON_INVALID '])
  })

  it('bytes that are not UTF-8', () => {
    expect(read(new Uint8Array([0x7b, 0x22, 0xff, 0x22, 0x3a, 0x31, 0x7d]))).toEqual(['JSON_INVALID '])
    expect(read(new Uint8Array([0xef, 0xbb, 0xbf, 0x7b, 0x7d]))).toEqual(['JSON_INVALID '])
  })

  it.each([
    ['half a surrogate pair in a value', '{"a":"x' + '\\ud83c' + '"}'],
    ['the other half alone', '{"a":"' + '\\udfb5' + 'x"}'],
    ['half a surrogate pair in a key', '{"' + '\\ud800' + '":1}'],
    ['the replacement character, written out', `{"a":"${String.fromCodePoint(0xfffd)}"}`],
    ['the replacement character, as an escape', '{"a":"' + '\\ufffd' + '"}'],
    ['a damaged text deep inside', '{"a":[{"b":["ok","' + '\\ud83c' + '"]}]}'],
  ])('text that is not whole Unicode: %s', (_name, text) => {
    expect(() => JSON.parse(text)).not.toThrow()
    expect(read(text)).toEqual(['JSON_INVALID '])
  })

  it('takes what JSON takes, however odd', () => {
    expect(read('{"a":1e-999,"b":-0,"c":"\\ud83c\\udfb5","d":[]}')).toEqual({ a: 0, b: -0, c: '\u{1f3b5}', d: [] })
    expect(read(new TextEncoder().encode('  [1, 2]  '))).toEqual([1, 2])
  })
})

describe('any text at all', () => {
  // In what JSON.stringify writes: an overflowed number is "null", half a
  // surrogate pair is an escape, U+FFFD is itself.
  const DAMAGED = /null|\\u[dD][89a-fA-F]|\u{fffd}/u
  const NOISE = ['{', '}', '[', ']', '"', '\\', ',', ':', ' ', '\n', 'a', '1', '\\u0061', 'null', '\u{e9}', '\u{1f3b5}']

  it('is read or refused, never thrown at: 4,000 cut, spliced and noisy manifests', () => {
    const random = seeded(20261117)
    const sources = [...filesIn('valid'), ...filesIn('invalid')].map((file) => bytesOf(file))
    for (let round = 0; round < 4000; round += 1) {
      const text = new TextDecoder().decode(pick(random, sources))
      const at = Math.floor(random() * text.length)
      const noise = Array.from({ length: Math.floor(random() * 4) }, () => pick(random, NOISE)).join('')
      const mangled = random() < 0.5 ? text.slice(0, at) + noise : text.slice(0, at) + noise + text.slice(at + 1)
      const result = readManifest(mangled)
      let parsed: unknown
      let isJson = true
      try {
        parsed = JSON.parse(mangled)
      } catch {
        isJson = false
      }
      // Read means JSON read the same. Refused as not JSON means JSON refused
      // it too, or it holds what the reader alone refuses: a number that
      // overflowed, or text that is not whole Unicode.
      if (result.ok) expect(result.value).toEqual(parsed)
      else if (pairs(result.issues)[0] === 'JSON_INVALID ' && isJson) expect(JSON.stringify(parsed), mangled).toMatch(DAMAGED)
    }
  })
})
