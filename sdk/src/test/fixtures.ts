// Files this package writes for the Go server's extension host
// (apps/pocketbase/internal/extensions) to read in place:
//
//   testdata/api-permissions.json        every member of the API with the
//                                        permission its call needs, for the
//                                        host's own table to agree with
//   testdata/tunelog.server.generated.js the example extension's server
//                                        entry, built as an author's build
//                                        would build it: one classic script,
//                                        the SDK inside it
//   testdata/tunelog.songstress          the example packed as `songstress
//                                        pack` packs it, for the server to
//                                        install from a file: its manifest
//                                        (the images left out, as the example
//                                        ships none) and that entry
//
// They are stale when the API or the example moves: then fixtures.test.ts
// fails, and "pnpm --dir packages/extensions fixtures:record" writes them
// again. Run the Go tests after: they must agree with both.

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { bundle } from '../cli/build.ts'
import { zipArchive } from '../cli/zip.ts'
import { API_PERMISSIONS, type Needs } from '../host'
import { API_VERSION } from '../version'

const inPackage = (path: string) => fileURLToPath(new URL(`../../${path}`, import.meta.url))

export const PERMISSIONS_FILE = inPackage('testdata/api-permissions.json')
export const TUNELOG_FILE = inPackage('testdata/tunelog.server.generated.js')
export const TUNELOG_PACKAGE_FILE = inPackage('testdata/tunelog.songstress')

const sorted = (table: Readonly<Record<string, Needs>>) =>
  Object.fromEntries(Object.entries(table).sort(([a], [b]) => (a < b ? -1 : 1)))

/** API_PERMISSIONS as JSON, each table's members in order. */
export function permissionsFixture(): string {
  const fixture = {
    note: 'Written by "pnpm --dir packages/extensions fixtures:record" from src/host.ts. Never edit it by hand.',
    apiVersion: API_VERSION,
    shared: sorted(API_PERMISSIONS.shared),
    server: sorted(API_PERMISSIONS.server),
    client: sorted(API_PERMISSIONS.client),
  }
  return `${JSON.stringify(fixture, null, 2)}\n`
}

const BUNDLE_HEADER =
  '// Written by "pnpm --dir packages/extensions fixtures:record" from examples/tunelog/src/server.ts\n' +
  '// and the SDK it imports. Never edit it by hand.\n'

/** The example's server entry as one classic script, built as `songstress build` builds one. */
export async function tunelogBundle(): Promise<string> {
  const code = await bundle(inPackage('examples/tunelog/src/server.ts'), {
    alias: { 'songstress/server': inPackage('src/server.ts') },
  })
  return BUNDLE_HEADER + code
}

/** The example as its archive: its manifest without the images it does not ship, and its built entry. */
export async function tunelogPackage(): Promise<Uint8Array> {
  const manifest = JSON.parse(readFileSync(inPackage('examples/tunelog/songstress.json'), 'utf8'))
  delete manifest.icon
  delete manifest.banner
  delete manifest.screenshots
  const encode = (text: string) => new TextEncoder().encode(text)
  return zipArchive([
    { path: 'songstress.json', data: encode(`${JSON.stringify(manifest, null, 2)}\n`) },
    { path: manifest.entry.server, data: encode(await tunelogBundle()) },
  ])
}

export function readFixture(file: string): Buffer | null {
  return existsSync(file) ? readFileSync(file) : null
}

export function writeFixture(file: string, data: string | Uint8Array): void {
  writeFileSync(file, data)
}
