// The official list's signed index: what the songstress-extensions
// repository publishes and every Songstress server reads (the server's
// index.go). The format is written out in the README beside this file.
//
// An index is a JSON payload (each extension's versions, each pinned by its
// package's SHA-256 and carrying its whole manifest; the block list; the
// repository's publishers.json, who is verified; when it was issued and
// until when it holds; a sequence that only grows) wrapped
// in a DSSE envelope (https://github.com/secure-systems-lab/dsse): the
// payload as base64 and one or more Ed25519 signatures over its
// pre-authentication encoding, each named by its key's id. A server holds
// it to a key built into it, refuses one past its expiry, and never takes a
// lower sequence than the last it took.

import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, sign, verify, type KeyObject } from 'node:crypto'
import { inflateRawSync } from 'node:zlib'

export const PAYLOAD_TYPE = 'application/vnd.songstress.extension-index+json'
export const FORMAT = 1

export interface IndexVersion {
  version: string
  /** When it was published: a server applies an update to it only a day
   * after (the cool-down). */
  published: string
  sha256: string
  size: number
  /** Where its package is: a release asset of the repository. */
  url: string
  /** Its whole songstress.json. */
  manifest: Record<string, unknown>
}

export interface IndexExtension {
  id: string
  /** Whether songstress.app's Marketplace shows it; every entry installs. */
  marketplace: boolean
  /** Newest first. */
  versions: IndexVersion[]
}

export interface Blocked {
  id: string
  /** The versions blocked; left out, every one. */
  versions?: string[]
  /** Packages blocked whatever their id. */
  sha256?: string[]
  reason: string
  at: string
}

/** One publisher of the repository's publishers.json. */
export interface Publisher {
  /** The publisher's name: the first part of its extensions' ids. */
  name: string
  /** Whether the list's owner verified who they are: the apps' Verified
   * badge comes from here alone, signed with the rest. */
  verified: boolean
}

export interface IndexPayload {
  format: typeof FORMAT
  issued: string
  expires: string
  sequence: number
  extensions: IndexExtension[]
  blocked: Blocked[]
  publishers: Publisher[]
}

export interface Envelope {
  payloadType: string
  payload: string
  signatures: { keyid: string; sig: string }[]
}

/** DSSE's pre-authentication encoding: what is signed. */
export function pae(type: string, body: Buffer): Buffer {
  const head = `DSSEv1 ${Buffer.byteLength(type)} ${type} ${body.length} `
  return Buffer.concat([Buffer.from(head), body])
}

/** A raw Ed25519 public key's 32 bytes, base64: what a server builds in. */
export function rawPublicKey(key: KeyObject): string {
  const der = key.export({ format: 'der', type: 'spki' })
  return der.subarray(der.length - 32).toString('base64')
}

/** A key's id: the first 16 hex digits of its raw key's SHA-256. */
export function keyId(rawBase64: string): string {
  return createHash('sha256').update(Buffer.from(rawBase64, 'base64')).digest('hex').slice(0, 16)
}

/** A new signing key: the private key as PKCS#8 PEM, kept by its owner
 * alone, and the public key as a server builds it in. */
export function newKey(): { privatePem: string; publicKey: string; keyid: string } {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519')
  const raw = rawPublicKey(publicKey)
  return { privatePem: privateKey.export({ format: 'pem', type: 'pkcs8' }).toString(), publicKey: raw, keyid: keyId(raw) }
}

/** The payload, signed by each private key given. */
export function signIndex(payload: IndexPayload, privatePems: string[]): Envelope {
  const body = Buffer.from(JSON.stringify(payload))
  const signatures = privatePems.map((pem) => {
    const key = createPrivateKey(pem)
    const raw = rawPublicKey(createPublicKey(key))
    return { keyid: keyId(raw), sig: sign(null, pae(PAYLOAD_TYPE, body), key).toString('base64') }
  })
  return { payloadType: PAYLOAD_TYPE, payload: body.toString('base64'), signatures }
}

/** The payload, when one of the trusted keys signed it; else why not. */
export function verifyIndex(envelope: Envelope, trusted: string[]): IndexPayload {
  if (envelope.payloadType !== PAYLOAD_TYPE) throw new Error(`not an index: ${envelope.payloadType}`)
  const body = Buffer.from(envelope.payload, 'base64')
  const keys = new Map(trusted.map((raw) => [keyId(raw), raw]))
  const signed = envelope.signatures.some(({ keyid, sig }) => {
    const raw = keys.get(keyid)
    if (!raw) return false
    const key = createPublicKey({ key: Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), Buffer.from(raw, 'base64')]), format: 'der', type: 'spki' })
    return verify(null, pae(PAYLOAD_TYPE, body), key, Buffer.from(sig, 'base64'))
  })
  if (!signed) throw new Error('no trusted key signed the index')
  const payload = JSON.parse(body.toString()) as IndexPayload
  if (payload.format !== FORMAT) throw new Error(`index format ${payload.format} is not ${FORMAT}`)
  return payload
}

/** The files of a ZIP archive (stored or deflated), by path. */
function unzip(archive: Buffer): Map<string, Buffer> {
  const out = new Map<string, Buffer>()
  const end = archive.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]))
  if (end < 0) throw new Error('not a ZIP archive')
  let at = archive.readUInt32LE(end + 16)
  for (let n = archive.readUInt16LE(end + 10); n > 0; n--) {
    const method = archive.readUInt16LE(at + 10)
    const size = archive.readUInt32LE(at + 20)
    const nameLength = archive.readUInt16LE(at + 28)
    const extra = archive.readUInt16LE(at + 30) + archive.readUInt16LE(at + 32)
    const local = archive.readUInt32LE(at + 42)
    const name = archive.subarray(at + 46, at + 46 + nameLength).toString()
    const start = local + 30 + archive.readUInt16LE(local + 26) + archive.readUInt16LE(local + 28)
    const data = archive.subarray(start, start + size)
    out.set(name, method === 8 ? inflateRawSync(data) : Buffer.from(data))
    at += 46 + nameLength + extra
  }
  return out
}

/** One version's entry, from its package archive. */
export function versionOf(archive: Buffer, url: (id: string, version: string) => string, published: string): { id: string; entry: IndexVersion } {
  const raw = unzip(archive).get('songstress.json')
  if (!raw) throw new Error('the package has no songstress.json')
  const manifest = JSON.parse(raw.toString()) as Record<string, unknown> & { id: string; version: string }
  return {
    id: manifest.id,
    entry: {
      version: manifest.version,
      published,
      sha256: createHash('sha256').update(archive).digest('hex'),
      size: archive.length,
      url: url(manifest.id, manifest.version),
      manifest,
    },
  }
}
