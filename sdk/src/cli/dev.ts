// `songstress dev`: builds the extension in a folder, packs it and pushes it
// to your own server as a development install (switched on, granted what its
// manifest asks, seen by you, its admin, alone), then does so again whenever
// a file changes; and prints its log as the server's extension host writes
// it. A build that fails, or a package the server refuses, is said here and
// pushes nothing: the last good one keeps running.

import { createHash } from 'node:crypto'
import { watch } from 'node:fs'
import { build } from './build.ts'
import { ARCHIVE_SUFFIX, pack } from './pack.ts'
import { Refused, type Server } from './remote.ts'

export interface DevOptions {
  readonly folder: string
  readonly server: Server
  /** Where the command's lines go. */
  readonly say: (line: string) => void
  /** Ends the loop. */
  readonly signal: AbortSignal
  /** How long the folder must be quiet after a change before the next build. */
  readonly settleMs?: number
}

/** A pause that ends early with signal. */
const pause = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms)
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        resolve()
      },
      { once: true },
    )
  })

/** Until signal ends it. */
const aborted = (signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    if (signal.aborted) resolve()
    else signal.addEventListener('abort', () => resolve(), { once: true })
  })

/** What a failure says. */
export function describe(error: unknown): string {
  if (error instanceof Refused && error.issues.length > 0) {
    return [`refused (${error.code}):`, ...error.issues.map((i) => `  ${i.code} at ${i.pointer || '/'}: ${i.message}`)].join('\n')
  }
  if (error instanceof Refused) return `refused (${error.code}): ${error.message}`
  return error instanceof Error ? error.message : String(error)
}

/** Paths whose changes start no build: what the command writes itself, and what a package never holds. */
const quiet = (path: string, built: ReadonlySet<string>) =>
  built.has(path) || path.endsWith(ARCHIVE_SUFFIX) || path.split('/').some((part) => part === 'node_modules' || part === '.git')

export async function dev(options: DevOptions): Promise<void> {
  const { folder, server, say, signal } = options
  const built = new Set<string>()
  let pushed = { id: '', digest: '' }
  const round = async () => {
    try {
      for (const entry of await build(folder)) built.add(entry)
      const { archive } = await pack(folder)
      const digest = createHash('sha256').update(archive).digest('hex')
      if (digest === pushed.digest) return
      const install = await server.push(archive)
      say(`pushed ${install.id} ${install.version}${install.statusDetail ? `: ${install.statusDetail}` : ''}`)
      if (pushed.id === '') void follow(server, install.id, say, signal)
      pushed = { id: install.id, digest }
    } catch (error) {
      say(error instanceof Refused ? describe(error) : `not pushed: ${describe(error)}`)
    }
  }
  const rounds = serial(round)
  await rounds()
  const settle = options.settleMs ?? 200
  let timer: ReturnType<typeof setTimeout> | undefined
  watch(folder, { recursive: true, signal }, (_event, file) => {
    if (file && quiet(file.split('\\').join('/'), built)) return
    clearTimeout(timer)
    timer = setTimeout(() => void rounds(), settle)
  }).on('error', (error) => say(`not watching: ${error.message}`))
  await aborted(signal)
  clearTimeout(timer)
}

/** run, one at a time: a call while one runs makes one more run after it. */
function serial(run: () => Promise<void>): () => Promise<void> {
  let current: Promise<void> | undefined
  let again = false
  const next = (): Promise<void> => {
    if (current) {
      again = true
      return current
    }
    current = run().finally(() => {
      current = undefined
      if (again) {
        again = false
        void next()
      }
    })
    return current
  }
  return next
}

/** follow prints the extension's log as it is written, from the start of what the host keeps. */
async function follow(server: Server, id: string, say: (line: string) => void, signal: AbortSignal): Promise<void> {
  let after = 0
  while (!signal.aborted) {
    try {
      for (const line of await server.logs(id, after, signal)) {
        say(`${id} ${line.level}: ${line.text}`)
        after = Math.max(after, line.seq)
      }
    } catch (error) {
      if (signal.aborted) return
      // No extension runs yet, or the server is away: ask again soon.
      if (!(error instanceof Refused && error.code === 'host-not-running')) say(`the log: ${describe(error)}`)
      await pause(2_000, signal)
    }
  }
}
