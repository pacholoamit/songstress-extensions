// `songstress build`: each entry the manifest names under dist/ is built
// from its source under src/, when there is one (dist/server.js from
// src/server.ts, .tsx, .mts, .js or .mjs), as one classic script with all it
// imports inside it: an IIFE bundle, what a sandbox runs (SPEC.md, section
// 1). An entry with no such source is left as the extension's own build
// wrote it.

import { access, mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { readManifest } from './pack.ts'

const SOURCES = ['.ts', '.tsx', '.mts', '.js', '.mjs']

/** The entries built, by their paths in the package. */
export async function build(folder: string): Promise<string[]> {
  const manifest = await readManifest(folder)
  const built: string[] = []
  for (const entry of [manifest.entry?.server, manifest.entry?.client]) {
    if (typeof entry !== 'string' || !entry.startsWith('dist/') || !entry.endsWith('.js')) continue
    const source = await sourceOf(folder, entry)
    if (source === undefined) continue
    const code = await bundle(source, { cwd: folder })
    await mkdir(dirname(join(folder, entry)), { recursive: true })
    await writeFile(join(folder, entry), code)
    built.push(entry)
  }
  return built
}

async function sourceOf(folder: string, entry: string): Promise<string | undefined> {
  const stem = join(folder, 'src', entry.slice('dist/'.length, -'.js'.length))
  for (const extension of SOURCES) {
    const path = stem + extension
    if (await access(path).then(() => true, () => false)) return path
  }
  return undefined
}

/** One entry, bundled: rolldown, Vite 8's bundler, with the SDK's imports resolved as installed. */
export async function bundle(
  input: string,
  options: { cwd?: string; alias?: Record<string, string>; format?: 'iife' | 'esm' } = {},
): Promise<string> {
  const { rolldown } = await import('rolldown')
  const result = await rolldown({
    input,
    cwd: options.cwd,
    platform: 'neutral',
    logLevel: 'silent',
    resolve: options.alias ? { alias: options.alias } : undefined,
  })
  try {
    const { output } = await result.generate({ format: options.format ?? 'iife' })
    return output[0].code
  } finally {
    await result.close()
  }
}
