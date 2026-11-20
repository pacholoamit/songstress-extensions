import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { check, report } from './check.ts'

// `songstress check` over both ways a repository holds extensions: one at
// its root, or several, one folder each.

const made: string[] = []
afterEach(() => {
  for (const root of made.splice(0)) rmSync(root, { recursive: true, force: true })
})

function manifest(id: string, more: Record<string, unknown> = {}): string {
  return JSON.stringify({
    manifestVersion: 1,
    id,
    name: id.split('.')[1],
    version: '1.0.0',
    description: 'For the tests of songstress check.',
    engines: { songstress: '^0.1.0' },
    entry: { server: 'dist/server.js' },
    permissions: { providers: { reason: 'Answer searches beside Songstress’s own.' } },
    contributes: { providers: { search: [{ id: 'tunes', types: ['track'] }] } },
    ...more,
  })
}

/** A folder holding these files, each path's text. */
function folder(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'songstress-check-'))
  made.push(root)
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(root, path, '..'), { recursive: true })
    writeFileSync(join(root, path), text)
  }
  return root
}

describe('songstress check', () => {
  it('checks the one extension at a root, released on its version', async () => {
    const root = folder({ 'songstress.json': manifest('acme.tunelog') })
    const found = await check(root)
    expect(found.layout).toBe('one')
    expect(report(root, found)).toEqual({
      lines: ['ok    .: acme.tunelog 1.0.0, released as v1.0.0 with acme.tunelog-1.0.0.songstress'],
      ok: true,
    })
  })

  it('checks each extension of a repository of several, each released on id@version', async () => {
    const root = folder({
      'tunelog/songstress.json': manifest('acme.tunelog'),
      'chimes/songstress.json': manifest('acme.chimes'),
      'shared/http.ts': 'export {}',
      'node_modules/x/songstress.json': manifest('acme.never'),
    })
    const found = await check(root)
    expect(found.layout).toBe('several')
    expect(report(root, found).lines).toEqual([
      'ok    chimes: acme.chimes 1.0.0, released as acme.chimes@1.0.0 with acme.chimes-1.0.0.songstress',
      'ok    tunelog: acme.tunelog 1.0.0, released as acme.tunelog@1.0.0 with acme.tunelog-1.0.0.songstress',
    ])
  })

  it.each([
    ['a .git above it', { '.git/HEAD': 'ref: refs/heads/main\n' }],
    ['the .git file of a worktree above it', { '.git': 'gitdir: /elsewhere/.git/worktrees/tools\n' }],
    ['no git, but workspaces above it', { 'package.json': JSON.stringify({ private: true, workspaces: ['*.*'] }) }],
    ['no git, but a pnpm workspace above it', { 'pnpm-workspace.yaml': "packages:\n  - '*.*'\n" }],
  ])('names the release <id>@<version> when run in one extension’s folder of a repository of several (%s)', async (_what, around) => {
    const root = folder({ ...around, 'acme.tunelog/songstress.json': manifest('acme.tunelog') })
    const found = await check(join(root, 'acme.tunelog'))
    expect(found.layout).toBe('several')
    expect(report(join(root, 'acme.tunelog'), found).lines).toEqual([
      'ok    .: acme.tunelog 1.0.0, released as acme.tunelog@1.0.0 with acme.tunelog-1.0.0.songstress',
    ])
  })

  it.each([
    ['whose workspaces hold them', { 'pnpm-workspace.yaml': "packages:\n  - 'extensions'\n" }],
    ['with no workspaces at all', {}],
  ])('names the release <id>@<version> two folders down too, in a repository %s', async (_what, around) => {
    const root = folder({ '.git/HEAD': 'ref: refs/heads/main\n', ...around, 'extensions/soundcloud/songstress.json': manifest('acme.soundcloud') })
    expect((await check(join(root, 'extensions/soundcloud'))).layout).toBe('several')
  })

  it('takes a folder for a repository of one when it is its repository’s root, or stands beside others with no repository', async () => {
    const repository = folder({ '.git/HEAD': 'ref: refs/heads/main\n', 'songstress.json': manifest('acme.tunelog') })
    expect((await check(repository)).layout).toBe('one')
    // Two repositories of one side by side, before either has git: neither is the other's.
    const side = folder({ 'tunelog/songstress.json': manifest('acme.tunelog'), 'chimes/songstress.json': manifest('acme.chimes') })
    expect((await check(join(side, 'tunelog'))).layout).toBe('one')
  })

  it('does not take a home folder kept in git for a repository of several, however its path is written', async () => {
    const home = folder({ '.git/HEAD': 'ref: refs/heads/main\n', '.zshrc': '', 'code/tunelog/songstress.json': manifest('acme.tunelog') })
    const link = `${home}-link`
    symlinkSync(home, link)
    made.push(link)
    for (const written of [home, `${home}/`, link]) {
      expect((await check(join(home, 'code/tunelog'), 'install', written)).layout, written).toBe('one')
    }
    // The same tree anywhere else is a repository that holds the extension two folders down.
    expect((await check(join(home, 'code/tunelog'), 'install', '/home/someone-else')).layout).toBe('several')
  })

  it('names the release <id>@<version> in a monorepo before its git, by the workspaces above', async () => {
    const root = folder({ 'mono/pnpm-workspace.yaml': "packages:\n  - 'packages/*'\n", 'mono/packages/tunelog/songstress.json': manifest('acme.tunelog') })
    expect((await check(join(root, 'mono/packages/tunelog'))).layout).toBe('several')
  })

  it('fails a manifest the server would refuse, and an id held twice', async () => {
    const root = folder({
      'one/songstress.json': manifest('acme.tunelog'),
      'two/songstress.json': manifest('acme.tunelog'),
      'broken/songstress.json': manifest('Acme Tunelog'),
    })
    const { lines, ok } = report(root, await check(root))
    expect(ok).toBe(false)
    expect(lines[0]).toBe('fails broken')
    expect(lines[1]).toMatch(/^ {8}\S+ \/id: /)
    expect(lines).toContain('fails two: acme.tunelog')
    expect(lines.at(-1)).toMatch(/ID_TWICE \/id: acme.tunelog is the id of one too/)
  })

  it('asks what a listing needs on top with the listing profile', async () => {
    const root = folder({ 'songstress.json': manifest('acme.tunelog') })
    const { lines, ok } = report(root, await check(root, 'listing'))
    expect(ok).toBe(false)
    expect(lines.join('\n')).toContain('LISTING_FIELD_REQUIRED /icon')
  })

  describe('a theme', () => {
    const themed = (themes: unknown[]) =>
      JSON.stringify({
        manifestVersion: 1,
        id: 'acme.dusk',
        name: 'Dusk',
        version: '1.0.0',
        description: 'For the tests of songstress check.',
        engines: { songstress: '^0.1.3' },
        contributes: { themes },
      })
    const linesOf = async (files: Record<string, string>) => {
      const root = folder(files)
      return report(root, await check(root))
    }

    it('passes with looks the apps would show, written in the manifest or in its file, in any form of colour', async () => {
      const file = JSON.stringify({ dark: { seed: 'hsl(141 61% 69%)' }, light: { colors: { accent: 'rgb(27 107 67)', border: '#0d1a121f' } } })
      const { lines, ok } = await linesOf({
        'songstress.json': themed([
          { id: 'dusk', label: 'Dusk', appearance: 'dark', dark: { colors: { background: '#0a1510', accent: '#f5b556' } } },
          { id: 'garden', label: 'Garden', appearance: 'both', path: 'themes/garden.json' },
        ]),
        'themes/garden.json': file,
      })
      expect(lines).toEqual(['ok    .: acme.dusk 1.0.0, released as v1.0.0 with acme.dusk-1.0.0.songstress'])
      expect(ok).toBe(true)
    })

    it('fails a look an app would not show, at the look, and says by how much', async () => {
      const { lines, ok } = await linesOf({
        'songstress.json': themed([
          { id: 'dim', label: 'Dim', appearance: 'dark', dark: { colors: { 'text.muted': 'rgb(51 51 51)' } } },
          { id: 'glare', label: 'Glare', appearance: 'dark', dark: { colors: { background: 'hsl(0 0% 87%)' } } },
        ]),
      })
      expect(ok).toBe(false)
      expect(lines).toContain('        THEME_CONTRAST /contributes/themes/0/dark: text.muted on background is 1.66:1, under 4.50:1.')
      expect(lines.some((line) => line.startsWith('        THEME_LUMINANCE /contributes/themes/1/dark: '))).toBe(true)
    })

    it('fails a colour of no form, or a translucent one where its place is opaque, at the colour', async () => {
      const { lines, ok } = await linesOf({
        'songstress.json': themed([
          { id: 'haze', label: 'Haze', appearance: 'dark', dark: { colors: { text: 'rgba(250, 250, 250, 0.9)', accent: 'rgb(300, 70, 74)' } } },
        ]),
      })
      expect(ok).toBe(false)
      expect(lines).toContain('        THEME_COLOR_ALPHA /contributes/themes/0/dark/colors/text: "text" is translucent: only border and surface.hover may be.')
      expect(lines.some((line) => line.startsWith('        THEME_COLOR /contributes/themes/0/dark/colors/accent: "rgb(300, 70, 74)" is not a colour'))).toBe(true)
    })

    it("fails a theme file the server would refuse, or a look in it, at the theme's path", async () => {
      const { lines } = await linesOf({
        'songstress.json': themed([
          { id: 'paper', label: 'Paper', appearance: 'light', path: 'paper.json' },
          { id: 'glare', label: 'Glare', appearance: 'dark', path: 'glare.json' },
          { id: 'gone', label: 'Gone', appearance: 'dark', path: 'gone.json' },
        ]),
        'paper.json': JSON.stringify({ light: { colors: { accent: 'e50043' } } }),
        'glare.json': JSON.stringify({ dark: { colors: { background: '#dddddd' } } }),
      })
      expect(lines.some((line) => line.startsWith('        SCHEMA_PATTERN /contributes/themes/0/path: paper.json at /light/colors/accent: "e50043" is not in the form asked here. Expected: A colour: #RGB,'))).toBe(true)
      expect(lines.some((line) => line.startsWith('        THEME_LUMINANCE /contributes/themes/1/path: glare.json, dark: '))).toBe(true)
      expect(lines).toContain("        THEME_FILE_MISSING /contributes/themes/2/path: The theme names gone.json, which is not in the extension's folder.")
    })
  })

  it('says so when the folder holds no extension at all', async () => {
    await expect(check(folder({ 'README.md': '#' }))).rejects.toThrow(/no songstress.json/)
  })
})
