// songstress/manifest: the manifest's schema, its types and its validator.
// Nothing here needs a host: a command-line tool, a website's submission
// check and a server all import this entry.

export { MANIFEST_ERROR_CODES } from './manifest/codes'
export type { ManifestErrorCode, ManifestIssue } from './manifest/codes'
export { LISTING_FIELDS, LISTING_LICENSES, LISTING_MIN_SCREENSHOTS } from './manifest/rules/listing'
export { RESERVED_PUBLISHERS } from './manifest/rules/identity'
export { HOOK_PERMISSIONS } from './manifest/rules/permissions'
export { parseProse, proseSpans, proseToMarkdown } from './manifest/prose'
export type { ProseBlock, ProseSpan } from './manifest/prose'
export { UNSAFE_CODE_POINTS } from './manifest/unsafe'
export { MAX_MANIFEST_BYTES, MAX_MANIFEST_DEPTH } from './manifest/scan'
export {
  CATEGORIES,
  CLIENT_HOOKS,
  MANIFEST_FILE,
  MANIFEST_SCHEMA,
  MANIFEST_SCHEMA_ID,
  MENU_LOCATIONS,
  PANEL_LOCATIONS,
  PERMISSIONS,
  PLATFORMS,
  PROVIDER_KINDS,
  SERVER_HOOKS,
  THEME_APPEARANCES,
  THEME_FILE_SCHEMA,
  THEME_FILE_SCHEMA_ID,
  THEME_TOKENS,
} from './manifest/schema'
export type { MenuLocation, PermissionName, ProviderKind, ThemeAppearance, ThemeToken } from './manifest/schema'
export { MAX_THEME_FILE_BYTES, parseThemeFile } from './manifest/themes'
export type { ThemeFileResult } from './manifest/themes'
export { compareVersions, parseRange, parseVersion, satisfiesRange } from './manifest/semver'
export type { Version, VersionRange } from './manifest/semver'
export { KEYWORD_CODES } from './manifest/structure'
export { MANIFEST_PROFILES, parseManifest, validateManifest } from './manifest/validate'
export type { ManifestProfile, ManifestResult, ValidateOptions } from './manifest/validate'
export type * from './manifest/types.generated'
