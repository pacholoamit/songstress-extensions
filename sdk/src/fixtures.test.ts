import { basename } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  PERMISSIONS_FILE,
  permissionsFixture,
  readFixture,
  TUNELOG_FILE,
  TUNELOG_PACKAGE_FILE,
  tunelogBundle,
  tunelogPackage,
  writeFixture,
} from './test/fixtures'

// The Go server's extension tests read three files of this package in place
// (src/test/fixtures.ts says which, and why). Each is stale when this
// package would write it differently today: then this fails, and
//
//   pnpm --dir packages/extensions fixtures:record
//
// writes them again. Run the Go tests after (apps/pocketbase): its table of
// members must agree with the first, the second must run in its sandbox, and
// the third must install from a file.

const recording = process.env.SONGSTRESS_FIXTURES_RECORD === '1'

/** Building the bundle takes a moment; the hook runs every suite at once. */
const BUILD_TIMEOUT_MS = 60_000

const FIXTURES: readonly [file: string, make: () => string | Uint8Array | Promise<string | Uint8Array>][] = [
  [PERMISSIONS_FILE, permissionsFixture],
  [TUNELOG_FILE, tunelogBundle],
  [TUNELOG_PACKAGE_FILE, tunelogPackage],
]

describe('the fixtures the server reads', () => {
  for (const [file, make] of FIXTURES) {
    const name = basename(file)
    it(recording ? `records ${name}` : `${name} is what this package writes today`, { timeout: BUILD_TIMEOUT_MS }, async () => {
      const now = await make()
      if (recording) writeFixture(file, now)
      const how = `testdata/${name} is stale: run "pnpm --dir packages/extensions fixtures:record", then the Go tests.`
      expect(readFixture(file)?.equals(Buffer.from(now)), how).toBe(true)
    })
  }

  it('builds the example as one classic script, with nothing left to import', async () => {
    const bundle = await tunelogBundle()
    expect(bundle).not.toMatch(/^\s*(import|export)\b/m)
    expect(bundle).toContain('Symbol.for("songstress.host")')
  })
})
