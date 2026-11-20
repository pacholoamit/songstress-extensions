// PATH_OUTSIDE_PACKAGE and BANNER_NOT_16_9.

import type { Report } from '../codes'
import { pointerOf } from '../pointer'
import type { Manifest } from '../types.generated'
import type { Rule } from './rule'

// Characters a file system or a web address treats specially. None has a
// place in the name of a file an extension ships.
const SPECIAL = ['\\', ':', '*', '?', '"', '<', '>', '|', '%', '#']

/** Whether `path` is a plain path from the package root: forward slashes
 * between names, no name empty or ending in a dot or a space (so no ".",
 * no "..", no leading or doubled slash), and no special character. */
export function isPlainPath(path: string): boolean {
  if (SPECIAL.some((char) => path.includes(char))) return false
  return path.split('/').every((name) => name !== '' && !name.endsWith('.') && !name.endsWith(' '))
}

type Located = [pointer: string, path: string]

function listed(manifest: Manifest): Located[] {
  const screenshots = (manifest.screenshots ?? []).map<Located>((shot, i) => [pointerOf('screenshots', i, 'path'), shot.path])
  const views = (manifest.contributes?.views ?? []).map<Located>((view, i) => [
    pointerOf('contributes', 'views', i, 'path'),
    view.path,
  ])
  const themes = (manifest.contributes?.themes ?? []).map<Located>((theme, i) => [
    pointerOf('contributes', 'themes', i, 'path'),
    theme.path,
  ])
  return [...screenshots, ...views, ...themes]
}

function single(manifest: Manifest): Located[] {
  const found: [string, string | undefined][] = [
    ['/icon/path', manifest.icon?.path],
    ['/banner/path', manifest.banner?.path],
    ['/entry/server', manifest.entry?.server],
    ['/entry/client', manifest.entry?.client],
  ]
  return found.filter((entry): entry is Located => entry[1] !== undefined)
}

function checkPath([pointer, path]: Located, report: Report): void {
  if (isPlainPath(path)) return
  report('PATH_OUTSIDE_PACKAGE', pointer, `"${path}" must be a plain path inside the package, such as assets/icon.png.`)
}

export const filePaths: Rule = (manifest, report) => {
  for (const located of [...single(manifest), ...listed(manifest)]) checkPath(located, report)
}

export const bannerShape: Rule = (manifest, report) => {
  const banner = manifest.banner
  if (!banner || banner.width * 9 === banner.height * 16) return
  report('BANNER_NOT_16_9', '/banner', `A banner is 16:9. ${banner.width} by ${banner.height} is not.`)
}
