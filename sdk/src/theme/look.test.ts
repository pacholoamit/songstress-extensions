import { describe, expect, it } from 'vitest'
import { THEME_TOKENS as SCHEMA_TOKENS } from '../manifest/schema'
import { normalizeLook } from './look'
import { THEME_TOKENS } from './tokens'

describe('a look in its one form', () => {
  it('writes every colour as #rrggbb, or #rrggbbaa where the token may be translucent', () => {
    const look = {
      seed: 'hsl(36deg 89% 65%)',
      colors: { background: '#07110C', border: 'rgb(255 255 255 / 10%)', 'surface.hover': '#fff1', accent: 'rgba(245, 182, 86, 1)' },
      glow: ['#f5b556', 'rgb(63 143 99)'],
    }
    expect(normalizeLook(look)).toEqual({
      seed: '#f5b656',
      colors: { background: '#07110c', border: '#ffffff1a', 'surface.hover': '#ffffff11', accent: '#f5b656' },
      glow: ['#f5b556', '#3f8f63'],
    })
  })

  it('leaves out what a look may not hold, for an app to fill in', () => {
    const look = {
      seed: '#7fe0a080',
      colors: { text: 'rgba(250, 250, 250, 0.9)', accent: 'red', 'text.muted': 42, sidebar: '#141b24', 'accent.glow': '#ffffff' },
      glow: ['#1', '#ff464a', '#e50043', '#aa002f', '#5c0019'],
      brand: { accent: '#e50043' },
    }
    expect(normalizeLook(look)).toEqual({ colors: { sidebar: '#141b24' }, glow: ['#ff464a', '#e50043', '#aa002f'] })
  })

  it('is nothing for a value with no colour in it', () => {
    for (const look of [undefined, null, 'dark', [], {}, { colors: { accent: 'blue' } }, { glow: [] }]) expect(normalizeLook(look)).toBeUndefined()
  })

  it("names the schema's tokens", () => {
    expect([...THEME_TOKENS]).toEqual([...SCHEMA_TOKENS])
  })
})
