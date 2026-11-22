// WHEN_INVALID and WHEN_KEY_UNKNOWN: a condition on a menu item, a page's
// entry, a panel or a status item must be one every app can read, and name
// only what an app knows there (SPEC.md section 10, "Conditions").

import type { Report } from '../codes'
import { pointerOf } from '../pointer'
import { MENU_LOCATIONS, PLATFORMS, type MenuLocation } from '../schema'
import type { Manifest } from '../types.generated'
import { readWhen, type WhenKey } from '../when'
import type { Rule } from './rule'

/** What an app knows wherever an extension's interface shows. */
const EVERYWHERE = new Set(['platform', 'clientCode', 'views', 'admin', 'signedIn', 'playing'])

/** The menus opened on a song, an album or an artist: there `favorite` says
 * whether it is one of the member's favourites. */
const ON_A_FAVOURITE: ReadonlySet<string> = new Set<MenuLocation>([
  'song/context',
  'album/context',
  'artist/context',
  'queue/item',
  'player/actions',
])

const SETTING = 'setting.'

/** Why `named` is not a key this condition may use; null when it is. */
function unknownKey(manifest: Manifest, named: WhenKey, menu: string | null): string | null {
  const { key, value } = named
  if (key.startsWith(SETTING)) {
    const setting = manifest.contributes?.settings?.find((item) => item.key === key.slice(SETTING.length))
    if (!setting) return `"${key}" names no setting of contributes.settings.`
    return setting.type === 'secret' ? `"${key}" is a secret, which never reaches an app.` : null
  }
  if (key === 'favorite') return menu !== null && ON_A_FAVOURITE.has(menu) ? null : '"favorite" is known only in the menus of a song, an album or an artist.'
  if (!EVERYWHERE.has(key)) return `"${key}" is not a key an app knows.`
  if (key === 'signedIn' && !manifest.contributes?.signIn) return '"signedIn" needs contributes.signIn.'
  if (key === 'platform' && value !== undefined && !(PLATFORMS as readonly unknown[]).includes(value)) {
    return `"platform" is never ${JSON.stringify(value)}: it is one of ${PLATFORMS.join(', ')}.`
  }
  return null
}

/** Every condition of the manifest, with its pointer and its menu. */
function conditions(manifest: Manifest): { text: string; pointer: string; menu: string | null }[] {
  const contributes = manifest.contributes ?? {}
  const out: { text: string; pointer: string; menu: string | null }[] = []
  for (const location of MENU_LOCATIONS) {
    contributes.menus?.[location]?.forEach((item, index) => {
      if (item.when !== undefined) out.push({ text: item.when, pointer: pointerOf('contributes', 'menus', location, index, 'when'), menu: location })
    })
  }
  for (const kind of ['pages', 'panels', 'status'] as const) {
    contributes[kind]?.forEach((item, index) => {
      if (item.when !== undefined) out.push({ text: item.when, pointer: pointerOf('contributes', kind, index, 'when'), menu: null })
    })
  }
  return out
}

export const whenClauses: Rule = (manifest, report: Report) => {
  for (const { text, pointer, menu } of conditions(manifest)) {
    const read = readWhen(text)
    if (!read.ok) {
      report('WHEN_INVALID', pointer, `No app can read this condition: ${read.why}.`)
      continue
    }
    // One finding a condition: the first key no app knows there.
    const why = read.keys.map((named) => unknownKey(manifest, named, menu)).find((reason) => reason !== null)
    if (why) report('WHEN_KEY_UNKNOWN', pointer, why)
  }
}
