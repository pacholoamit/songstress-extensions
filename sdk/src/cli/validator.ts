// The SDK's own validator (src/manifest) and the apps' rules for a theme's
// looks, as `songstress check` loads them. Their files import each other
// without the .ts names Node needs, so they are bundled for Node first
// (checks.ts is the one module). The published command carries them built
// in instead: scripts/build.ts bundles dist/cli.js with validator.built.ts in
// this file's place, since the package does not carry these sources.

import { fileURLToPath } from 'node:url'
import { bundle } from './build.ts'
import type { Finding } from './check.ts'

export type Validate = (
  input: Uint8Array,
  options: { profile: string },
) => { valid: true; manifest: CheckedManifest; issues: Finding[] } | { valid: false; issues: Finding[] }

/** What check reads of a manifest that passed. */
export interface CheckedManifest {
  id: string
  version: string
  contributes?: { themes?: readonly CheckedTheme[] }
}

/** A theme of a manifest that passed, and its looks where the manifest writes them. */
export interface CheckedTheme {
  appearance: 'dark' | 'light' | 'both'
  path?: string
  dark?: object
  light?: object
}

/** A theme file read for a theme of that appearance: its looks, or what is wrong with it. */
export type ReadThemeFile = (
  input: Uint8Array,
  appearance: CheckedTheme['appearance'],
) => { valid: true; file: { dark?: object; light?: object } } | { valid: false; issues: Finding[] }

/** A look's problems under the apps' rules: each a code (`contrast`, `luminance`), the look's place, a sentence. */
export type CheckLook = (appearance: 'dark' | 'light', look: object) => { code: string; at: string; message: string }[]

/** A look with each colour in its one form, as the apps read it (songstress/theme's normalizeLook). */
export type NormalizeLook = (look: unknown) => object | undefined

export interface Checks {
  validate: Validate
  readThemeFile: ReadThemeFile
  normalizeLook: NormalizeLook
  checkLook: CheckLook
}

let checks: Promise<Checks> | undefined

/** The four, bundled for Node from the sources: they import each other
 * without the .ts names Node needs. */
export function loadValidator(): Promise<Checks> {
  checks ??= (async () => {
    const code = await bundle(fileURLToPath(new URL('./checks.ts', import.meta.url)), { format: 'esm' })
    const loaded = (await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)) as {
      parseManifest: Validate
      parseThemeFile: ReadThemeFile
      normalizeLook: NormalizeLook
      checkLook: CheckLook
    }
    return {
      validate: loaded.parseManifest,
      readThemeFile: loaded.parseThemeFile,
      normalizeLook: loaded.normalizeLook,
      checkLook: loaded.checkLook,
    }
  })()
  return checks
}
