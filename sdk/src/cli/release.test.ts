import { describe, expect, it } from 'vitest'
import { assetName, readTag, releaseTag, versionOfTag } from './release.ts'

// A release's tag and asset, in both ways a repository holds extensions
// (SPEC.md, "A release"): one at its root, on its version; several, each on
// <id>@<version>.

describe('a release', () => {
  it('is tagged v<version> in a repository of one, and <id>@<version> in one of several', () => {
    // v1.2.0, as `npm version` and most release tools tag; the server takes 1.2.0 too (versionOfTag below).
    expect(releaseTag('acme.tunelog', '1.2.0', 'one')).toBe('v1.2.0')
    expect(releaseTag('songstress.soundcloud', '1.2.0', 'several')).toBe('songstress.soundcloud@1.2.0')
    expect(assetName('songstress.soundcloud', '1.2.0')).toBe('songstress.soundcloud-1.2.0.songstress')
  })

  it("reads the version a tag names for an extension, never another extension's", () => {
    expect(versionOfTag('1.2.0', 'acme.tunelog')).toBe('1.2.0')
    expect(versionOfTag('v1.2.0', 'acme.tunelog')).toBe('1.2.0')
    expect(versionOfTag('songstress.soundcloud@2.0.0-beta.1', 'songstress.soundcloud')).toBe('2.0.0-beta.1')
    expect(versionOfTag('songstress.jiosaavn@1.0.0', 'songstress.soundcloud')).toBeNull()
    for (const tag of ['latest', 'v1', 'songstress.soundcloud@', '@1.0.0', 'songstress.soundcloud@v1.0.0']) {
      expect(versionOfTag(tag, 'songstress.soundcloud'), tag).toBeNull()
    }
  })

  it('says which extension a tag of a repository of several names', () => {
    expect(readTag('songstress.soundcloud@1.2.0')).toEqual({ id: 'songstress.soundcloud', version: '1.2.0' })
    expect(readTag('v1.2.0')).toEqual({ id: '', version: '1.2.0' })
    expect(readTag('nightly')).toBeNull()
  })
})
