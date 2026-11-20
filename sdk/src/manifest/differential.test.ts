import { statSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildFixture, FIXTURE_FILE, readFixture, serialize, writeFixture } from '../test/differential'
import { MANIFEST_ERROR_CODES } from './codes'

// testdata/differential.json.gz holds thousands of manifests with this
// reader's answers, for the Go server's reader to agree with
// (apps/pocketbase/internal/extensions/manifest, differential_test.go). It is
// stale when this reader would answer anything differently today, or the
// manifests it is built from moved: then this fails, and
//
//   pnpm --dir packages/extensions differential:record
//
// writes it again. Run the Go tests after: they must agree with every answer.

const recording = process.env.SONGSTRESS_DIFFERENTIAL_RECORD === '1'

/** Building takes about a second alone; the hook runs every suite at once. */
const BUILD_TIMEOUT_MS = 60_000

/** The cases of a serialized fixture that `other` does not have, by number. */
function changed(text: string, other: string | null): number[] {
  const theirs = new Set((other ?? '').split('\n'))
  return text.split('\n').flatMap((line, index) => (theirs.has(line) ? [] : [index]))
}

describe('the differential fixture', () => {
  const built = buildFixture()
  const now = serialize(built)

  it(recording ? 'is recorded' : 'is what this reader answers today', { timeout: BUILD_TIMEOUT_MS }, () => {
    if (recording) writeFixture(now)
    const recorded = readFixture()
    if (recorded === now) return
    const lines = changed(now, recorded)
    const how = `${lines.length} lines of the fixture changed (the first is line ${lines[0]}): run "pnpm --dir packages/extensions differential:record", then the Go tests.`
    expect(recorded === null ? 'no fixture recorded' : how).toBe('')
  })

  it('has thousands of manifests, most refused and some passing, under each check', () => {
    expect(built.cases.length).toBeGreaterThan(4000)
    const passing = built.checks.map((_check, index) => built.cases.filter((entry) => entry.answers[index].length === 0).length)
    expect(passing[0]).toBeGreaterThan(200)
    expect(passing[1]).toBeGreaterThan(10)
    for (const count of passing) expect(count).toBeLessThan(built.cases.length / 2)
  })

  it('answers every code somewhere, but the one no text under the size limit can earn', () => {
    const answered = new Set(built.cases.flatMap((entry) => entry.answers.flat().map(([code]) => code)))
    expect(Object.keys(MANIFEST_ERROR_CODES).filter((code) => !answered.has(code))).toEqual(['MANIFEST_TOO_LARGE'])
  })

  it('stays well under 2 MB', () => {
    expect(statSync(FIXTURE_FILE).size).toBeLessThan(1024 * 1024)
  })
})
