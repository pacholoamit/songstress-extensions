import { describe, expect, it } from 'vitest'
import { SONGSTRESS } from './base'
import { checkPlayer, checkVariant } from './check'
import { contrast, luminance, mix, over, withAlpha } from './color'
import { checkLook } from './looks'
import { resolveVariant } from './resolve'
import { pressedFill } from './rules'
import { apart } from './seed'
import type { RawVariant, ThemeVariant } from './tokens'

// The engine's own tests (feat/themes' packages/app features/themes, where
// the format began), against Songstress's own looks (base.ts).
const dark = SONGSTRESS.dark
const light = SONGSTRESS.light
const bases = { dark, light }

/** Night Garden's Greenhouse: three colours, the rest derived. */
const GREENHOUSE: RawVariant = { name: 'Greenhouse', appearance: 'dark', seed: '#7fe0a0', colors: { background: '#0a1510', text: '#f1f7f2' } }

describe('colour maths', () => {
  it('measures contrast as WCAG 2 does', () => {
    expect(contrast('#ffffff', '#000000')).toBeCloseTo(21, 5)
    // The phone's own figures (apps/native DESIGN.md, the Filled Red Rule).
    expect(contrast('#ffffff', '#ff464a')).toBeCloseTo(3.37, 2)
    expect(contrast('#ffffff', '#e50043')).toBeCloseTo(4.76, 2)
    expect(contrast('#ff464a', '#000000')).toBeCloseTo(6.23, 2)
    expect(luminance('#000000')).toBe(0)
  })

  it('mixes, fades and lays one colour over another', () => {
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080')
    expect(withAlpha('#ffffff', 0.08)).toBe('#ffffff14')
    expect(over('#ffffff14', '#000000')).toBe('#141414')
  })

  it('says how far apart two colours look, by tone and by colour', () => {
    expect(apart('#000000', '#ffffff')).toBeCloseTo(100, 0)
    expect(apart('#e50043', '#e50043')).toBe(0)
    // Yellow on white: 1.32:1 by WCAG's measure, and plainly another colour.
    expect(contrast('#fde047', '#ffffff')).toBeCloseTo(1.32, 2)
    expect(apart('#fde047', '#ffffff')).toBeGreaterThan(40)
    // Navy on black: near in tone and in colour, far under the 40 a fill must be apart (resolve.ts).
    expect(apart('#0b1020', '#000000')).toBeLessThan(20)
  })
})

describe('the resolver', () => {
  it('keeps the base where a file names nothing, dark and light', () => {
    expect(resolveVariant({ name: 'Empty', appearance: 'dark', colors: {} }, dark).colors).toEqual(dark.colors)
    expect(resolveVariant({ name: 'Empty', appearance: 'light', colors: {} }, light).colors).toEqual(light.colors)
  })

  it('derives the surfaces and the quieter text from a background and a text colour', () => {
    const variant = resolveVariant(GREENHOUSE, dark)
    const { colors } = variant
    expect(colors.surface).toBe(mix('#0a1510', '#f1f7f2', 0.08))
    expect(colors.sidebar).toBe(colors.surface)
    expect(colors.border).toBe(mix(colors.surface, '#f1f7f2', 0.12))
    expect(colors['surface.hover']).toBe('#f1f7f214')
    // The seed is the accent as written where it reads on the stage.
    expect(colors.accent).toBe('#7fe0a0')
    expect(colors['accent.fill']).toBe('#7fe0a0')
    expect(colors['accent.onFill']).toBe('#0a0a0a')
    // What the file never named and nothing derives stays the base's.
    expect(colors.danger).toBe(dark.colors.danger)
  })
})

describe('a seed', () => {
  const seeded = (seed: string, appearance: 'dark' | 'light') =>
    resolveVariant({ name: 'Seeded', appearance, seed, colors: {} }, bases[appearance])

  it('is a whole theme: the accent as written, on a stage and a text colour tinted with its hue', () => {
    const { colors, glow } = seeded('#3b82f6', 'dark')
    expect(colors.accent).toBe('#3b82f6')
    expect(glow).toEqual(['#3b82f6'])
    // A blue-black stage and a blue-white text, not the base's black and white.
    expect(colors.background).not.toBe(dark.colors.background)
    expect(luminance(colors.background)).toBeLessThan(0.02)
    expect(contrast(colors.text, colors.background)).toBeGreaterThan(14)
    const [r, g, b] = [1, 3, 5].map((at) => Number.parseInt(colors.background.slice(at, at + 2), 16))
    expect(b!).toBeGreaterThan(r!)
    expect(b!).toBeGreaterThanOrEqual(g!)
    // The surfaces come from that stage as from any file's.
    expect(colors.surface).toBe(mix(colors.background, colors.text, 0.08))
  })

  it('gives way to each colour the file writes', () => {
    const variant = resolveVariant(
      { name: 'Own stage', appearance: 'dark', seed: '#3b82f6', colors: { background: '#101010', accent: '#ffcc00' } },
      dark,
    )
    expect(variant.colors.background).toBe('#101010')
    expect(variant.colors.accent).toBe('#ffcc00')
    expect(variant.colors['accent.fill']).toBe('#ffcc00')
  })

  it('moves an accent that would not read to the nearest tone of it that does', () => {
    // Navy on a dark stage, and pale yellow on a light one: each keeps its hue.
    const navy = seeded('#1e3a8a', 'dark').colors
    expect(navy.accent).not.toBe('#1e3a8a')
    expect(contrast(navy.accent, navy.background)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(navy.accent, navy.background)).toBeLessThan(4.9)
    const yellow = seeded('#fde047', 'light').colors
    expect(contrast(yellow.accent, yellow.background)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(yellow.accent, yellow.background)).toBeLessThan(4.9)
  })

  it('fills with the seed as written where a label reads on it, though the accent had to move', () => {
    // Yellow on a light stage: as a label it darkens to read, as a fill it carries a dark label as it is.
    const { colors } = seeded('#fde047', 'light')
    expect(colors.accent).not.toBe('#fde047')
    expect(colors['accent.fill']).toBe('#fde047')
    expect(colors['accent.onFill']).toBe('#0a0a0a')
    expect(checkVariant(seeded('#fde047', 'light'))).toEqual([])
  })

  it('never fills in a colour lost in the stage: a seed near the stage’s tone and colour moves until it is seen', () => {
    // Near-black on a dark stage reads under a white label, and would be a button with no shape.
    // (A yellow on a light stage is as near in tone, and stays: it is seen by its colour, above.)
    const ink = seeded('#0b1020', 'dark').colors
    expect(ink['accent.fill']).not.toBe('#0b1020')
    expect(contrast(ink['accent.fill'], ink.background)).toBeGreaterThanOrEqual(3)
    expect(contrast(ink['accent.fill'], ink.surface)).toBeGreaterThanOrEqual(3)
    const chalk = seeded('#f4f1ea', 'light').colors
    expect(contrast(chalk['accent.fill'], chalk.background)).toBeGreaterThanOrEqual(3)
    expect(contrast(chalk['accent.fill'], chalk.surface)).toBeGreaterThanOrEqual(3)
  })

  it('gives a fill no label reads on a tone one does, pressed too', () => {
    // On #3b82f6 white is 3.68:1, and a dark label drops under 4.5:1 once the fill darkens.
    const { colors } = seeded('#3b82f6', 'dark')
    expect(colors['accent.fill']).not.toBe('#3b82f6')
    expect(checkVariant(seeded('#3b82f6', 'dark'))).toEqual([])
  })

  it('of any colour is a theme that passes every rule, dark and light', () => {
    const channel = ['00', '33', '66', '99', 'cc', 'ff']
    let checked = 0
    for (const r of channel) {
      for (const g of channel) {
        for (const b of channel) {
          for (const appearance of ['dark', 'light'] as const) {
            expect(checkVariant(seeded(`#${r}${g}${b}`, appearance)), `#${r}${g}${b} ${appearance}`).toEqual([])
            checked += 1
          }
        }
      }
    }
    expect(checked).toBe(432)
  })
})

describe('what the resolver fills in', () => {
  it('fits the stage a file names: a base colour that would not read there moves, and keeps its hue', () => {
    // A light stage darker than Songstress's own: its green and orange would be under the rule there.
    const variant = resolveVariant(
      { name: 'Paper', appearance: 'light', colors: { background: '#e8e2d4', text: '#1a1712' } },
      light,
    )
    expect(checkVariant(variant)).toEqual([])
    const { success } = variant.colors
    expect(success).not.toBe(light.colors.success)
    const [r, g, b] = [1, 3, 5].map((at) => Number.parseInt(success.slice(at, at + 2), 16))
    expect(g!).toBeGreaterThan(r!)
    expect(g!).toBeGreaterThan(b!)
    // By as little as it takes: just over the rule, not far past it.
    expect(contrast(success, variant.colors.surface)).toBeLessThan(2.1)
  })

  it('leaves a base colour that reads on the file\'s stage as it is', () => {
    const variant = resolveVariant({ name: 'Ink', appearance: 'dark', colors: { background: '#101014' } }, dark)
    for (const token of ['success', 'warning', 'danger', 'info', 'accent', 'accent.fill', 'text.muted'] as const) {
      expect(variant.colors[token]).toBe(dark.colors[token])
    }
  })

  it('never moves a colour the file wrote: the validator refuses it and says so', () => {
    const variant = resolveVariant(
      { name: 'Dim', appearance: 'dark', colors: { accent: '#3a1020', 'text.muted': '#333333' } },
      dark,
    )
    expect(variant.colors.accent).toBe('#3a1020')
    expect(variant.colors['text.muted']).toBe('#333333')
    expect(checkVariant(variant).map((p) => p.message)).toEqual([
      'text.muted on background is 1.66:1, under 4.50:1.',
      'text.muted on surface is 1.40:1, under 4.50:1.',
      'accent on background is 1.27:1, under 4.50:1.',
      'accent on surface is 1.08:1, under 3.00:1.',
    ])
  })
})

describe('the rules', () => {

  it('passes Songstress\'s own looks, the light one too', () => {
    expect(checkVariant(dark)).toEqual([])
    expect(checkVariant(light)).toEqual([])
  })

  it('holds a light look to no more than iOS\'s own light palette gives', () => {
    // System green, orange and grey on white and on the grouped grey: Songstress Light's.
    expect(contrast('#34c759', '#ffffff')).toBeCloseTo(2.22, 2)
    expect(contrast('#34c759', '#f2f2f7')).toBeCloseTo(1.99, 2)
    expect(contrast('#ff9500', '#ffffff')).toBeCloseTo(2.2, 2)
    expect(contrast('#ff9500', '#f2f2f7')).toBeCloseTo(1.97, 2)
    expect(contrast('#8e8e93', '#f2f2f7')).toBeCloseTo(2.92, 2)
    const wrong = (colors: Partial<ThemeVariant['colors']>, appearance: 'dark' | 'light') =>
      checkVariant({ ...bases[appearance], colors: { ...bases[appearance].colors, ...colors } }).map((p) => p.message)
    // A paler green than the system's is still refused on light,
    expect(wrong({ success: '#8fe3a4' }, 'light')).toEqual([
      'success on background is 1.53:1, under 1.90:1.',
      'success on surface is 1.37:1, under 1.90:1.',
    ])
    // and a dark look keeps the full rule: a status colour draws captions there too.
    expect(wrong({ warning: '#8a6a14' }, 'dark')).toEqual([
      'warning on background is 4.15:1, under 4.50:1.',
      'warning on surface is 3.50:1, under 4.50:1.',
    ])
  })

  it('holds an accent to 4.5:1 on the background and 3:1 on a surface', () => {
    const on = (accent: string) =>
      checkVariant({ ...light, colors: { ...light.colors, accent } }).map((p) => p.message)
    // Songstress Red on light: 4.76:1 on white, 4.26:1 on the grouped grey, where its label turns to the text colour.
    expect(on('#e50043')).toEqual([])
    expect(on('#ff464a')).toEqual(['accent on background is 3.37:1, under 4.50:1.'])
    expect(on('#ff9aa0')).toEqual([
      'accent on background is 2.02:1, under 4.50:1.',
      'accent on surface is 1.81:1, under 3.00:1.',
    ])
  })






  it('holds a filled accent to its label, pressed too', () => {
    const filled = (fill: string, onFill: string) =>
      checkVariant(
        resolveVariant({ name: 'Fill', appearance: 'dark', colors: { 'accent.fill': fill, 'accent.onFill': onFill } }, dark),
      ).map((p) => p.message)
    // The phone's own rule: white never sits on #ff464a.
    expect(filled('#ff464a', '#ffffff')).toEqual(['accent.onFill on accent.fill is 3.37:1, under 4.50:1.'])
    // A dark label passes at rest and fails once the fill darkens under a press it writes;
    const pressed = (fill: string, press: string, onFill: string) =>
      checkVariant(
        resolveVariant({ name: 'Fill', appearance: 'dark', colors: { 'accent.fill': fill, 'accent.fill.pressed': press, 'accent.onFill': onFill } }, dark),
      ).map((p) => p.message)
    expect(pressed('#808080', pressedFill('#808080'), '#000000')).toEqual(['accent.onFill on accent.fill.pressed is 4.00:1, under 4.50:1.'])
    // where the press is filled in, it moves to a tone the label reads on.
    expect(filled('#808080', '#000000')).toEqual([])
    expect(filled('#e50043', '#ffffff')).toEqual([])
    // To its label alone: a fill the file writes is its own, even one the stage swallows.
    expect(filled('#101012', '#ffffff')).toEqual([])
  })
})

describe('a filled accent under a press', () => {
  const resolved = (colors: RawVariant['colors']) => resolveVariant({ name: 'Press', appearance: 'dark', colors }, dark)

  it('is the fill 16% toward black where the look names no press', () => {
    const { colors } = resolved({ accent: '#ffcc00', 'accent.onFill': '#000000' })
    expect(colors['accent.fill.pressed']).toBe(pressedFill('#ffcc00'))
  })

  it('is the look’s own where it writes one, and the label is held to it', () => {
    const own = resolved({ 'accent.fill': '#88c0d0', 'accent.fill.pressed': '#7fb6c5', 'accent.onFill': '#2e3440' })
    expect(own.colors['accent.fill.pressed']).toBe('#7fb6c5')
    expect(checkVariant(own)).toEqual([])
    // Nord's frost, darkened 16%, would drop its dark label under the rule.
    const derived = resolved({ 'accent.fill': '#88c0d0', 'accent.onFill': '#2e3440' })
    expect(contrast('#2e3440', pressedFill('#88c0d0'))).toBeLessThan(4.5)
    expect(contrast('#2e3440', derived.colors['accent.fill.pressed'])).toBeGreaterThanOrEqual(4.5)
  })

  it('is refused where the look writes one no label reads on', () => {
    const variant = resolved({ 'accent.fill': '#e50043', 'accent.fill.pressed': '#ff7a8a', 'accent.onFill': '#ffffff' })
    expect(checkVariant(variant).map((p) => p.message)).toEqual(['accent.onFill on accent.fill.pressed is 2.50:1, under 4.50:1.'])
  })
})

describe('a look as an extension writes it', () => {
  it('passes with every colour written, a seed alone, or nothing but a stage and an accent', () => {
    expect(checkLook('dark', { seed: '#7fe0a0' })).toEqual([])
    expect(checkLook('light', { colors: { background: '#f6faf5', text: '#0d1a12', accent: '#1b6b43' } })).toEqual([])
    expect(checkLook('dark', { colors: dark.colors as Record<string, string>, glow: ['#ff464a'] })).toEqual([])
  })

  it('names the look a problem is in, on the stage and on the player', () => {
    const problems = checkLook('dark', { colors: { 'text.muted': '#333333' } })
    expect(problems.map((p) => p.at)).toEqual(['dark', 'dark', 'dark', 'dark'])
    expect(problems.filter((p) => p.message.includes('on the player over')).map((p) => p.message)).toEqual([
      'text.muted on the player over black artwork is 1.66:1, under 4.50:1.',
      'text.muted on the player over white artwork is 1.39:1, under 4.50:1.',
    ])
    expect(checkLook('light', { colors: { background: '#202020' } }).map((p) => [p.at, p.code])).toContainEqual(['light', 'luminance'])
  })

  it("holds the themed player's words and controls on its floor, over dark artwork and light", () => {
    // A light look whose second voice reads on its stage by a hair is lost on the player over a dark cover.
    const thin = checkLook('light', { colors: { background: '#ffffff', text: '#111111', 'text.muted': '#6a6a6a' } })
    expect(thin.map((p) => p.message)).toEqual(['text.muted on the player over black artwork is 4.33:1, under 4.50:1.'])
    // A dark look whose accent reads on its stage keeps reading on its floor over a white cover.
    expect(checkLook('dark', { colors: { background: '#0f1117', accent: '#7fd6a1' } })).toEqual([])
    // Songstress's own looks keep their own dark player; held as a theme's would be, they pass there too.
    expect([...checkVariant(dark), ...checkVariant(light), ...checkPlayer(dark), ...checkPlayer(light)]).toEqual([])
  })

  it('reads the translucent tokens in their one form, with their alpha', () => {
    expect(checkLook('dark', { colors: { border: '#ffffff1a', 'surface.hover': '#ffffff0f', accent: '#b48ead' } })).toEqual([])
  })

  it('takes nothing but the tokens: a part of the app that is not themed is not a look', () => {
    // What Songstress keeps its own (Wrapped, share cards, medals) and the player's made look are no fields of a look.
    const written = { colors: { accent: '#b48ead' }, brand: { background: '#ffffff' }, artwork: { 'text.muted': '#3a3a3a' } }
    expect(checkLook('dark', written)).toEqual([])
  })
})
