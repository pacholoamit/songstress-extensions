// DUPLICATE_ID, MENU_COMMAND_UNKNOWN, ROUTE_DUPLICATE, LINK_PATTERN_TOO_BROAD,
// PROVIDER_PLAY_NEEDS_SEARCH and PROVIDER_MISMATCH: what one contribution says
// about another.

import type { ManifestErrorCode, Report } from '../codes'
import { pointerOf } from '../pointer'
import { MENU_LOCATIONS, PROVIDER_KINDS, type ProviderKind } from '../schema'
import type { Contributes, Manifest } from '../types.generated'
import type { Rule } from './rule'

type Named = [name: string, pointer: string]

/** Reports each name of `list` that an earlier entry already has. */
function repeats(list: Named[], report: Report, code: ManifestErrorCode, what: string): void {
  const seen = new Set<string>()
  for (const [name, pointer] of list) {
    if (seen.has(name)) report(code, pointer, `"${name}" is already ${what}.`)
    seen.add(name)
  }
}

type Listed = 'commands' | 'pages' | 'panels' | 'views' | 'themes' | 'jobs' | 'routes'

function ids(contributes: Contributes, kind: Listed): Named[] {
  return (contributes[kind] ?? []).map((item, index) => [item.id, pointerOf('contributes', kind, index, 'id')])
}

function providerIds(contributes: Contributes): Named[][] {
  const providers = contributes.providers ?? {}
  const byKind = PROVIDER_KINDS.map((kind) =>
    (providers[kind] ?? []).map<Named>((item, index) => [item.id, pointerOf('contributes', 'providers', kind, index, 'id')]),
  )
  const qualities = (providers.download ?? []).map((provider, index) =>
    provider.qualities.map<Named>((quality, at) => [
      quality.id,
      pointerOf('contributes', 'providers', 'download', index, 'qualities', at, 'id'),
    ]),
  )
  return [...byKind, ...qualities]
}

export const duplicateIds: Rule = (manifest, report) => {
  const contributes = manifest.contributes ?? {}
  const settings = (contributes.settings ?? []).map<Named>((setting, index) => [
    setting.key,
    pointerOf('contributes', 'settings', index, 'key'),
  ])
  const groups: Named[][] = [
    ids(contributes, 'commands'),
    // A page and a view are opened by the same kind of address.
    [...ids(contributes, 'pages'), ...ids(contributes, 'views')],
    ids(contributes, 'panels'),
    ids(contributes, 'themes'),
    ids(contributes, 'jobs'),
    ids(contributes, 'routes'),
    settings,
    ...providerIds(contributes),
  ]
  for (const group of groups) repeats(group, report, 'DUPLICATE_ID', 'the name of an earlier one of its kind')
}

export const menuCommands: Rule = (manifest, report) => {
  const declared = new Set((manifest.contributes?.commands ?? []).map((command) => command.id))
  const menus = manifest.contributes?.menus ?? {}
  for (const location of MENU_LOCATIONS) {
    menus[location]?.forEach((item, index) => {
      if (declared.has(item.command)) return
      const pointer = pointerOf('contributes', 'menus', location, index, 'command')
      report('MENU_COMMAND_UNKNOWN', pointer, `"${item.command}" is not one of contributes.commands.`)
    })
  }
}

/** A route's path with the names of its ":name" parts taken out: two paths
 * that differ only there answer the same requests. */
function shape(path: string): string {
  return path
    .split('/')
    .map((part) => (part.startsWith(':') ? ':' : part))
    .join('/')
}

export const duplicateRoutes: Rule = (manifest, report) => {
  const routes = (manifest.contributes?.routes ?? []).map<Named>((route, index) => [
    `${route.method} ${shape(route.path)}`,
    pointerOf('contributes', 'routes', index),
  ])
  repeats(routes, report, 'ROUTE_DUPLICATE', 'answered by an earlier route')
}

const EVERY_WEB_LINK = ['http:', 'https:']

export const linkPatterns: Rule = (manifest, report) => {
  manifest.contributes?.providers?.links?.forEach((provider, index) => {
    provider.patterns.forEach((pattern, at) => {
      if (!EVERY_WEB_LINK.includes(pattern)) return
      const pointer = pointerOf('contributes', 'providers', 'links', index, 'patterns', at)
      report('LINK_PATTERN_TOO_BROAD', pointer, `"${pattern}" would claim every web link. Name the host.`)
    })
  })
}

export const playNeedsSearch: Rule = (manifest, report) => {
  const providers = manifest.contributes?.providers ?? {}
  const searchable = new Set((providers.search ?? []).map((provider) => provider.id))
  providers.play?.forEach((provider, index) => {
    if (searchable.has(provider.id)) return
    const pointer = pointerOf('contributes', 'providers', 'play', index, 'id')
    report('PROVIDER_PLAY_NEEDS_SEARCH', pointer, `"${provider.id}" plays what its search found, and has no search provider.`)
  })
}

/** The kinds whose entries may join one of Songstress's own catalogues. */
const GROUPED: readonly ProviderKind[] = ['search', 'lookup', 'links', 'metadata']

interface Described {
  readonly id: string
  readonly name?: string
  readonly group?: string
}

/** What one source has been called so far, and the group it joined. */
interface Source {
  name: string
  group?: string
}

/** Notes how `entry` describes its source, and says how it contradicts what
 * an earlier kind said, if it does. The first entry with an id sets the
 * source's name; the first that can join a group sets its group. */
function contradiction(sources: Map<string, Source>, entry: Described, fallback: string, grouped: boolean): string | null {
  const name = entry.name ?? fallback
  const group = grouped ? (entry.group ?? '') : undefined
  const known = sources.get(entry.id)
  if (!known) {
    sources.set(entry.id, { name, group })
    return null
  }
  const groupWas = known.group
  known.group ??= group
  if (known.name !== name) return `is named "${name}" here and "${known.name}" under another kind`
  const regrouped = group !== undefined && groupWas !== undefined && groupWas !== group
  return regrouped ? 'joins one group here and another under another kind' : null
}

export const providerMismatch: Rule = (manifest: Manifest, report) => {
  const providers = manifest.contributes?.providers ?? {}
  const sources = new Map<string, Source>()
  for (const kind of PROVIDER_KINDS) {
    const entries: readonly Described[] = providers[kind] ?? []
    entries.forEach((entry, index) => {
      const problem = contradiction(sources, entry, manifest.name, GROUPED.includes(kind))
      if (!problem) return
      const pointer = pointerOf('contributes', 'providers', kind, index)
      report('PROVIDER_MISMATCH', pointer, `The source "${entry.id}" ${problem}. One source has one name and one group.`)
    })
  }
}
