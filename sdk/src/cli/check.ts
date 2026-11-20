// `songstress check [folder] [--profile install|listing]`: the manifest of
// each extension a folder holds, checked as a server checks it when it
// installs one (or, with --profile listing, as the Marketplace checks a
// listing), its themes held to the rules the apps hold a look to before they
// show it (SPEC.md, section 12), and what its release is called. A folder holds one extension,
// songstress.json at its root, or several, each in a folder of its own of
// any name (`<folder>/songstress.json`, release.ts), each id once. Run in
// one extension's folder of a repository of several, it names that
// extension's release as the repository's: <id>@<version>.

import { readdir, readFile, realpath, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { assetName, releaseTag, type Layout } from './release.ts'
import { type CheckedTheme, type Checks, loadValidator } from './validator.ts'

const MANIFEST = 'songstress.json'

/** One finding: the SDK's code, where in the manifest, and a sentence. */
export interface Finding {
  readonly code: string
  readonly pointer: string
  readonly message: string
}

/** One extension checked: its folder, its id and version when the manifest
 * reads, and what was found. */
export interface Checked {
  readonly folder: string
  readonly id?: string
  readonly version?: string
  readonly issues: readonly Finding[]
}

async function isFile(path: string): Promise<boolean> {
  return stat(path).then(
    (found) => found.isFile(),
    () => false,
  )
}

async function exists(path: string): Promise<boolean> {
  return stat(path).then(
    () => true,
    () => false,
  )
}

/** The folders of a folder that hold a manifest (none hidden, no node_modules), sorted. */
async function manifestFolders(root: string): Promise<string[]> {
  const folders: string[] = []
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const folder = join(root, entry.name)
    if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules' && (await isFile(join(folder, MANIFEST)))) {
      folders.push(folder)
    }
  }
  return folders.sort()
}

/** The nearest folder from this one up that holds a .git: a folder, or the file of a worktree. */
async function repositoryOf(folder: string): Promise<string | undefined> {
  for (let at = folder; ; at = dirname(at)) {
    if (await exists(join(at, '.git'))) return at
    if (dirname(at) === at) return undefined
  }
}

/** Whether a folder names workspaces: package.json's `workspaces`, or a pnpm-workspace.yaml. */
async function declaresWorkspaces(folder: string): Promise<boolean> {
  if (await isFile(join(folder, 'pnpm-workspace.yaml'))) return true
  try {
    return (JSON.parse(await readFile(join(folder, 'package.json'), 'utf8')) as { workspaces?: unknown }).workspaces !== undefined
  } catch {
    return false
  }
}

/** A path as the file system has it: symbolic links followed, no trailing separator. */
const real = (path: string) => realpath(path).catch(() => resolve(path))

/** Whether a folder with songstress.json at its root is one extension of a repository of several. A repository
 * of one has its manifest at the repository's root (SPEC.md, "A release"); the repository is the nearest folder
 * from here up with a .git, however deep the extension sits in it. But not the home folder (`home`, as the file
 * system has it): one kept in git for its dotfiles is no repository of extensions, and an extension in it has no
 * git of its own yet. With no repository, a folder above that names workspaces, up to the home folder, makes it
 * one of several, as a repository of several that create-songstress-extension starts does, or a monorepo before
 * its git: folders that merely stand side by side (two repositories of one in ~/code) are not several. */
async function oneOfSeveral(folder: string, home: string): Promise<boolean> {
  const found = await repositoryOf(folder)
  if (found !== undefined && (await real(found)) !== home) return found !== folder
  for (let at = dirname(folder); at !== dirname(at) && (await real(at)) !== home; at = dirname(at)) {
    if (await declaresWorkspaces(at)) return true
  }
  return false
}

/** The extensions the folder holds, and how: [root] for one (one of several when it is a folder of a repository
 * of several), its folders with a manifest for several. */
async function extensionFolders(root: string, home: string): Promise<{ layout: Layout; folders: string[] }> {
  if (await isFile(join(root, MANIFEST))) return { layout: (await oneOfSeveral(root, home)) ? 'several' : 'one', folders: [root] }
  return { layout: 'several', folders: await manifestFolders(root) }
}

/** A theme's looks: written in its manifest, or read from its file (each of the file's problems a finding at the
 * theme's `path`, naming the file); nothing when the file cannot be read. */
async function looksOf(folder: string, theme: CheckedTheme, at: string, checks: Checks, found: Finding[]) {
  if (theme.path === undefined) return theme
  const where = `${at}/path`
  const bytes = await readFile(join(folder, theme.path)).catch(() => undefined)
  if (bytes === undefined) {
    found.push({ code: 'THEME_FILE_MISSING', pointer: where, message: `The theme names ${theme.path}, which is not in the extension's folder.` })
    return undefined
  }
  const read = checks.readThemeFile(bytes, theme.appearance)
  if (read.valid) return read.file
  for (const issue of read.issues) {
    found.push({ code: issue.code, pointer: where, message: `${theme.path}${issue.pointer ? ` at ${issue.pointer}` : ''}: ${issue.message}` })
  }
  return undefined
}

/** One look's problems under the apps' rules as findings: THEME_CONTRAST or THEME_LUMINANCE, at the look where
 * the manifest writes it, at the theme's `path`, naming the file and the look, where its file does. The look is
 * read as the apps read it, each colour in its one form. */
function lookFindings(theme: CheckedTheme, at: string, appearance: 'dark' | 'light', look: object, checks: Checks): Finding[] {
  return checks.checkLook(appearance, checks.normalizeLook(look) ?? {}).map((problem) => {
    const code = problem.code === 'luminance' ? 'THEME_LUMINANCE' : 'THEME_CONTRAST'
    if (theme.path === undefined) return { code, pointer: `${at}/${problem.at}`, message: problem.message }
    return { code, pointer: `${at}/path`, message: `${theme.path}, ${problem.at}: ${problem.message}` }
  })
}

/** Each theme's looks held to the apps' rules: what an app would not show, or a file it could not read. */
async function themeFindings(folder: string, themes: readonly CheckedTheme[], checks: Checks): Promise<Finding[]> {
  const found: Finding[] = []
  for (const [index, theme] of themes.entries()) {
    const at = `/contributes/themes/${index}`
    const looks = await looksOf(folder, theme, at, checks, found)
    for (const appearance of ['dark', 'light'] as const) {
      const look = looks?.[appearance]
      if (look !== undefined) found.push(...lookFindings(theme, at, appearance, look, checks))
    }
  }
  return found
}

/** Each extension the folder holds, checked under the profile. `home` is the person's home folder, which is
 * never a repository of extensions (oneOfSeveral). */
export async function check(root: string, profile = 'install', home = homedir()): Promise<{ layout: Layout; checked: Checked[] }> {
  const { layout, folders } = await extensionFolders(root, await real(home))
  if (folders.length === 0) throw new Error(`There is no ${MANIFEST} in ${root}, nor in a folder of it.`)
  const checks = await loadValidator()
  const owners = new Map<string, string>()
  const checked: Checked[] = []
  for (const folder of folders) {
    const result = checks.validate(await readFile(join(folder, MANIFEST)), { profile })
    if (!result.valid) {
      checked.push({ folder, issues: result.issues })
      continue
    }
    const { id, version } = result.manifest
    const issues: Finding[] = await themeFindings(folder, result.manifest.contributes?.themes ?? [], checks)
    const owner = owners.get(id)
    if (owner !== undefined) {
      issues.push({ code: 'ID_TWICE', pointer: '/id', message: `${id} is the id of ${relative(root, owner) || '.'} too: a repository holds each extension once.` })
    }
    owners.set(id, folder)
    checked.push({ folder, id, version, issues })
  }
  return { layout, checked }
}

/** The command's lines for what check found, and whether all of it passed. */
export function report(root: string, { layout, checked }: { layout: Layout; checked: Checked[] }): { lines: string[]; ok: boolean } {
  const lines: string[] = []
  for (const { folder, id, version, issues } of checked) {
    const where = relative(root, folder) || '.'
    if (issues.length === 0 && id !== undefined && version !== undefined) {
      lines.push(`ok    ${where}: ${id} ${version}, released as ${releaseTag(id, version, layout)} with ${assetName(id, version)}`)
      continue
    }
    lines.push(`fails ${where}${id ? `: ${id}` : ''}`)
    for (const issue of issues) lines.push(`        ${issue.code} ${issue.pointer || '/'}: ${issue.message}`)
  }
  return { lines, ok: checked.every((one) => one.issues.length === 0) }
}
