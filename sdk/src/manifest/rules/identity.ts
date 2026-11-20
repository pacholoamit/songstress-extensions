// ID_RESERVED, VERSION_INVALID, ENGINE_RANGE_INVALID, ENGINE_UNSUPPORTED.

import { parseRange, parseVersion, satisfiesRange } from '../semver'
import type { Rule } from './rule'

/** Publisher names no extension may take: the namespaces of the extension
 * API and the first part of each permission. An id such as "player.radio"
 * would read as part of Songstress itself. */
export const RESERVED_PUBLISHERS: readonly string[] = [
  'commands',
  'hooks',
  'host',
  'jobs',
  'library',
  'listening',
  'net',
  'network',
  'player',
  'providers',
  'queue',
  'routes',
  'secrets',
  'settings',
  'storage',
  'themes',
  'ui',
  'users',
]

export const reservedId: Rule = (manifest, report) => {
  const publisher = manifest.id.split('.')[0]
  if (!RESERVED_PUBLISHERS.includes(publisher)) return
  report('ID_RESERVED', '/id', `"${publisher}" is a name Songstress keeps for its own API. Publish under another name.`)
}

export const version: Rule = (manifest, report) => {
  if (parseVersion(manifest.version)) return
  report('VERSION_INVALID', '/version', `"${manifest.version}" is not a semantic version such as 1.4.0.`)
}

export const engine: Rule = (manifest, report, context) => {
  const asked = manifest.engines.songstress
  const range = parseRange(asked)
  if (!range) {
    const forms = '^1.2.0, ~1.2.0, >=1.2.0, >=1.2.0 <2.0.0 or one exact version'
    report('ENGINE_RANGE_INVALID', '/engines/songstress', `"${asked}" is not a range. Write ${forms}.`)
    return
  }
  const host = context.apiVersion === undefined ? null : parseVersion(context.apiVersion)
  if (!host || satisfiesRange(host, range)) return
  const message = `This Songstress has extension API ${context.apiVersion}, which "${asked}" leaves out.`
  report('ENGINE_UNSUPPORTED', '/engines/songstress', message)
}
