// The validator as the published command carries it. scripts/build.ts
// bundles dist/cli.js with this in validator.ts's place (as its
// loadValidator): the package does not carry the sources validator.ts
// bundles at run time, so the command reads a manifest with the validator
// built into it instead. Inside the repository only its test imports it.

import { MANIFEST_PROFILES, type ManifestProfile, parseManifest } from '../manifest/validate.ts'
import type { loadValidator } from './validator.ts'

const isProfile = (profile: string): profile is ManifestProfile => MANIFEST_PROFILES.some((known) => known === profile)

/** The same validator validator.ts loads, already in the bundle; an unknown profile is refused in the same words
 * (the validator's own checkOptions). */
export const loadBuiltValidator: typeof loadValidator = async () => (input, { profile }) => {
  if (!isProfile(profile)) throw new TypeError(`unknown profile: ${profile}`)
  return parseManifest(input, { profile })
}
