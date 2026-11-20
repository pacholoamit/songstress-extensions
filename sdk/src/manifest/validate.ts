// The manifest validator: reader, schema, rules, and for the official list
// the listing rules, each stage run only when the ones before found nothing.
// It has no dependency and touches nothing but its input, so it runs in a
// terminal, on a server and in a browser alike.
//
// What it answers is a set of (code, pointer) pairs. The sentence beside each
// is for a person and may be reworded; the pairs are the contract, pinned by
// the corpus.

import { gather, type ManifestIssue } from './codes'
import { LISTING_RULES, RULES } from './rules'
import { readManifest } from './scan'
import { MANIFEST_SCHEMA } from './schema'
import { parseVersion } from './semver'
import { checkStructure } from './structure'
import type { Manifest } from './types.generated'

/** What a manifest is held to: what a server takes from a file or a link
 * ("install"), or what the official list asks on top ("listing"). */
export type ManifestProfile = 'install' | 'listing'

export const MANIFEST_PROFILES: readonly ManifestProfile[] = ['install', 'listing']

export interface ValidateOptions {
  /** Left out, "install". */
  profile?: ManifestProfile
  /** The extension API version of the host that is checking. Given, a
   * manifest whose `engines.songstress` leaves it out is refused. */
  apiVersion?: string
}

/** A manifest that passed, typed; or every problem found in it. */
export type ManifestResult = { valid: true; manifest: Manifest; issues: [] } | { valid: false; issues: ManifestIssue[] }

/** A caller's mistake, not a manifest's: it is thrown, never reported. */
function checkOptions({ profile = 'install', apiVersion }: ValidateOptions): ManifestProfile {
  if (!MANIFEST_PROFILES.includes(profile)) throw new TypeError(`unknown profile: ${String(profile)}`)
  if (apiVersion !== undefined && !parseVersion(apiVersion)) {
    throw new TypeError(`apiVersion is not a semantic version: ${apiVersion}`)
  }
  return profile
}

/** Checks a manifest that is already a JSON value. */
export function validateManifest(value: unknown, options: ValidateOptions = {}): ManifestResult {
  const profile = checkOptions(options)
  const misshapen = checkStructure(MANIFEST_SCHEMA, value)
  if (misshapen.length > 0) return { valid: false, issues: misshapen }
  const manifest = value as Manifest
  const found = gather()
  const rules = profile === 'listing' ? [...RULES, ...LISTING_RULES] : RULES
  for (const rule of rules) rule(manifest, found.report, { apiVersion: options.apiVersion })
  const issues = found.list()
  return issues.length > 0 ? { valid: false, issues } : { valid: true, manifest, issues: [] }
}

/** Reads and checks a manifest from its text, or from its bytes as they are
 * on disk. Prefer the bytes: only they can show a file that is not UTF-8. */
export function parseManifest(input: string | Uint8Array, options: ValidateOptions = {}): ManifestResult {
  checkOptions(options)
  // A Blob, an ArrayBuffer or a parsed object is a caller's mistake too, and
  // would otherwise be read as bytes it does not have.
  if (typeof input !== 'string' && !(input instanceof Uint8Array)) {
    throw new TypeError('parseManifest takes the text of a manifest, or its bytes as a Uint8Array')
  }
  const read = readManifest(input)
  return read.ok ? validateManifest(read.value, options) : { valid: false, issues: read.issues }
}
