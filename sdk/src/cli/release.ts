// Where an extension's releases are (SPEC.md, "A release"), in the two ways
// a repository holds extensions:
//
//   one     songstress.json at the repository's root, released on its
//           version: `v1.2.0` (the tag releaseTag names), or `1.2.0`;
//   several each in a folder of its own, of any name
//           (`<folder>/songstress.json`), each released on its own, tagged
//           `<id>@<version>`: `songstress.soundcloud@1.2.0`.
//
// The package is the release's one asset `<id>-<version>.songstress` either
// way. An extension's latest release is the newest full release (neither a
// draft nor a prerelease) whose tag names it; in a repository of several,
// another extension's releases are not its own. The server reads tags the
// same way (apps/pocketbase/internal/extensions/github.go, tagParts).
//
// Plain functions, importing nothing: the songstress command runs this file
// as it is, and songstress.app reads tags with it too (its Convex functions
// import it by path: apps/landing/convex/lib/releasePick.ts).

/** How a repository holds its extensions. */
export type Layout = 'one' | 'several'

/** A semantic version, as a release's tag carries it (SPEC.md, section 14). */
const VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/

/** The tag of the extension's release at version. */
export function releaseTag(id: string, version: string, layout: Layout): string {
  return layout === 'several' ? `${id}@${version}` : `v${version}`
}

/** The name of a release's package asset. */
export function assetName(id: string, version: string): string {
  return `${id}-${version}.songstress`
}

/** What a release's tag says: the extension it names (`""` for a tag of a
 * repository of one) and its version; null for a tag that names no version. */
export function readTag(tag: string): { id: string; version: string } | null {
  const at = tag.lastIndexOf('@')
  const id = at > 0 ? tag.slice(0, at) : ''
  const version = at > 0 ? tag.slice(at + 1) : tag.replace(/^v/, '')
  return VERSION.test(version) ? { id, version } : null
}

/** The version a release's tag names for the extension `id`: in a
 * repository of several, only a tag that names `id`; null for another
 * extension's release, or a tag that names no version. */
export function versionOfTag(tag: string, id: string): string | null {
  const read = readTag(tag)
  return read && (read.id === '' || read.id === id) ? read.version : null
}
