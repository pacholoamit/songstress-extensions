// The rules, in the order they are written up in SPEC.md. Their order never
// changes what is reported: every rule runs, and the answer is a set.

import { duplicateIds, duplicateRoutes, linkPatterns, menuCommands, playNeedsSearch, providerMismatch } from './contributions'
import { entries } from './entries'
import { bannerShape, filePaths } from './files'
import { engine, reservedId, version } from './identity'
import { localTargets, requiredPermissions, unusedPermissions } from './permissions'
import type { Rule } from './rule'
import { settings } from './settings'
import { unsafeText } from './text'
import { themeColors, themeLooks } from './themes'
import { whenClauses } from './when'

export { LISTING_RULES } from './listing'

export const RULES: readonly Rule[] = [
  unsafeText,
  reservedId,
  version,
  engine,
  filePaths,
  bannerShape,
  entries,
  requiredPermissions,
  unusedPermissions,
  localTargets,
  duplicateIds,
  menuCommands,
  duplicateRoutes,
  linkPatterns,
  playNeedsSearch,
  providerMismatch,
  settings,
  themeLooks,
  themeColors,
  whenClauses,
]
