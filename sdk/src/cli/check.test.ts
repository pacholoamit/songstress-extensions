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

  it('says so when the folder holds no extension at all', async () => {
    await expect(check(folder({ 'README.md': '#' }))).rejects.toThrow(/no songstress.json/)
  })
})
