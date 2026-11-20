// The checks as the published command carries them. scripts/build.ts
// bundles dist/cli.js with this in validator.ts's place (as its
// loadValidator): the package does not carry the sources validator.ts
// bundles at run time, so the command checks a manifest and its themes with
// the code built into it instead. Inside the repository only its test
// imports it.

import { checkLook, normalizeLook, parseManifest, parseThemeFile } from './checks.ts'
import { MANIFEST_PROFILES, type ManifestProfile } from '../manifest/validate.ts'
import type { CheckLook, loadValidator, NormalizeLook, ReadThemeFile, Validate } from './validator.ts'

const isProfile = (profile: string): profile is ManifestProfile => MANIFEST_PROFILES.some((known) => known === profile)

/** The same validator validator.ts loads, already in the bundle; an unknown profile is refused in the same words
 * (the validator's own checkOptions). */
const validate: Validate = (input, { profile }) => {
  if (!isProfile(profile)) throw new TypeError(`unknown profile: ${profile}`)
  return parseManifest(input, { profile })
}

export const loadBuiltValidator: typeof loadValidator = async () => ({
  validate,
  readThemeFile: parseThemeFile as ReadThemeFile,
  normalizeLook: normalizeLook as NormalizeLook,
  checkLook: checkLook as CheckLook,
})
