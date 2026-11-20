// PERMISSION_REQUIRED, PERMISSION_UNUSED and NETWORK_LOCAL_NOT_PRIVATE.

import type { Report } from '../codes'
import { pointerOf } from '../pointer'
import type { PermissionName } from '../schema'
import type { ClientHook, Manifest, ServerHook, Side } from '../types.generated'
import { startersOf } from './entries'
import type { Rule } from './rule'

/** The permission each hook needs before it is delivered; null for none.
 * Hearing a member's playback is reading their listening, on either side. */
export const HOOK_PERMISSIONS: {
  readonly server: Readonly<Record<ServerHook, PermissionName>>
  readonly client: Readonly<Record<ClientHook, PermissionName | null>>
} = {
  server: {
    onPlay: 'listening.read',
    onScrobble: 'listening.read',
    onFavorite: 'listening.read',
    onPlaylistChange: 'library.read',
    onLibraryChange: 'library.read',
    onScanComplete: 'library.read',
  },
  client: {
    onPlay: 'listening.read',
    onPause: 'listening.read',
    onTrackChange: 'listening.read',
    onSeek: 'listening.read',
    onVolumeChange: null,
    onQueueChange: 'listening.read',
    onProgress: 'listening.read',
  },
}

/** The contributions that each need the permission of the same name. */
const GATED = ['providers', 'jobs', 'routes'] as const

/** Permissions only code in the server entry can use. */
const SERVER_ONLY: readonly PermissionName[] = ['library.read', 'users.read', 'secrets']

/** Permissions only code in an app can use. */
const CLIENT_ONLY: readonly PermissionName[] = ['player.control']

function has(manifest: Manifest, name: PermissionName): boolean {
  return manifest.permissions?.[name] !== undefined
}

function hookPermissions(manifest: Manifest, report: Report): void {
  const needs = (side: Side, hook: string, index: number) => {
    const needed = (HOOK_PERMISSIONS[side] as Record<string, PermissionName | null>)[hook]
    if (!needed || has(manifest, needed)) return
    report('PERMISSION_REQUIRED', pointerOf('hooks', side, index), `"${hook}" needs the "${needed}" permission.`)
  }
  manifest.hooks?.server?.forEach((hook, index) => needs('server', hook, index))
  manifest.hooks?.client?.forEach((hook, index) => needs('client', hook, index))
}

/** The provider kinds that are handed a member's listening, and so need its
 * permission as a hook that hears it does. */
const LISTENING_PROVIDERS = ['scrobble'] as const

function providerPermissions(manifest: Manifest, report: Report): void {
  for (const kind of LISTENING_PROVIDERS) {
    if (!manifest.contributes?.providers?.[kind] || has(manifest, 'listening.read')) continue
    const message = `A ${kind} provider is handed members' plays, and needs the "listening.read" permission.`
    report('PERMISSION_REQUIRED', pointerOf('contributes', 'providers', kind), message)
  }
}

/** A sign-in's tokens are the extension's own secrets: it needs the
 * permission that keeps them. */
function signInPermissions(manifest: Manifest, report: Report): void {
  if (!manifest.contributes?.signIn || has(manifest, 'secrets')) return
  const message = 'A sign-in keeps the tokens it is given as secrets, and needs the "secrets" permission.'
  report('PERMISSION_REQUIRED', pointerOf('contributes', 'signIn'), message)
}

export const requiredPermissions: Rule = (manifest, report) => {
  hookPermissions(manifest, report)
  providerPermissions(manifest, report)
  signInPermissions(manifest, report)
  for (const kind of GATED) {
    if (!manifest.contributes?.[kind] || has(manifest, kind)) continue
    report('PERMISSION_REQUIRED', pointerOf('contributes', kind), `Contributing ${kind} needs the "${kind}" permission.`)
  }
}

/** Whether the extension has code on `side`: an entry, or something that
 * asks for one (whose missing entry is reported on its own, once). */
function runsOn(manifest: Manifest, side: Side): boolean {
  return manifest.entry?.[side] !== undefined || startersOf(manifest, side).length > 0
}

/** Why `name` could never be used by this manifest, or null when it could. */
function unusable(manifest: Manifest, name: PermissionName): string | null {
  const server = runsOn(manifest, 'server')
  const inApp = runsOn(manifest, 'client') || manifest.contributes?.views !== undefined
  if ((GATED as readonly string[]).includes(name)) {
    return manifest.contributes?.[name as (typeof GATED)[number]] ? null : `the manifest contributes no ${name}`
  }
  if (SERVER_ONLY.includes(name)) return server ? null : 'only a server entry can use it, and there is none'
  if (CLIENT_ONLY.includes(name)) return inApp ? null : 'only a client entry or a view can use it, and there is none'
  return server || inApp ? null : 'the extension ships no code and no view'
}

export const unusedPermissions: Rule = (manifest, report) => {
  for (const name of Object.keys(manifest.permissions ?? {}) as PermissionName[]) {
    const why = unusable(manifest, name)
    if (why) report('PERMISSION_UNUSED', pointerOf('permissions', name), `"${name}" is asked for, but ${why}.`)
  }
}

// The private (RFC 1918) and loopback blocks, as a first address and the
// number of leading bits that fix the block. Link-local addresses and
// 100.64.0.0/10 are left out on purpose: cloud metadata services live there.
const PRIVATE_BLOCKS: readonly (readonly [first: number, bits: number])[] = [
  [address(10, 0, 0, 0), 8],
  [address(172, 16, 0, 0), 12],
  [address(192, 168, 0, 0), 16],
  [address(127, 0, 0, 0), 8],
]

const IPV4_TARGET = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})(?:\/(\d{1,2}))?(?::\d+)?$/

function address(a: number, b: number, c: number, d: number): number {
  return ((a << 24) | (b << 16) | (c << 8) | d) >>> 0
}

/** The leading `bits` of an address, as a number. */
function prefix(of: number, bits: number): number {
  return bits === 0 ? 0 : of >>> (32 - bits)
}

/** Whether an IPv4 target lies wholly inside one private block. A host name
 * passes: the host checks the address it resolves to when it connects. */
function isPrivateTarget(target: string): boolean {
  const found = IPV4_TARGET.exec(target)
  if (!found) return true
  const at = address(Number(found[1]), Number(found[2]), Number(found[3]), Number(found[4]))
  const width = found[5] === undefined ? 32 : Number(found[5])
  return PRIVATE_BLOCKS.some(([first, bits]) => width >= bits && prefix(at, bits) === prefix(first, bits))
}

export const localTargets: Rule = (manifest, report) => {
  manifest.permissions?.['network.local']?.targets?.forEach((target, index) => {
    if (isPrivateTarget(target)) return
    const message = `${target} is not inside 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16 or 127.0.0.0/8.`
    report('NETWORK_LOCAL_NOT_PRIVATE', pointerOf('permissions', 'network.local', 'targets', index), message)
  })
}
