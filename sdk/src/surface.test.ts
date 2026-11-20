import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'
import { renderSurface } from './test/surface'
import { API_VERSION } from './version'

// The frozen surface. api/surface.txt holds everything an extension's author
// can see of this package, taken at one version. This test fails when the
// surface is no longer what the file says, so no change to the public API
// goes by unnoticed, and none is recorded without the version moving first:
//
//   1. change the API
//   2. move "version" in package.json and API_VERSION in src/version.ts
//   3. pnpm --dir packages/extensions api:record

const FILE = fileURLToPath(new URL('../api/surface.txt', import.meta.url))
const HEADER = (version: string) =>
  `# The public surface of songstress ${version}.\n# Written by "pnpm --dir packages/extensions api:record". Never edit it by hand.\n\n`

const recording = process.env.SONGSTRESS_API_RECORD === '1'
const recorded = existsSync(FILE) ? readFileSync(FILE, 'utf8') : null
const recordedVersion = recorded?.match(/^# The public surface of songstress (\S+)\.$/m)?.[1]

it(
  recording ? 'records the public surface, when the version allows it' : 'the public surface is the one recorded',
  { timeout: 120_000 },
  () => {
    const now = HEADER(API_VERSION) + renderSurface()
    if (now === recorded) return
    const moved = recordedVersion !== API_VERSION
    if (recording && (recorded === null || moved)) {
      writeFileSync(FILE, now)
      return
    }
    const how = moved
      ? `The version moved from ${recordedVersion} to ${API_VERSION}: run "pnpm --dir packages/extensions api:record".`
      : `The public API changed and the version is still ${API_VERSION}. Move the version (package.json and src/version.ts), then run "pnpm --dir packages/extensions api:record".`
    expect(now, how).toBe(recorded ?? '(nothing recorded yet)')
  },
)
