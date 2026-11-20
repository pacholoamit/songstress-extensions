// How the tests reach the corpus: the folder beside this package's source,
// read as the bytes any other parser would be handed.

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import table from '../../corpus/cases.json'
import themeTable from '../../corpus/themes.json'
import type { ManifestErrorCode } from '../manifest/codes'
import type { ThemeAppearance } from '../manifest/schema'
import type { ManifestProfile } from '../manifest/validate'

const CORPUS = fileURLToPath(new URL('../../corpus/', import.meta.url))

export interface CorpusCase {
  /** The manifest, from the corpus folder. */
  readonly file: string
  readonly profile: ManifestProfile
  /** The checking host's extension API version, when the case has one. */
  readonly apiVersion?: string
  readonly valid: boolean
  /** Exactly the problems a validator must find, in any order. */
  readonly errors: readonly { readonly code: ManifestErrorCode; readonly pointer: string }[]
  readonly note: string
}

export const CASES = table.cases as readonly CorpusCase[]

/** A theme file of the corpus, with what a reader must answer for it when a
 * theme of that appearance names it (corpus/README.md, "Theme files"). */
export interface ThemeCase {
  readonly file: string
  readonly appearance: ThemeAppearance
  readonly valid: boolean
  readonly errors: readonly { readonly code: ManifestErrorCode; readonly pointer: string }[]
  readonly note: string
}

export const THEME_CASES = themeTable.cases as readonly ThemeCase[]

/** A corpus file as it is on disk. */
export function bytesOf(file: string): Uint8Array {
  return readFileSync(join(CORPUS, file))
}

/** The files of one corpus folder, as cases name them ("valid/minimal.json"). */
export function filesIn(folder: 'valid' | 'invalid' | 'themes'): string[] {
  return readdirSync(join(CORPUS, folder))
    .sort()
    .map((name) => `${folder}/${name}`)
}

/** Problems as the contract compares them: "CODE /pointer", sorted. */
export function pairs(issues: readonly { readonly code: string; readonly pointer: string }[]): string[] {
  return issues.map((issue) => `${issue.code} ${issue.pointer}`).sort()
}

/** Every valid manifest of the corpus, parsed. */
export function validManifests(): { file: string; value: unknown }[] {
  return filesIn('valid').map((file) => ({ file, value: JSON.parse(new TextDecoder().decode(bytesOf(file))) }))
}
