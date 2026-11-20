// The differential fixture: thousands of manifests with this package's
// answers, for another reader to agree with on every one. The Go server's
// reader (apps/pocketbase/internal/extensions/manifest) reads it in place.
//
// Unlike the corpus, whose answers are written by hand from the definitions,
// these answers are this validator's own: the corpus tests the validators,
// and this file tests that two of them agree, on far more manifests than
// anyone would write. It holds the tables both readers keep (the codes, the
// reserved publishers, the unsafe characters...) for the same reason.

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { gunzipSync, gzipSync } from 'node:zlib'
import { MANIFEST_ERROR_CODES } from '../manifest/codes'
import { RESERVED_PUBLISHERS } from '../manifest/rules/identity'
import { LISTING_FIELDS, LISTING_LICENSES, LISTING_MIN_SCREENSHOTS } from '../manifest/rules/listing'
import { HOOK_PERMISSIONS } from '../manifest/rules/permissions'
import { MAX_MANIFEST_BYTES, MAX_MANIFEST_DEPTH } from '../manifest/scan'
import { CLIENT_HOOKS, PERMISSIONS, PROVIDER_KINDS, SERVER_HOOKS } from '../manifest/schema'
import { APPLYING_KEYWORDS, KEYWORD_CODES } from '../manifest/structure'
import { UNSAFE_CODE_POINTS } from '../manifest/unsafe'
import { parseManifest, type ValidateOptions } from '../manifest/validate'
import engines from '../../corpus/engines.json'
import { bytesOf, filesIn, validManifests } from './corpus'
import { mangle, pick, seeded, type Random } from './random'

export const FIXTURE_FILE = fileURLToPath(new URL('../../testdata/differential.json.gz', import.meta.url))

/** What each manifest is answered for: both profiles, one of them for a host
 * with an API version, so that ENGINE_UNSUPPORTED is in play. */
const CHECKS: readonly ValidateOptions[] = [{ profile: 'install', apiVersion: '0.1.0' }, { profile: 'listing' }]

/** Mangled copies of the valid manifests, distinct. */
const MANGLED = 2000
/** Mangled copies of the corpus files that break one rule, distinct. */
const MANGLED_RULES = 1500
/** Cut, spliced and noisy texts of every corpus file, distinct. */
const NOISY = 1500
const SEED = 20261117

type Pair = [code: string, pointer: string]

interface DifferentialCase {
  readonly text: string
  /** One list of (code, pointer) pairs for each of CHECKS, in the reader's order. */
  readonly answers: readonly (readonly Pair[])[]
}

interface Fixture {
  readonly note: string
  readonly checks: readonly ValidateOptions[]
  readonly tables: Record<string, unknown>
  readonly cases: readonly DifferentialCase[]
}

/** `make` called until it has given `count` distinct texts, or for twice as long. */
function distinct(count: number, make: () => string): string[] {
  const found = new Set<string>()
  for (let round = 0; found.size < count && round < count * 2; round += 1) found.add(make())
  return [...found]
}

/** Text as it would reach a server: whole UTF-8, so a surrogate pair cut in
 * half is U+FFFD, as a file on disk would have it. */
const asStored = (text: string) => new TextDecoder().decode(new TextEncoder().encode(text))

/** The corpus files that have the schema's shape and break one rule: their
 * copies reach the rules more often than the valid ones' do. */
function ruleBreakers(): unknown[] {
  const files = filesIn('invalid').filter((file) => /^invalid\/(?:rule|listing)-/.test(file))
  return files.map((file) => JSON.parse(new TextDecoder().decode(bytesOf(file))) as unknown)
}

function mangledTexts(count: number, from: readonly unknown[], seed: number): string[] {
  const random = seeded(seed)
  let round = 0
  return distinct(count, () => JSON.stringify(mangle(from[(round += 1) % from.length], random)))
}

// What the reader alone refuses, on top of what JSON does: half a pair, an
// overflowing number, U+FFFD; and what is easily mistaken for it.
const NOISE = ['{', '}', '[', ']', '"', '\\', ',', ':', ' ', '\n', 'a', '1', '\\u0061', 'null', '\u{e9}', '\u{1f3b5}', '\\ud83c', '1e400', '-0', '\u{fffd}']

/** One change to a corpus file's text: cut short, spliced with noise, or a
 * line said twice (in an object, mostly a key written twice). */
function noisy(text: string, random: Random): string {
  const lines = text.split('\n')
  if (random() < 0.3 && lines.length > 2) {
    const at = Math.floor(random() * lines.length)
    return [...lines.slice(0, at + 1), lines[at], ...lines.slice(at + 1)].join('\n')
  }
  const at = Math.floor(random() * text.length)
  const noise = Array.from({ length: Math.floor(random() * 4) }, () => pick(random, NOISE)).join('')
  return random() < 0.5 ? text.slice(0, at) + noise : text.slice(0, at) + noise + text.slice(at + 1)
}

function noisyTexts(): string[] {
  const random = seeded(SEED + 1)
  const sources = [...filesIn('valid'), ...filesIn('invalid')].map((file) => new TextDecoder().decode(bytesOf(file)))
  return distinct(NOISY, () => asStored(noisy(pick(random, sources), random)))
}

/** Numbers spelled the ways a reader can get wrong: at the edges of a
 * double, past them, an integer written with a point. */
const NUMBERS = [
  '1', '1.0', '1e0', '10e-1', '0.1e1', '1.0000000000000002', '0.99999999999999999', '9007199254740993', '-0', '0e999999',
  '1e400', '-1e400', '1e-400', '-1e-400', '5e-324', '2.4703282292062327e-324', '2.4703282292062328e-324',
  '1.7976931348623157e308', '1.7976931348623158e308', '1.7976931348623159e308', '1e21', '1E2', '1e+2',
]

/** The tables, each entry in a manifest of its own, and the numbers in the
 * places where a number is checked. */
function probes(): string[] {
  const minimal = validManifests().find(({ file }) => file === 'valid/minimal.json')!.value as object
  const changed = (change: object) => JSON.stringify({ ...minimal, ...change })
  /** `minimal` with `change`, its NUMBER written as `number` is. */
  const spelled = (change: object, number: string) => changed(change).replace('"NUMBER"', number)
  const banner = { banner: { path: 'b.png', width: 'NUMBER', height: 720 } }
  const step = { contributes: { settings: [{ key: 'n', type: 'number', title: 'Count', scope: 'user', step: 'NUMBER' }] } }
  return [
    ...RESERVED_PUBLISHERS.map((name) => changed({ id: `${name}.x` })),
    changed({ id: 'songstress.x' }),
    ...UNSAFE_CODE_POINTS.flat().map((point) => changed({ name: `a${String.fromCodePoint(point)}b` })),
    ...[...LISTING_LICENSES, 'mit', 'GPL-2.0-only'].map((license) => changed({ license, repository: 'https://github.com/a/b' })),
    ...NUMBERS.flatMap((number) => [
      spelled({ manifestVersion: 'NUMBER' }, number),
      spelled(banner, number.replace(/^1/, '1280')),
      spelled(step, number),
    ]),
    ...[...engines.versions.valid, ...engines.versions.invalid].map((version) => changed({ version })),
    ...[...engines.ranges.cases.map(({ range }) => range), ...engines.ranges.invalid].map((songstress) => changed({ engines: { songstress } })),
  ]
}

/** The lists both readers keep by hand, so that one cannot drift from the other. */
function tables(): Record<string, unknown> {
  return {
    codes: Object.keys(MANIFEST_ERROR_CODES),
    keywordCodes: KEYWORD_CODES,
    applyingKeywords: APPLYING_KEYWORDS,
    reservedPublishers: RESERVED_PUBLISHERS,
    hookPermissions: HOOK_PERMISSIONS,
    listingFields: LISTING_FIELDS,
    listingLicenses: LISTING_LICENSES,
    listingMinScreenshots: LISTING_MIN_SCREENSHOTS,
    unsafeCodePoints: UNSAFE_CODE_POINTS,
    maxManifestBytes: MAX_MANIFEST_BYTES,
    maxManifestDepth: MAX_MANIFEST_DEPTH,
    permissions: PERMISSIONS,
    providerKinds: PROVIDER_KINDS,
    serverHooks: SERVER_HOOKS,
    clientHooks: CLIENT_HOOKS,
  }
}

function answered(text: string): DifferentialCase {
  const bytes = new TextEncoder().encode(text)
  const answers = CHECKS.map((check) => parseManifest(bytes, check).issues.map<Pair>((issue) => [issue.code, issue.pointer]))
  return { text, answers }
}

/** The fixture as this package answers today. */
export function buildFixture(): Fixture {
  const valid = validManifests().map(({ value }) => value)
  const mangled = [...mangledTexts(MANGLED, valid, SEED), ...mangledTexts(MANGLED_RULES, ruleBreakers(), SEED + 2)]
  const texts = [...new Set([...probes(), ...mangled, ...noisyTexts()])]
  return {
    note: 'Generated by packages/extensions/src/test/differential.ts: each text with what this package answers for each check. Never edit it; run "pnpm --dir packages/extensions differential:record".',
    checks: CHECKS,
    tables: tables(),
    cases: texts.map(answered),
  }
}

/** The fixture as JSON, one case a line. */
export function serialize(fixture: Fixture): string {
  const { cases, ...head } = fixture
  return `${JSON.stringify(head).slice(0, -1)},"cases":[\n${cases.map((entry) => JSON.stringify(entry)).join(',\n')}\n]}\n`
}

/** The recorded fixture's text, or null when there is none. */
export function readFixture(): string | null {
  return existsSync(FIXTURE_FILE) ? gunzipSync(readFileSync(FIXTURE_FILE)).toString('utf8') : null
}

export function writeFixture(text: string): void {
  writeFileSync(FIXTURE_FILE, gzipSync(Buffer.from(text, 'utf8'), { level: 9 }))
}
