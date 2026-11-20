// The index, made from the official extensions' own packages (packed here,
// as their releases carry them), signed and read back. The key is the tests'
// own, from a fixed seed: no server trusts it but in its tests.

import { execFileSync } from 'node:child_process'
import { createPrivateKey, createPublicKey } from 'node:crypto'
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'
import { buildPayload, checkedPublishers } from './cli'
import { keyId, newKey, pae, PAYLOAD_TYPE, rawPublicKey, signIndex, verifyIndex, type Envelope } from './index'

const root = fileURLToPath(new URL('..', import.meta.url))
const command = join(root, 'node_modules/.bin/songstress')
const PORTS = readdirSync(root, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name !== 'sdk' && readdirSync(join(root, entry.name)).includes('songstress.json'))
  .map((entry) => entry.name)
  .sort()

const TEST_SEED = Buffer.from('songstress official index tests!')
const TEST_KEY = createPrivateKey({ key: Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), TEST_SEED]), format: 'der', type: 'pkcs8' })
const TEST_PEM = TEST_KEY.export({ format: 'pem', type: 'pkcs8' }).toString()
const TEST_PUBLIC = rawPublicKey(createPublicKey(TEST_KEY))

/** Each official extension's package, packed into a folder of the test's own. */
const out = mkdtempSync(join(tmpdir(), 'songstress-index-'))
afterAll(() => rmSync(out, { recursive: true, force: true }))
const PACKAGES = PORTS.map((folder) => {
  const file = join(out, `${folder}.songstress`)
  execFileSync(command, ['pack', join(root, folder), '--out', file], { stdio: 'pipe' })
  const { id, version } = JSON.parse(readFileSync(join(root, folder, 'songstress.json'), 'utf8')) as { id: string; version: string }
  return { file: `${id}-${version}.songstress`, archive: readFileSync(file) }
})

function payload() {
  return buildPayload(PACKAGES, {
    url: 'https://github.com/pacholoamit/songstress-extensions/releases/download/{id}%40{version}/{file}',
    marketplace: [],
    published: '2026-11-18T00:00:00.000Z',
    sequence: 1,
    days: 30,
    blocked: [],
    publishers: [{ name: 'songstress', verified: true }],
    now: Date.parse('2026-11-18T00:00:00.000Z'),
  })
}

describe('publishers.json', () => {
  it('is taken as the server reads it, each name once', () => {
    expect(checkedPublishers([{ name: 'songstress', verified: true, note: 'kept out' }])).toEqual([{ name: 'songstress', verified: true }])
  })

  it('is refused, before anything is signed, when a server could not read it', () => {
    for (const [raw, said] of [
      [{ name: 'songstress', verified: true }, 'not a list'],
      [[{ name: 'songstress', verified: 'true' }], '"verified" is not true or false'],
      [[{ name: 'Songstress', verified: true }], 'not a publisher'],
      [[{ name: 'songstress', verified: true }, { name: 'songstress', verified: false }], 'names songstress twice'],
    ] as const) {
      expect(() => checkedPublishers(raw), said).toThrow(said)
    }
  })
})

describe('the official index', () => {
  it('is signed as DSSE says, and read back with the key', () => {
    const made = payload()
    const envelope = signIndex(made, [TEST_PEM])
    expect(envelope.payloadType).toBe(PAYLOAD_TYPE)
    expect(envelope.signatures).toEqual([{ keyid: keyId(TEST_PUBLIC), sig: expect.any(String) }])
    expect(verifyIndex(envelope, [TEST_PUBLIC])).toEqual(made)
    expect(pae('t', Buffer.from('ab')).toString()).toBe('DSSEv1 1 t 2 ab')
  })

  it('names each package at its release, by its digest, with its manifest', () => {
    const made = payload()
    expect(made.extensions.map((e) => e.id)).toEqual(PORTS.map((folder) => `songstress.${folder}`))
    const soundcloud = made.extensions.find((e) => e.id === 'songstress.soundcloud')!.versions[0]!
    expect(soundcloud.url).toBe('https://github.com/pacholoamit/songstress-extensions/releases/download/songstress.soundcloud%401.0.0/songstress.soundcloud-1.0.0.songstress')
    expect(soundcloud.sha256).toMatch(/^[0-9a-f]{64}$/)
    expect((soundcloud.manifest as { id: string }).id).toBe('songstress.soundcloud')
  })

  it('refuses another key, a changed payload and another type', () => {
    const envelope = signIndex(payload(), [TEST_PEM])
    expect(() => verifyIndex(envelope, [newKey().publicKey])).toThrow('no trusted key')
    const changed: Envelope = { ...envelope, payload: Buffer.from(Buffer.from(envelope.payload, 'base64').toString().replace('"sequence":1', '"sequence":9')).toString('base64') }
    expect(() => verifyIndex(changed, [TEST_PUBLIC])).toThrow('no trusted key')
    expect(() => verifyIndex({ ...envelope, payloadType: 'application/json' }, [TEST_PUBLIC])).toThrow('not an index')
  })
})
