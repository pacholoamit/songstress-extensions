// The package's public surface, as text: every export of every entry as its
// declaration, and every member of the API with the permission it needs. The
// declarations are the ones TypeScript would emit for a published build, so
// the text changes exactly when what an author can see changes, and never
// for a comment, a body or a file that moved.

import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { API_PERMISSIONS } from '../host'

const ROOT = fileURLToPath(new URL('../../', import.meta.url))

/** The package's entries, as package.json exports them. */
const ENTRIES: readonly (readonly [name: string, file: string])[] = [
  ['songstress', 'src/index.ts'],
  ['songstress/server', 'src/server.ts'],
  ['songstress/client', 'src/client.ts'],
  ['songstress/manifest', 'src/manifest.ts'],
  ['songstress/testing', 'src/testing.ts'],
]

const OPTIONS: ts.CompilerOptions = {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  lib: ['lib.es2023.d.ts'],
  types: [],
  strict: true,
  skipLibCheck: true,
  resolveJsonModule: true,
  esModuleInterop: true,
  declaration: true,
  emitDeclarationOnly: true,
  removeComments: true,
  outDir: join(ROOT, '.declarations'),
  rootDir: ROOT,
}

const declarationOf = (file: string) => join(ROOT, '.declarations', file.replace(/\.ts$/, '.d.ts'))

/** The files the entries reach that are neither the package's own source,
 * nor its schema, nor the language's standard library. There must be none:
 * the package depends on nothing. */
function reachedOutside(program: ts.Program): string[] {
  const own = [join(ROOT, 'src'), join(ROOT, 'schema')]
  return program
    .getSourceFiles()
    .filter((file) => !program.isSourceFileDefaultLibrary(file))
    .map((file) => file.fileName)
    .filter((name) => !own.some((folder) => name.startsWith(folder)))
}

/** The declaration files of the whole package, in memory. Compiling here is
 * also the proof that the package runs anywhere: it is given the ES2023
 * library and nothing else (no DOM, no Node), so a source file that touches
 * `process`, `Buffer`, `window` or `fetch` does not compile. */
function emitDeclarations(): Map<string, string> {
  const program = ts.createProgram(ENTRIES.map(([, file]) => join(ROOT, file)), OPTIONS)
  const outside = reachedOutside(program)
  if (outside.length > 0) throw new Error(`The package's entries reach outside it: ${outside.join(', ')}`)
  const files = new Map<string, string>()
  const { diagnostics } = program.emit(undefined, (name, text) => files.set(name, text))
  const problems = [...ts.getPreEmitDiagnostics(program), ...diagnostics]
  if (problems.length > 0) {
    throw new Error(problems.map((problem) => ts.flattenDiagnosticMessageText(problem.messageText, '\n')).join('\n'))
  }
  return files
}

/** A compiler host that reads the emitted declarations from memory and
 * everything else (the standard library) from disk. */
function hostOver(files: Map<string, string>): ts.CompilerHost {
  const host = ts.createCompilerHost(OPTIONS)
  const { fileExists, readFile, getSourceFile, directoryExists } = host
  const emitted = join(ROOT, '.declarations')
  host.fileExists = (name) => files.has(name) || fileExists(name)
  // The folders of the emitted files exist nowhere but here.
  host.directoryExists = (name) => name.startsWith(emitted) || (directoryExists?.(name) ?? true)
  host.realpath = (name) => name
  host.readFile = (name) => files.get(name) ?? readFile(name)
  host.getSourceFile = (name, version, ...rest) => {
    const text = files.get(name)
    return text === undefined ? getSourceFile(name, version, ...rest) : ts.createSourceFile(name, text, version)
  }
  return host
}

const printer = ts.createPrinter({ removeComments: true })

/** A declaration as text. A variable is printed with its statement, which is
 * where "declare const" is. */
function print(node: ts.Declaration): string {
  const whole = ts.isVariableDeclaration(node) ? node.parent.parent : node
  return printer.printNode(ts.EmitHint.Unspecified, whole, node.getSourceFile())
}

/** Each export of `source` under its name, as its declaration. An export an
 * earlier entry already showed with the same declaration is only named: the
 * three code entries share most of their types. */
function exportsOf(checker: ts.TypeChecker, source: ts.SourceFile, shown: Map<string, string>): string[] {
  const module = checker.getSymbolAtLocation(source)
  if (!module) throw new Error(`${source.fileName} exports nothing`)
  return checker
    .getExportsOfModule(module)
    .map((symbol) => {
      const target = symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol
      const declarations = (target.declarations ?? []).map(print).join('\n')
      if (declarations === '') throw new Error(`${source.fileName}: the export ${symbol.name} has no declaration`)
      if (shown.get(symbol.name) === declarations) return `${symbol.name}: as above`
      // One name means one thing in every entry. `songstress` alone differs:
      // it is each entry's own API.
      if (shown.has(symbol.name) && symbol.name !== 'songstress') {
        throw new Error(`${symbol.name} is exported by two entries with two different declarations`)
      }
      shown.set(symbol.name, declarations)
      return `${symbol.name}:\n${declarations}`
    })
    .sort()
}

function members(): string[] {
  return Object.entries(API_PERMISSIONS).flatMap(([entry, table]) =>
    Object.entries(table).map(([name, needs]) => `${entry} ${name} needs ${needs ?? 'nothing'}`),
  )
}

/** The surface, entry by entry. */
export function renderSurface(): string {
  const files = emitDeclarations()
  const roots = ENTRIES.map(([, file]) => declarationOf(file))
  const program = ts.createProgram(roots, { ...OPTIONS, declaration: false, emitDeclarationOnly: false, noEmit: true }, hostOver(files))
  const checker = program.getTypeChecker()
  const shown = new Map<string, string>()
  const sections = ENTRIES.map(([name, file]) => {
    const source = program.getSourceFile(declarationOf(file))
    if (!source) throw new Error(`no declarations were emitted for ${file}`)
    return `== ${name} ==\n\n${exportsOf(checker, source, shown).join('\n\n')}`
  })
  return `${sections.join('\n\n')}\n\n== members ==\n\n${members().join('\n')}\n`
}
