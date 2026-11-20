// What a package holds, taken from an extension's folder: songstress.json,
// every file it names (the entries, the images, the theme files, the views),
// and the documents at its root (README, LICENSE, NOTICE, CHANGELOG and the
// like). Nothing else: no source, no node_modules, no lockfile. The server
// checks the manifest and every file (SPEC.md, sections 3 and 12); this
// reads the manifest only for the paths it names, and refuses a path that
// leaves the folder or a file that is a link, as the server would.

import { lstat, readdir, readFile } from 'node:fs/promises'
import { isAbsolute, join, relative, resolve } from 'node:path'
import { type PackedFile, zipArchive } from './zip.ts'

const MANIFEST = 'songstress.json'
export const ARCHIVE_SUFFIX = '.songstress'

const DOCS = ['LICENSE', 'LICENCE', 'NOTICE', 'COPYING', 'README', 'CHANGELOG', 'AUTHORS']

/** A path the manifest names, read loosely: the server holds it to the schema. */
interface Named {
  readonly path?: unknown
}

/** The parts of a manifest that name files. */
export interface Manifest {
  readonly id?: unknown
  readonly version?: unknown
  readonly entry?: { readonly server?: unknown; readonly client?: unknown }
  readonly icon?: Named
  readonly banner?: Named
  readonly screenshots?: readonly Named[]
  readonly contributes?: { readonly themes?: readonly Named[]; readonly views?: readonly Named[] }
}

/** Why a package could not be made: a sentence for the person making it. */
export class PackError extends Error {
  override readonly name = 'PackError'
}

export async function readManifest(folder: string): Promise<Manifest> {
  const text = await readFile(join(folder, MANIFEST), 'utf8').catch(() => {
    throw new PackError(`There is no ${MANIFEST} in ${folder}.`)
  })
  try {
    return JSON.parse(text) as Manifest
  } catch {
    throw new PackError(`${MANIFEST} is not JSON.`)
  }
}

const text = (value: unknown): string[] => (typeof value === 'string' && value !== '' ? [value] : [])

/** The paths of the files the manifest names. */
function namedPaths(manifest: Manifest): string[] {
  const paths = (list: readonly Named[] | undefined) => (Array.isArray(list) ? list.flatMap((item) => text(item?.path)) : [])
  return [
    ...text(manifest.entry?.server),
    ...text(manifest.entry?.client),
    ...text(manifest.icon?.path),
    ...text(manifest.banner?.path),
    ...paths(manifest.screenshots),
    ...paths(manifest.contributes?.themes),
    ...paths(manifest.contributes?.views),
  ]
}

const isDoc = (name: string) => DOCS.includes(name.toUpperCase().replace(/\.(MD|TXT)$/, ''))

/** The package's files, each read from inside the folder. */
export async function packageFiles(folder: string): Promise<PackedFile[]> {
  const manifest = await readManifest(folder)
  const root = await readdir(folder, { withFileTypes: true })
  const docs = root.filter((entry) => entry.isFile() && isDoc(entry.name)).map((entry) => entry.name)
  const paths = [...new Set([MANIFEST, ...namedPaths(manifest), ...docs])]
  return Promise.all(paths.map(async (path) => ({ path, data: await readInside(folder, path) })))
}

async function readInside(folder: string, path: string): Promise<Uint8Array> {
  const base = resolve(folder)
  const full = resolve(base, path)
  const inside = relative(base, full)
  if (inside === '' || inside.startsWith('..') || isAbsolute(inside)) {
    throw new PackError(`The manifest names ${JSON.stringify(path)}, which is not inside the package.`)
  }
  const info = await lstat(full).catch(() => {
    throw new PackError(`The manifest names ${JSON.stringify(path)}, which is not there. Build it first?`)
  })
  if (!info.isFile()) {
    throw new PackError(`${JSON.stringify(path)} is not a file (a link or a folder): a package holds files only.`)
  }
  return new Uint8Array(await readFile(full))
}

/** The archive's file name: <id>-<version>.songstress. */
function archiveName(manifest: Manifest): string {
  const id = typeof manifest.id === 'string' ? manifest.id : 'extension'
  const version = typeof manifest.version === 'string' ? manifest.version : '0.0.0'
  return `${id}-${version}${ARCHIVE_SUFFIX}`
}

/** The package in folder, as its archive. */
export async function pack(folder: string): Promise<{ name: string; archive: Uint8Array }> {
  const manifest = await readManifest(folder)
  return { name: archiveName(manifest), archive: zipArchive(await packageFiles(folder)) }
}
