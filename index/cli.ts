#!/usr/bin/env node
// The official list's index, made and signed: what the songstress-extensions
// repository's release workflow runs, and its owner by hand. Node runs it
// as it is (type stripping).
//
//   node index/cli.ts keygen <private-key-file>
//       a new Ed25519 key: the private key written to the file (mode 0600,
//       never into a repository), the public key printed as a server builds
//       it in, with its id
//   node index/cli.ts build <package>... --url <template> --publishers <file>
//                     [--marketplace <id>...] [--published <iso>] [--sequence <n>]
//                     [--days <n>] [--blocked <file>]
//       the payload, printed: each package's manifest, size and SHA-256, its
//       address from the template ({id}, {version}, {file}), the block list
//       and the publishers (publishers.json, required: who is verified comes
//       from it alone, so an index without it would verify nobody) as the
//       files say, valid for --days (30) from now
//   node index/cli.ts sign <payload-file> <private-key-file>...
//       the DSSE envelope, printed: index.json
//   node index/cli.ts verify <index-file> <public-key>...
//       the payload, when one of the public keys signed it

import { chmodSync, readFileSync, writeFileSync } from 'node:fs'
import { basename } from 'node:path'
import { parseArgs } from 'node:util'
import { FORMAT, newKey, signIndex, verifyIndex, versionOf, type Blocked, type IndexExtension, type IndexPayload, type Publisher } from './index.ts'

const DAY_MS = 24 * 60 * 60 * 1000

/** A publisher's name, as an id's first part has it. */
const PUBLISHER_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** publishers.json as the server reads it, or why not: a list of
 * {name, verified}, each name once. A file the server could not read would
 * make every server refuse the index it is signed into. */
export function checkedPublishers(raw: unknown): Publisher[] {
  if (!Array.isArray(raw)) throw new Error('publishers.json is not a list of {name, verified}')
  const seen = new Set<string>()
  return raw.map((entry: unknown, at) => {
    const { name, verified } = (entry ?? {}) as { name?: unknown; verified?: unknown }
    if (typeof name !== 'string' || !PUBLISHER_NAME.test(name)) throw new Error(`publishers.json[${at}]: "name" is not a publisher's name`)
    if (typeof verified !== 'boolean') throw new Error(`publishers.json[${at}] (${name}): "verified" is not true or false`)
    if (seen.has(name)) throw new Error(`publishers.json names ${name} twice`)
    seen.add(name)
    return { name, verified }
  })
}

/** The payload of the packages given. */
export function buildPayload(
  packages: { file: string; archive: Buffer }[],
  options: {
    url: string
    marketplace: string[]
    published: string
    sequence: number
    days: number
    blocked: Blocked[]
    publishers: unknown
    now: number
  },
): IndexPayload {
  const publishers = checkedPublishers(options.publishers)
  const byId = new Map<string, IndexExtension>()
  for (const { file, archive } of packages) {
    const address = (id: string, version: string) =>
      options.url.replaceAll('{id}', encodeURIComponent(id)).replaceAll('{version}', encodeURIComponent(version)).replaceAll('{file}', encodeURIComponent(file))
    const { id, entry } = versionOf(archive, address, options.published)
    const extension = byId.get(id) ?? { id, marketplace: options.marketplace.includes(id), versions: [] }
    extension.versions.push(entry)
    byId.set(id, extension)
  }
  for (const extension of byId.values()) extension.versions.sort((a, b) => b.version.localeCompare(a.version, 'en', { numeric: true }))
  return {
    format: FORMAT,
    issued: new Date(options.now).toISOString(),
    expires: new Date(options.now + options.days * DAY_MS).toISOString(),
    sequence: options.sequence,
    extensions: [...byId.values()].sort((a, b) => a.id.localeCompare(b.id)),
    blocked: options.blocked,
    publishers: publishers.sort((a, b) => a.name.localeCompare(b.name)),
  }
}

function main(argv: string[]): number {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      url: { type: 'string' },
      marketplace: { type: 'string', multiple: true, default: [] },
      published: { type: 'string' },
      sequence: { type: 'string', default: '1' },
      days: { type: 'string', default: '30' },
      blocked: { type: 'string' },
      publishers: { type: 'string' },
    },
  })
  const [command, ...rest] = positionals
  switch (command) {
    case 'keygen': {
      const key = newKey()
      writeFileSync(rest[0]!, key.privatePem, { mode: 0o600 })
      chmodSync(rest[0]!, 0o600)
      console.log(JSON.stringify({ keyid: key.keyid, publicKey: key.publicKey }))
      return 0
    }
    case 'build': {
      if (!values.url) throw new Error('Name where the packages are: --url https://github.com/<owner>/songstress-extensions/releases/download/{id}%40{version}/{file}')
      if (!values.publishers) throw new Error('Name the publishers: --publishers publishers.json (who is verified comes from it alone: an index without it verifies nobody)')
      const payload = buildPayload(
        rest.map((file) => ({ file: basename(file), archive: readFileSync(file) })),
        {
          url: values.url,
          marketplace: values.marketplace,
          published: values.published ?? new Date().toISOString(),
          sequence: Number(values.sequence),
          days: Number(values.days),
          blocked: values.blocked ? (JSON.parse(readFileSync(values.blocked, 'utf8')) as Blocked[]) : [],
          publishers: JSON.parse(readFileSync(values.publishers, 'utf8')) as unknown,
          now: Date.now(),
        },
      )
      console.log(JSON.stringify(payload, null, 2))
      return 0
    }
    case 'sign': {
      const payload = JSON.parse(readFileSync(rest[0]!, 'utf8')) as IndexPayload
      console.log(JSON.stringify(signIndex(payload, rest.slice(1).map((file) => readFileSync(file, 'utf8')))))
      return 0
    }
    case 'verify': {
      console.log(JSON.stringify(verifyIndex(JSON.parse(readFileSync(rest[0]!, 'utf8')), rest.slice(1)), null, 2))
      return 0
    }
  }
  console.error('node index/cli.ts keygen | build | sign | verify (see the top of this file)')
  return 2
}

if (import.meta.main) process.exitCode = main(process.argv.slice(2))
