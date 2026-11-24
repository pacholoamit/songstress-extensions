// Semantic versions (semver.org 2.0.0) and the small range grammar that
// `engines.songstress` takes. Small on purpose, so that every host can write
// it the same way: corpus/engines.json is the table they all must pass.
//
//   ^1.2.0            from 1.2.0 up to, not including, 2.0.0-0
//   ^0.2.0            from 0.2.0 up to, not including, 0.3.0-0
//   ^0.0.3            from 0.0.3 up to, not including, 0.0.4-0
//   ~1.2.0            from 1.2.0 up to, not including, 1.3.0-0
//   >=1.2.0           1.2.0 and everything after it
//   >=1.2.0 <2.0.0    from 1.2.0 up to, not including, 2.0.0
//   1.2.0             that one version
//
// Versions are compared by semver.org's precedence and nothing else: a
// prerelease sorts before its release, and build metadata is ignored. A
// version inside a range carries no build metadata. There is no "*", no "x",
// no "||".

/** A parsed semantic version. */
export interface Version {
  /** The major version. */
  readonly major: number
  /** The minor version. */
  readonly minor: number
  /** The patch version. */
  readonly patch: number
  /** The prerelease identifiers ("beta", "2"); none for a release. */
  readonly prerelease: readonly string[]
  /** The build metadata after "+", which takes no part in ordering. */
  readonly build: string
}

/** A parsed range: every version from `from` on, before `before` when there
 * is one; or `from` alone when `exact`. */
export interface VersionRange {
  /** The lowest version the range takes. */
  readonly from: Version
  /** The version the range stops before, or null for none. */
  readonly before: Version | null
  /** The range takes one version alone. */
  readonly exact: boolean
}

// semver.org's suggested regular expression (CC BY 3.0), with the three
// numbers held to 15 digits so that they stay exact in every language.
const VERSION =
  /^(0|[1-9]\d{0,14})\.(0|[1-9]\d{0,14})\.(0|[1-9]\d{0,14})(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/

const DIGITS = /^\d+$/
const MAX_LENGTH = 256

/** `text` as a version, or null when it is not one.
 * @param text - A version as `major.minor.patch`.
 * @returns The version, or null.
 * @example
 * ```ts
 * import { parseVersion } from 'songstress/manifest'
 *
 * const version = parseVersion('2.0.0-beta.1')
 * if (version) console.log(version.major, version.prerelease) // 2 [ 'beta', '1' ]
 * ```
 */
export function parseVersion(text: string): Version | null {
  if (text.length > MAX_LENGTH) return null
  const found = VERSION.exec(text)
  if (!found) return null
  return {
    major: Number(found[1]),
    minor: Number(found[2]),
    patch: Number(found[3]),
    prerelease: found[4] ? found[4].split('.') : [],
    build: found[5] ?? '',
  }
}

const sign = (difference: number) => (difference < 0 ? -1 : difference > 0 ? 1 : 0)

/** Two texts by ASCII order. */
const byText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

/** Two prerelease identifiers: numbers before words, words by ASCII order,
 * numbers by value. A number may have any count of digits, so two are
 * compared as text: the longer is the larger. */
function compareIdentifiers(a: string, b: string): number {
  const [aNumber, bNumber] = [DIGITS.test(a), DIGITS.test(b)]
  if (aNumber !== bNumber) return aNumber ? -1 : 1
  return aNumber ? sign(a.length - b.length) || byText(a, b) : byText(a, b)
}

function comparePrerelease(a: readonly string[], b: readonly string[]): number {
  // A release (no identifiers) comes after every prerelease of it.
  if (a.length === 0 || b.length === 0) return sign(b.length - a.length)
  for (let index = 0; index < Math.min(a.length, b.length); index += 1) {
    const difference = compareIdentifiers(a[index], b[index])
    if (difference !== 0) return difference
  }
  return sign(a.length - b.length)
}

/** -1 when `a` comes before `b`, 1 when after, 0 when they rank the same.
 * @param a - A version.
 * @param b - The version to hold it against.
 * @returns -1, 0 or 1, for sorting.
 * @example
 * ```ts
 * import { compareVersions, parseVersion } from 'songstress/manifest'
 *
 * const versions = ['1.10.0', '1.2.0', '1.2.0-beta.1'].map(parseVersion).filter((version) => version !== null)
 * versions.sort(compareVersions) // 1.2.0-beta.1, 1.2.0, 1.10.0
 * ```
 */
export function compareVersions(a: Version, b: Version): number {
  return (
    sign(a.major - b.major) ||
    sign(a.minor - b.minor) ||
    sign(a.patch - b.patch) ||
    comparePrerelease(a.prerelease, b.prerelease)
  )
}

/** The lowest version of a line: its "-0" prerelease. */
function floor(major: number, minor: number, patch: number): Version {
  return { major, minor, patch, prerelease: ['0'], build: '' }
}

/** Where "^version" ends: the next version that may break it. */
function caretEnd({ major, minor, patch }: Version): Version {
  if (major > 0) return floor(major + 1, 0, 0)
  return minor > 0 ? floor(0, minor + 1, 0) : floor(0, 0, patch + 1)
}

/** A version as a range may hold it: no build metadata. */
function operand(text: string): Version | null {
  const version = parseVersion(text)
  return version && version.build === '' ? version : null
}

function between(lower: string, upper: string): VersionRange | null {
  const [from, before] = [operand(lower), upper.startsWith('<') ? operand(upper.slice(1)) : null]
  if (!from || !before || compareVersions(from, before) >= 0) return null
  return { from, before, exact: false }
}

function single(text: string): VersionRange | null {
  const operator = ['^', '~', '>='].find((mark) => text.startsWith(mark)) ?? ''
  const from = operand(text.slice(operator.length))
  if (!from) return null
  if (operator === '^') return { from, before: caretEnd(from), exact: false }
  if (operator === '~') return { from, before: floor(from.major, from.minor + 1, 0), exact: false }
  return { from, before: null, exact: operator === '' }
}

/** `text` as a range, or null when the grammar above does not take it.
 * @param text - A range as a manifest writes it: `^1.2.0`, `~1.2.0`, `>=1.2.0`, `>=1.2.0 <2.0.0` or one exact version.
 * @returns The range, or null.
 * @example
 * ```ts
 * import { parseRange } from 'songstress/manifest'
 *
 * const range = parseRange('^0.1.10')
 * if (!range) console.log('not a range engines.songstress takes')
 * ```
 */
export function parseRange(text: string): VersionRange | null {
  if (text.length > MAX_LENGTH) return null
  const parts = text.split(' ')
  if (parts.length === 1) return single(text)
  if (parts.length === 2 && parts[0].startsWith('>=')) return between(parts[0].slice(2), parts[1])
  return null
}

/** Whether `version` lies inside `range`.
 * @param version - The version to test.
 * @param range - The range, from `parseRange`.
 * @returns True when the range takes the version.
 * @example
 * ```ts
 * import { parseRange, parseVersion, satisfiesRange } from 'songstress/manifest'
 *
 * const range = parseRange('^0.1.0')
 * const version = parseVersion('0.1.8')
 * if (range && version) console.log(satisfiesRange(version, range)) // true
 * ```
 */
export function satisfiesRange(version: Version, range: VersionRange): boolean {
  const fromHere = compareVersions(version, range.from)
  if (range.exact) return fromHere === 0
  return fromHere >= 0 && (range.before === null || compareVersions(version, range.before) < 0)
}
