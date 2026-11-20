// The official extensions, one folder each at the repository's root (the
// "several" layout, sdk/SPEC.md "A release"): each manifest passes the
// install profile a server holds it to, is Songstress's own
// (songstress.<folder>), and would be listed once it has its images; and
// `songstress pack` makes its package the same byte for byte every time,
// as its release carries it. Bugs Music and Melon Music have no port: K-Music
// carries no licence, Melon times out and Bugs serves a bot challenge.

import { execFileSync } from 'node:child_process'
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseManifest } from 'songstress/manifest'
import { describe, expect, it } from 'vitest'

const here = fileURLToPath(new URL('.', import.meta.url))
const PORTS = readdirSync(here, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name !== 'sdk' && readdirSync(join(here, entry.name)).includes('songstress.json'))
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

describe('the official extensions', () => {
  it('are seven ports less the two that cannot be (Bugs, Melon)', () => {
    expect(PORTS).toEqual(['apple-music', 'genie-music', 'jiosaavn', 'soundcloud', 'spotify-web'])
  })

  for (const folder of PORTS) {
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
