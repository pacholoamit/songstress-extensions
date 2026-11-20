// The SDK's own validator (src/manifest), as `songstress check` loads it.
// Its files import each other without the .ts names Node needs, so it is
// bundled for Node first. The published command carries it built in
// instead: scripts/build.ts bundles dist/cli.js with validator.built.ts in
// this file's place, since the package does not carry these sources.

import { fileURLToPath } from 'node:url'
import { bundle } from './build.ts'
import type { Finding } from './check.ts'

export type Validate = (
  input: Uint8Array,
  options: { profile: string },
) => { valid: true; manifest: { id: string; version: string }; issues: Finding[] } | { valid: false; issues: Finding[] }

let validator: Promise<Validate> | undefined

/** The SDK's own validator (src/manifest), bundled for Node: its files
 * import each other without the .ts names Node needs. */
export function loadValidator(): Promise<Validate> {
  validator ??= (async () => {
    const code = await bundle(fileURLToPath(new URL('../manifest/validate.ts', import.meta.url)), { format: 'esm' })
    const loaded = (await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)) as { parseManifest: Validate }
    return loaded.parseManifest
  })()
  return validator
}
