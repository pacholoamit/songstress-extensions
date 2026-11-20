#!/usr/bin/env node
// What the index workflow (.github/workflows/index.yml) needs of this
// repository's releases and of the index it published last. Node runs it as
// it is (type stripping).
//
//   node index/releases.ts pick <releases.json> <id>...
//       the releases the next index lists, one a line, "<tag> <asset>": each
//       extension's newest full releases, KEEP of them, by version
//   node index/releases.ts stamp <payload.json> <releases.json>
//       the payload, each version's `published` the time its own release was
//       published (cli.ts `build` stamps one time on every version, and a
//       server's day of cool-down before an update counts from it)
//   node index/releases.ts sequence [<index.json>]
//       the next index's sequence: one more than the one published last, or
//       1 when there is none
//
// <releases.json> is GitHub's list of this repository's releases:
//   gh release list --limit 1000 --json tagName,publishedAt,isDraft,isPrerelease

import { existsSync, readFileSync } from 'node:fs'
import type { IndexPayload } from './index.ts'

/** How many versions of each extension an index lists, newest first: the
 * newest, and what a server keeps while that one is still a day young. */
export const KEEP = 3

/** A release, as `gh release list --json` gives it. */
export interface Release {
  tagName: string
  publishedAt: string
  isDraft: boolean
  isPrerelease: boolean
}

const VERSION = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.+-]+)?$/

/** Newest first, as cli.ts orders an extension's versions. */
const newestFirst = (a: string, b: string): number => b.localeCompare(a, 'en', { numeric: true })

/** Each extension's newest full releases, KEEP of them, as [tag, asset]. A
 * tag names its extension whole (`songstress.soundcloud@1.2.0`), so another
 * extension's releases are never taken for this one's. */
export function pick(releases: Release[], ids: string[]): [tag: string, asset: string][] {
  return ids.flatMap((id) =>
    releases
      .filter((release) => !release.isDraft && !release.isPrerelease && release.tagName.startsWith(`${id}@`))
      .map((release) => release.tagName.slice(id.length + 1))
      .filter((version) => VERSION.test(version))
      .sort(newestFirst)
      .slice(0, KEEP)
      .map((version): [string, string] => [`${id}@${version}`, `${id}-${version}.songstress`]),
  )
}

/** The payload with each version's `published` its own release's time. */
export function stamp(payload: IndexPayload, releases: Release[]): IndexPayload {
  const times = new Map(releases.map((release) => [release.tagName, release.publishedAt]))
  const extensions = payload.extensions.map((extension) => ({
    ...extension,
    versions: extension.versions.map((version) => {
      const at = times.get(`${extension.id}@${version.version}`)
      if (!at || Number.isNaN(Date.parse(at))) throw new Error(`${extension.id}@${version.version}: no release says when it was published`)
      return { ...version, published: new Date(at).toISOString() }
    }),
  }))
  return { ...payload, extensions }
}

/** The sequence after the one the last published index carries. A server
 * refuses an index whose sequence is not above the last it took, so one that
 * can't be read stops the workflow rather than start again from 1. */
export function nextSequence(last: string | null): number {
  if (last === null) return 1
  let sequence: unknown
  try {
    const envelope = JSON.parse(last) as { payload?: unknown }
    sequence = (JSON.parse(Buffer.from(String(envelope.payload), 'base64').toString()) as { sequence?: unknown }).sequence
  } catch {
    sequence = undefined
  }
  if (typeof sequence !== 'number' || !Number.isSafeInteger(sequence) || sequence < 1) throw new Error('the index published last carries no sequence: mend the index branch by hand before signing another')
  return sequence + 1
}

function main(argv: string[]): number {
  const [command, ...rest] = argv
  const releases = (file: string): Release[] => JSON.parse(readFileSync(file, 'utf8')) as Release[]
  switch (command) {
    case 'pick': {
      for (const [tag, asset] of pick(releases(rest[0]!), rest.slice(1))) console.log(`${tag} ${asset}`)
      return 0
    }
    case 'stamp': {
      console.log(JSON.stringify(stamp(JSON.parse(readFileSync(rest[0]!, 'utf8')) as IndexPayload, releases(rest[1]!)), null, 2))
      return 0
    }
    case 'sequence': {
      console.log(nextSequence(rest[0] && existsSync(rest[0]) ? readFileSync(rest[0], 'utf8') : null))
      return 0
    }
  }
  console.error('node index/releases.ts pick | stamp | sequence (see the top of this file)')
  return 2
}

if (import.meta.main) process.exitCode = main(process.argv.slice(2))
