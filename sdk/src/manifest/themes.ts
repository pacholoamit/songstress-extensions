// A theme file, read and checked the way the manifest is (validate.ts), each
// stage run only when the ones before found nothing: the reader (16 KiB at
// most, then the manifest's own reader: depth, UTF-8 JSON, each key once),
// the theme file's schema (schema/theme.v1.json), then the looks its theme's
// appearance names (THEME_LOOKS) and their colours (THEME_COLOR,
// THEME_COLOR_ALPHA). What it answers is a set of (code, pointer) pairs, the
// pointers into the file. The file it answers is as written: normalizeLook
// (songstress/theme) puts each colour in its one form.
//
// The contrast a look is held to is not checked here: that is the apps' own
// engine's (SPEC.md, "Themes"), which `songstress check` runs as well.

import { gather, issue, type ManifestIssue } from './codes'
import { holdColors, holdLooks } from './rules/themes'
import { readManifest, sizeOf } from './scan'
import { THEME_FILE_SCHEMA, type ThemeAppearance } from './schema'
import { checkStructure } from './structure'
import type { ThemeFile } from './types.generated'

/** The most a theme file may hold, in bytes. */
export const MAX_THEME_FILE_BYTES = 16 * 1024

/** A theme file that passed, typed; or every problem found in it. */
export type ThemeFileResult = { valid: true; file: ThemeFile; issues: [] } | { valid: false; issues: ManifestIssue[] }

/** The reader's sentences name the manifest; here they are about a theme file. */
const aboutTheFile = (issues: ManifestIssue[]) =>
  issues.map((found) => ({ ...found, message: found.message.replace(/^The manifest/, 'The theme file') }))

/** Reads and checks a theme file from its bytes (or its text), for a theme
 * whose `appearance` is the one given: the file holds exactly the looks that
 * names. Prefer the bytes: only they can show a file that is not UTF-8.
 * @param input - The theme file's bytes, or its text.
 * @param appearance - The `appearance` the manifest gives the theme.
 * @returns The theme's looks when the file is valid; else every issue found.
 * @example
 * ```ts
 * import { parseThemeFile } from 'songstress/manifest'
 *
 * declare const bytes: Uint8Array // the theme file's bytes, as read from disk
 *
 * const result = parseThemeFile(bytes, 'both')
 * if (result.valid) console.log(result.file.dark?.seed, result.file.light?.seed)
 * else for (const issue of result.issues) console.log(issue.code, issue.pointer)
 * ```
 */
export function parseThemeFile(input: string | Uint8Array, appearance: ThemeAppearance): ThemeFileResult {
  if (sizeOf(input) > MAX_THEME_FILE_BYTES) {
    return { valid: false, issues: [issue('THEME_FILE_TOO_LARGE', '', `A theme file is ${MAX_THEME_FILE_BYTES / 1024} KiB at most.`)] }
  }
  const read = readManifest(input)
  if (!read.ok) return { valid: false, issues: aboutTheFile(read.issues) }
  const misshapen = checkStructure(THEME_FILE_SCHEMA, read.value)
  if (misshapen.length > 0) return { valid: false, issues: misshapen }
  const file = read.value as ThemeFile
  const found = gather()
  holdLooks(appearance, (look) => file[look] !== undefined, '', 'in its file', found.report)
  holdColors(file.dark, '/dark', found.report)
  holdColors(file.light, '/light', found.report)
  const issues = found.list()
  return issues.length > 0 ? { valid: false, issues } : { valid: true, file, issues: [] }
}
