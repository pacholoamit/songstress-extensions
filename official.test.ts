// The official extensions, one folder each at the repository's root (the
// "several" layout, sdk/SPEC.md "A release"): the five ports and the three
// themes. Each manifest passes the install profile a server holds it to, is
// Songstress's own (songstress.<folder>), and passes the listing rules whole
// (its screenshots among them), so marketplace.json, which says what
// songstress.app's Marketplace shows, names every one of them and nothing
// else; each theme's looks pass the rules the apps hold a look to before
// they show it (theme/, the apps' own engine); and `songstress pack` makes
// its package the same byte for byte every time, as its release carries it.
// Bugs Music and Melon Music have no port: K-Music carries no licence, Melon
// times out and Bugs serves a bot challenge.

import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { checkLook } from '@songstress/theme/looks'
import { parseManifest, parseThemeFile } from 'songstress/manifest'
import { normalizeLook } from 'songstress/theme'
import { describe, expect, it } from 'vitest'

const here = fileURLToPath(new URL('.', import.meta.url))
/** Where the official extensions are, one folder each. */
const shelf = join(here, 'extensions')
const EXTENSIONS = readdirSync(shelf, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && readdirSync(join(shelf, entry.name)).includes('songstress.json'))
  .map((entry) => entry.name)
  .sort()
const command = join(here, 'node_modules/.bin/songstress')

/** The ids songstress.app's Marketplace shows: what the index's maker marks `marketplace: true`. */
const MARKETPLACE = JSON.parse(readFileSync(join(here, 'marketplace.json'), 'utf8')) as string[]

function packed(folder: string): Buffer {
  const out = mkdtempSync(join(tmpdir(), 'songstress-official-'))
  try {
    execFileSync(command, ['pack', join(shelf, folder), '--out', join(out, 'package.songstress')], { stdio: 'pipe' })
    return readFileSync(join(out, 'package.songstress'))
  } finally {
    rmSync(out, { recursive: true, force: true })
  }
}

/** The themes: well-known palettes, each under its MIT licence (NOTICE), and Songstress's own originals. */
const PALETTES = ['catppuccin', 'dracula', 'everforest', 'gruvbox', 'kanagawa', 'nord', 'one', 'rose-pine', 'solarized', 'tokyo-night']
const ORIGINALS = ['glacier', 'nocturne', 'studio']
const THEMES = [...PALETTES, ...ORIGINALS].sort()

describe('the official extensions', () => {
  it('are seven ports less the two that cannot be (Bugs, Melon), and the themes', () => {
    expect(EXTENSIONS.filter((folder) => !THEMES.includes(folder))).toEqual(['apple-music', 'genie-music', 'jiosaavn', 'soundcloud', 'spotify-web'])
    expect(EXTENSIONS.filter((folder) => THEMES.includes(folder))).toEqual(THEMES)
  })

  it('are what the Marketplace shows, and nothing else is', () => {
    expect([...MARKETPLACE].sort()).toEqual(EXTENSIONS.map((folder) => `songstress.${folder}`))
  })

  for (const folder of THEMES) {
    it(`${folder}: every theme file reads, and every look is one the apps would show`, () => {
      const manifest = JSON.parse(readFileSync(join(shelf, folder, 'songstress.json'), 'utf8')) as {
        contributes: { themes: { appearance: 'dark' | 'light' | 'both'; path: string }[] }
      }
      for (const theme of manifest.contributes.themes) {
        const read = parseThemeFile(readFileSync(join(shelf, folder, theme.path)), theme.appearance)
        expect(read.issues, theme.path).toEqual([])
        if (!read.valid) continue
        for (const appearance of ['dark', 'light'] as const) {
          const look = read.file[appearance]
          // Each colour in its one form, as the apps read it, then the apps' own rules.
          if (look) expect(checkLook(appearance, normalizeLook(look) ?? {}), `${theme.path}, ${appearance}`).toEqual([])
        }
      }
      // A palette's own licence comes with it; an original is Songstress's alone.
      if (PALETTES.includes(folder)) expect(readFileSync(join(shelf, folder, 'NOTICE'), 'utf8')).toMatch(/MIT License/)
      else expect(existsSync(join(shelf, folder, 'NOTICE'))).toBe(false)
    })
  }

  for (const folder of EXTENSIONS) {
    describe(folder, () => {
      const raw = readFileSync(join(shelf, folder, 'songstress.json'))
      const manifest = JSON.parse(raw.toString()) as { id: string }

      it("is Songstress's own, and passes the install profile", () => {
        expect(manifest.id).toBe(`songstress.${folder}`)
        expect(parseManifest(raw, { profile: 'install' }).issues).toEqual([])
      })

      it('passes the listing rules, and the Marketplace shows it', () => {
        expect(parseManifest(raw, { profile: 'listing' }).issues).toEqual([])
        expect(MARKETPLACE).toContain(manifest.id)
      })

      it('packs the same package every time', () => {
        expect(packed(folder).equals(packed(folder))).toBe(true)
      }, 60_000)
    })
  }
})
