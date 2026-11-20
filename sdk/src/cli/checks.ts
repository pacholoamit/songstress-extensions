// What `songstress check` holds an extension to, as one module: the
// manifest's validator, the theme file's reader (src/manifest), each look's
// colours in their one form (src/theme, as the apps read them), and the
// apps' own rules for a theme's looks (@songstress/theme, MIT as this package
// is, which the apps apply themes with). validator.ts bundles it for Node in
// the repository; the published command carries the same four built in
// (validator.built.ts).

export { checkLook } from '@songstress/theme/looks'
export { parseThemeFile } from '../manifest/themes'
export { parseManifest } from '../manifest/validate'
export { normalizeLook } from '../theme/look'
