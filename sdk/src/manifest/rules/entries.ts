// ENTRY_REQUIRED and ENTRY_UNUSED: an entry is started by what the manifest
// declares, so each declaration needs its entry, and an entry nothing
// declares a need for would never run (the usual cause: a hook registered in
// code and left out of `hooks`).

import { pointerOf } from '../pointer'
import type { Manifest, Side } from '../types.generated'
import type { Rule } from './rule'

const SIDES: readonly Side[] = ['server', 'client']

/** The contributions only a server entry can answer for. */
const SERVER_WORK = ['providers', 'jobs', 'routes', 'signIn'] as const

/** Where the manifest says code of `side` is needed, as pointers. */
export function startersOf(manifest: Manifest, side: Side): string[] {
  const contributes = manifest.contributes ?? {}
  const hooks = manifest.hooks?.[side] ? [pointerOf('hooks', side)] : []
  const work = side === 'server' ? SERVER_WORK.filter((kind) => contributes[kind]).map((kind) => pointerOf('contributes', kind)) : []
  const commands = (contributes.commands ?? []).flatMap((command, i) =>
    command.run === side ? [pointerOf('contributes', 'commands', i, 'run')] : [],
  )
  const drawn = (['pages', 'panels', 'status'] as const).flatMap((kind) =>
    (contributes[kind] ?? []).flatMap((item, i) => (item.render === side ? [pointerOf('contributes', kind, i, 'render')] : [])),
  )
  return [...hooks, ...work, ...commands, ...drawn]
}

export const entries: Rule = (manifest, report) => {
  for (const side of SIDES) {
    const starters = startersOf(manifest, side)
    const declared = manifest.entry?.[side] !== undefined
    if (declared && starters.length === 0) {
      const message = `Nothing in the manifest would start the ${side} entry: no hook, command or contribution names it.`
      report('ENTRY_UNUSED', pointerOf('entry', side), message)
    }
    if (declared) continue
    for (const pointer of starters) report('ENTRY_REQUIRED', pointer, `This needs code, and the manifest has no entry.${side}.`)
  }
}
