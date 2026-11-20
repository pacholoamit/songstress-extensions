// What the index workflow takes from the repository's releases: which ones the
// next index lists, when each was published, and the sequence after the last.

import { describe, expect, it } from 'vitest'
import type { IndexPayload } from './index'
import { KEEP, nextSequence, pick, stamp, type Release } from './releases'

const release = (tagName: string, more: Partial<Release> = {}): Release => ({ tagName, publishedAt: '2026-11-18T09:30:00Z', isDraft: false, isPrerelease: false, ...more })

describe('pick', () => {
  it("takes each extension's newest full releases by version, and only its own", () => {
    const releases = [
      release('songstress.soundcloud@1.2.0'),
      release('songstress.soundcloud@1.10.0'),
      release('songstress.soundcloud@1.9.1'),
      release('songstress.soundcloud@1.1.0'),
      release('songstress.soundcloud@2.0.0', { isDraft: true }),
      release('songstress.soundcloud@1.11.0-beta.1', { isPrerelease: true }),
      // Another extension whose id begins with this one's, and a tag that names no version.
      release('songstress.soundcloud-lite@9.0.0'),
      release('songstress.soundcloud@latest'),
      release('songstress.jiosaavn@0.3.0'),
    ]
    expect(KEEP).toBe(3)
    expect(pick(releases, ['songstress.soundcloud', 'songstress.jiosaavn', 'songstress.genie-music'])).toEqual([
      ['songstress.soundcloud@1.10.0', 'songstress.soundcloud-1.10.0.songstress'],
      ['songstress.soundcloud@1.9.1', 'songstress.soundcloud-1.9.1.songstress'],
      ['songstress.soundcloud@1.2.0', 'songstress.soundcloud-1.2.0.songstress'],
      ['songstress.jiosaavn@0.3.0', 'songstress.jiosaavn-0.3.0.songstress'],
    ])
  })
})

describe('stamp', () => {
  const payload = (versions: string[]): IndexPayload => ({
    format: 1,
    issued: '2026-11-20T00:00:00.000Z',
    expires: '2026-12-20T00:00:00.000Z',
    sequence: 4,
    extensions: [{ id: 'songstress.soundcloud', marketplace: false, versions: versions.map((version) => ({ version, published: '2026-11-20T00:00:00.000Z', sha256: 'a'.repeat(64), size: 10, url: 'https://example.invalid', manifest: {} })) }],
    blocked: [],
    publishers: [{ name: 'songstress', verified: true }],
  })

  it('gives each version the time its own release was published, and nothing else changes', () => {
    const stamped = stamp(payload(['1.2.0', '1.1.0']), [release('songstress.soundcloud@1.2.0', { publishedAt: '2026-11-19T08:00:00Z' }), release('songstress.soundcloud@1.1.0', { publishedAt: '2026-10-02T12:15:00Z' })])
    expect(stamped.extensions[0]!.versions.map((one) => one.published)).toEqual(['2026-11-19T08:00:00.000Z', '2026-10-02T12:15:00.000Z'])
    expect({ ...stamped, extensions: [] }).toEqual({ ...payload([]), extensions: [] })
  })

  it('refuses a version no release accounts for', () => {
    expect(() => stamp(payload(['1.3.0']), [release('songstress.soundcloud@1.2.0')])).toThrow('songstress.soundcloud@1.3.0: no release says when it was published')
  })
})

describe('nextSequence', () => {
  const published = (payload: unknown): string => JSON.stringify({ payloadType: 'application/vnd.songstress.extension-index+json', payload: Buffer.from(JSON.stringify(payload)).toString('base64'), signatures: [] })

  it('starts at 1, and is one more than the index published last', () => {
    expect(nextSequence(null)).toBe(1)
    expect(nextSequence(published({ sequence: 41 }))).toBe(42)
  })

  it('stops rather than start again when the last index carries no sequence', () => {
    for (const broken of ['not json', published({}), published({ sequence: 0 }), published({ sequence: 1.5 })]) expect(() => nextSequence(broken)).toThrow('mend the index branch by hand')
  })
})
