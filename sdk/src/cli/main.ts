#!/usr/bin/env node
// The songstress command (README.md, "The command"): build, pack, check, dev. It is
// TypeScript that Node runs as it is (type stripping, Node 22.18 and 24.3 on),
// so its own files import each other by their .ts names and nothing from the
// rest of the package.

import { realpathSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { build } from './build.ts'
import { check, report } from './check.ts'
import { describe, dev } from './dev.ts'
import { pack } from './pack.ts'
import { connect } from './remote.ts'

const HELP = `songstress <command> [folder]

  build    Build each entry the manifest names under dist/ from its source
           under src/ (dist/server.js from src/server.ts), one classic script.
  pack     Build, then write the package's archive, <id>-<version>.songstress
           (--out <file> to name it): what a release carries, what a server
           installs from a file.
  check    Check the manifest of each extension the folder holds, as a
           server does when it installs one, and say what its release is
           called. A folder holds one extension (songstress.json at its
           root) or several, one folder each, released on <id>@<version>.
             --profile <name>  install (the default), or listing: what the
                               Marketplace asks of a listing on top
  dev      Build, pack and push it to your own server as a development
           install, seen by you alone; again on every change. Prints its log.
             --server <url>    your Songstress server, http or https
                               (or SONGSTRESS_SERVER)
             --email <email>   an admin of it (or SONGSTRESS_EMAIL), with the
                               password in SONGSTRESS_PASSWORD;
                               or SONGSTRESS_TOKEN, a session of an admin's

The folder is the extension's, where songstress.json is: . by default (for
check, a repository's root holding several, one folder each, is too).
`

type Env = Readonly<Record<string, string | undefined>>

const OPTIONS = {
  server: { type: 'string' },
  email: { type: 'string' },
  out: { type: 'string' },
  profile: { type: 'string' },
  help: { type: 'boolean', short: 'h' },
} as const

type Values = ReturnType<typeof parseArgs<{ args: string[]; allowPositionals: true; options: typeof OPTIONS }>>['values']

/** What one command is handed: the folder, the options, the environment,
 * where its lines go, and the signal that stops it. */
interface Run {
  readonly folder: string
  readonly values: Values
  readonly env: Env
  readonly say: (line: string) => void
  readonly signal: AbortSignal
}

/** Each command, by its name: its exit code. */
const COMMANDS: Readonly<Record<string, (run: Run) => Promise<number>>> = {
  async build({ folder, say }) {
    for (const entry of await build(folder)) say(`built ${entry}`)
    return 0
  },
  async check({ folder, values, say }) {
    const { lines, ok } = report(folder, await check(folder, values.profile ?? 'install'))
    for (const line of lines) say(line)
    return ok ? 0 : 1
  },
  async pack({ folder, values, say }) {
    await build(folder)
    const { name, archive } = await pack(folder)
    const out = values.out ?? join(process.cwd(), name)
    await writeFile(out, archive)
    say(`packed ${out} (${archive.length} bytes)`)
    return 0
  },
  async dev({ folder, values, env, say, signal }) {
    const url = values.server ?? env.SONGSTRESS_SERVER
    if (!url) throw new Error('Name your server: --server http://your-server:8090 (or SONGSTRESS_SERVER).')
    const server = await connect(url, {
      token: env.SONGSTRESS_TOKEN,
      email: values.email ?? env.SONGSTRESS_EMAIL,
      password: env.SONGSTRESS_PASSWORD,
    })
    say(`pushing ${folder} to ${url} as you change it; Ctrl-C to stop`)
    await dev({ folder, server, say, signal })
    return 0
  },
}

/** Runs the command; its exit code. */
export async function main(args: readonly string[], env: Env, say: (line: string) => void, signal: AbortSignal): Promise<number> {
  let parsed: ReturnType<typeof parseArgs<{ args: string[]; allowPositionals: true; options: typeof OPTIONS }>>
  try {
    parsed = parseArgs({ args: [...args], allowPositionals: true, options: OPTIONS })
  } catch (error) {
    // An option the command does not know, or one without its value.
    say(`${describe(error)}\n\n${HELP}`)
    return 2
  }
  const { values, positionals } = parsed
  const [command, where = '.'] = positionals
  const run = command !== undefined && Object.hasOwn(COMMANDS, command) ? COMMANDS[command] : undefined
  if (run === undefined) {
    say(HELP)
    return command === undefined || values.help ? 0 : 2
  }
  try {
    return await run({ folder: resolve(where), values, env, say, signal })
  } catch (error) {
    say(describe(error))
    return 1
  }
}

/** Whether Node runs this file as the program: as it is, or through a link (a package's bin is one, and Node
 * names the program by its real path). */
function isProgram(): boolean {
  try {
    return process.argv[1] !== undefined && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)
  } catch {
    return false
  }
}

if (isProgram()) {
  const stop = new AbortController()
  process.once('SIGINT', () => stop.abort())
  main(process.argv.slice(2), process.env, (line) => console.log(line), stop.signal).then((code) => process.exit(code))
}
