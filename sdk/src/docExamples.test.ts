import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

// Every usage example in the SDK's doc comments (an `@example`, which the API
// reference on songstress.app draws under its function) is real code: each is
// taken out of its comment and compiled, as a module of its own, against the
// SDK as an extension imports it (`songstress/server`, `songstress/testing`,
// ...). An example of what runs in an entry compiles against the sandbox's
// globals and nothing else (sandbox.d.ts), as an extension's own code does;
// one of what tools and tests use (the manifest's validator, the mock host)
// against Node's.

const ROOT = fileURLToPath(new URL('../', import.meta.url))

/** Where an example's code runs: an entry's sandbox, or Node (a tool, a test). */
const IN_NODE = /^src\/(manifest|testing)\//

interface Example {
  /** The file and the line its `@example` is on. */
  at: string
  code: string
  node: boolean
}

function sources(): string[] {
  const files = readdirSync(join(ROOT, 'src'), { recursive: true, encoding: 'utf8' })
    .filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts'))
    .map((file) => `src/${file}`)
  return [...files.sort(), 'sandbox.d.ts']
}

const lineOf = (text: string, index: number) => text.slice(0, index).split('\n').length

/** Each `@example` of each doc comment in a file, its code out of the ```ts fence it must be in. */
function examplesIn(file: string): Example[] {
  const text = readFileSync(join(ROOT, file), 'utf8')
  const found: Example[] = []
  for (const comment of text.matchAll(/\/\*\*[\s\S]*?\*\//g)) {
    const lines = comment[0].split('\n').map((line) => line.replace(/^\s*\*(?!\/) ?/, ''))
    lines.forEach((line, index) => {
      if (!line.trimStart().startsWith('@example')) return
      const at = `${file}:${lineOf(text, comment.index) + index}`
      const open = lines[index + 1]?.trim()
      const close = lines.findIndex((candidate, after) => after > index + 1 && candidate.trim() === '```')
      if (open !== '```ts' || close < 0) throw new Error(`${at}: an @example is a \`\`\`ts block, closed`)
      found.push({ at, code: lines.slice(index + 2, close).join('\n'), node: IN_NODE.test(file) })
    })
  }
  return found
}

const OPTIONS: ts.CompilerOptions = {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  lib: ['lib.es2023.d.ts'],
  strict: true,
  skipLibCheck: true,
  noEmit: true,
  esModuleInterop: true,
  resolveJsonModule: true,
  allowImportingTsExtensions: true,
  // Each example is a module of its own, an import or none.
  moduleDetection: ts.ModuleDetectionKind.Force,
}

/** What the compiler says of each example, as `file:line (its line n): message`. */
function compile(examples: Example[], node: boolean): string[] {
  // Inside the package, so `songstress/server` is the package itself, through its `exports`.
  const files = new Map(examples.map((example, index) => [join(ROOT, 'src', `__example-${index}.ts`), example]))
  const options = { ...OPTIONS, types: node ? ['node'] : [] }
  const host = ts.createCompilerHost(options)
  const { fileExists, readFile, getSourceFile } = host
  host.fileExists = (name) => files.has(name) || fileExists(name)
  host.readFile = (name) => files.get(name)?.code ?? readFile(name)
  host.getSourceFile = (name, version, ...rest) => {
    const example = files.get(name)
    return example ? ts.createSourceFile(name, example.code, version) : getSourceFile(name, version, ...rest)
  }
  const roots = [...files.keys(), ...(node ? [] : [join(ROOT, 'sandbox.d.ts')])]
  const program = ts.createProgram(roots, options, host)
  const said = [...program.getOptionsDiagnostics(), ...program.getGlobalDiagnostics()].map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'))
  for (const [name, example] of files) {
    const file = program.getSourceFile(name)!
    for (const d of [...program.getSyntacticDiagnostics(file), ...program.getSemanticDiagnostics(file)]) {
      const line = file.getLineAndCharacterOfPosition(d.start ?? 0).line + 1
      said.push(`${example.at} (its line ${line}): ${ts.flattenDiagnosticMessageText(d.messageText, '\n')}`)
    }
  }
  return said
}

describe('the usage examples in the doc comments', () => {
  const files = sources()
  const examples = files.flatMap(examplesIn)

  it('are every @example the sources hold', () => {
    const written = files.reduce((count, file) => count + (readFileSync(join(ROOT, file), 'utf8').match(/^\s*\* @example$/gm)?.length ?? 0), 0)
    expect(examples.length).toBe(written)
    expect(examples.length).toBeGreaterThan(0)
  })

  // Each group is one compiler program over the SDK: seconds alone, longer on a busy machine.
  it('compile in the sandbox, against the SDK as an extension imports it', { timeout: 120_000 }, () => {
    expect(compile(examples.filter((example) => !example.node), false)).toEqual([])
  })

  it('compile in Node, for the tools and the tests', { timeout: 120_000 }, () => {
    expect(compile(examples.filter((example) => example.node), true)).toEqual([])
  })
})
