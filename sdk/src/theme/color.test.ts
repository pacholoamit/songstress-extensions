import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { colorFault, MAX_COLOR_LENGTH, normalizeColor, parseColor } from './color'
import { TRANSLUCENT_TOKENS } from './tokens'

// corpus/colors.json is the contract for a theme's colours, as the manifest
// corpus is for a manifest: the Go server's reader is held to the same file
// (apps/pocketbase/internal/extensions/manifest, color_test.go).

interface ColorCorpus {
  translucent: string[]
  valid: { value: string; hex: string; note: string }[]
  invalid: { value: string; note: string }[]
}

const CORPUS = JSON.parse(readFileSync(new URL('../../corpus/colors.json', import.meta.url), 'utf8')) as ColorCorpus

describe('a colour a theme writes', () => {
  it.each(CORPUS.valid.map((entry) => [entry.value, entry] as const))('%s', (_value, entry) => {
    const color = parseColor(entry.value)
    expect(color?.hex, entry.note).toBe(entry.hex)
    expect(normalizeColor(entry.value)).toBe(entry.hex)
    // The one form keeps an alpha only below 1, and the alpha is the form's own.
    expect(color?.alpha).toBe(entry.hex.length === 9 ? Number.parseInt(entry.hex.slice(7), 16) / 255 : 1)
  })

  it.each(CORPUS.invalid.map((entry) => [JSON.stringify(entry.value), entry] as const))('refuses %s', (_value, entry) => {
    expect(parseColor(entry.value), entry.note).toBeUndefined()
    expect(colorFault(entry.value, true)).toBe('form')
  })

  it('reads its one form as itself', () => {
    for (const { hex } of CORPUS.valid) expect(normalizeColor(hex)).toBe(hex)
  })

  it('is at most 64 characters, and every valid case is within it', () => {
    expect(MAX_COLOR_LENGTH).toBe(64)
    expect(parseColor(`rgb(${' '.repeat(MAX_COLOR_LENGTH - 'rgb(0 0 0)'.length)}0 0 0)`)?.hex).toBe('#000000')
    expect(parseColor(`rgb(${' '.repeat(MAX_COLOR_LENGTH - 'rgb(0 0 0)'.length + 1)}0 0 0)`)).toBeUndefined()
  })

  it('is translucent only where its place may be, and the corpus names the same places', () => {
    expect([...TRANSLUCENT_TOKENS]).toEqual(CORPUS.translucent)
    expect(colorFault('rgb(255 255 255 / 10%)', true)).toBeUndefined()
    expect(colorFault('rgb(255 255 255 / 10%)', false)).toBe('translucent')
    expect(colorFault('#ffffffff', false)).toBeUndefined()
    expect(colorFault('rgba(0, 0, 0, 1)', false)).toBeUndefined()
  })
})
