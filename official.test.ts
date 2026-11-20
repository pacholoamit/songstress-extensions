// The official extensions, one folder each at the repository's root (the
// "several" layout, sdk/SPEC.md "A release"): the five ports and the three
// themes. Each manifest passes the install profile a server holds it to, is
// Songstress's own (songstress.<folder>), and would be listed once it has its
// images; each theme's looks pass the rules the apps hold a look to before
// they show it (theme/, the apps' own engine); and `songstress pack` makes
// its package the same byte for byte every time, as its release carries it.
// Bugs Music and Melon Music have no port: K-Music carries no licence, Melon
// times out and Bugs serves a bot challenge.

import { execFileSync } from 'node:child_process'
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { checkLook } from '@songstress/theme/looks'
import { parseManifest, parseThemeFile } from 'songstress/manifest'
import { normalizeLook } from 'songstress/theme'
import { describe, expect, it } from 'vitest'

const here = fileURLToPath(new URL('.', import.meta.url))
const EXTENSIONS = readdirSync(here, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && !['sdk', 'theme'].includes(entry.name) && readdirSync(join(here, entry.name)).includes('songstress.json'))
  .map((entry) => entry.name)
  .sort()
const command = join(here, 'node_modules/.bin/songstress')

/** What only a listing on the Marketplace asks, which these do not have yet:
 * the icon and screenshots, and no acquisition. */
const LISTING_ONLY = ['LISTING_FIELD_REQUIRED', 'LISTING_SCREENSHOTS', 'LISTING_ACQUISITION']

function packed(folder: string): Buffer {
  const out = mkdtempSync(join(tmpdir(), 'songstress-official-'))
  try {
    execFileSync(command, ['pack', join(here, folder), '--out', join(out, 'package.songstress')], { stdio: 'pipe' })
    return readFileSync(join(out, 'package.songstress'))
  } finally {
    rmSync(out, { recursive: true, force: true })
  }
}

/** The themes: Catppuccin's, Dracula's and Nord's palettes, each under its MIT licence (NOTICE). */
const THEMES = ['catppuccin', 'dracula', 'nord']

describe('the official extensions', () => {
  it('are seven ports less the two that cannot be (Bugs, Melon), and three themes', () => {
    expect(EXTENSIONS.filter((folder) => !THEMES.includes(folder))).toEqual(['apple-music', 'genie-music', 'jiosaavn', 'soundcloud', 'spotify-web'])
    expect(EXTENSIONS.filter((folder) => THEMES.includes(folder))).toEqual(THEMES)
  })

  for (const folder of THEMES) {
    it(`${folder}: every theme file reads, and every look is one the apps would show`, () => {
      const manifest = JSON.parse(readFileSync(join(here, folder, 'songstress.json'), 'utf8')) as {
        contributes: { themes: { appearance: 'dark' | 'light' | 'both'; path: string }[] }
      }
      for (const theme of manifest.contributes.themes) {
        const read = parseThemeFile(readFileSync(join(here, folder, theme.path)), theme.appearance)
        expect(read.issues, theme.path).toEqual([])
        if (!read.valid) continue
        for (const appearance of ['dark', 'light'] as const) {
          const look = read.file[appearance]
          // Each colour in its one form, as the apps read it, then the apps' own rules.
          if (look) expect(checkLook(appearance, normalizeLook(look) ?? {}), `${theme.path}, ${appearance}`).toEqual([])
        }
      }
      // Its palette's own licence comes with it.
      expect(readFileSync(join(here, folder, 'NOTICE'), 'utf8')).toMatch(/MIT License/)
    })
  }

  for (const folder of EXTENSIONS) {
    describe(folder, () => {
      const raw = readFileSync(join(here, folder, 'songstress.json'))
      const manifest = JSON.parse(raw.toString()) as { id: string }

      it("is Songstress's own, and passes the install profile", () => {
        expect(manifest.id).toBe(`songstress.${folder}`)
        expect(parseManifest(raw, { profile: 'install' }).issues).toEqual([])
      })

      it('would be listed once it has its images', () => {
        const left = parseManifest(raw, { profile: 'listing' }).issues.filter((issue) => !LISTING_ONLY.includes(issue.code))
        expect(left).toEqual([])
      })

      it('packs the same package every time', () => {
        expect(packed(folder).equals(packed(folder))).toBe(true)
      }, 60_000)
    })
  }
})
