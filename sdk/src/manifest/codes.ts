// Every problem the validator can report, by its stable code. A code is part
// of the specification: it is never renamed and never changes meaning, so a
// tool may key on it. New codes are added with a new minor version.
//
// The stages run in this order, and a stage runs only when the ones before it
// found nothing:
//   reader   the text is small and shallow enough, is JSON, names each key once
//   schema   the manifest has the shape the JSON Schema describes
//   rules    what a schema cannot say (the "install" profile ends here)
//   listing  what the official list asks on top (the "listing" profile only;
//            reported together with the rules)

import { shown } from './unsafe'

// The codes are the contract, the sentences are not: they are typed as plain
// text, so that rewording one never moves the package's public surface.
export const MANIFEST_ERROR_CODES = {
  // ── reader ────────────────────────────────────────────────────────────────
  MANIFEST_TOO_LARGE: 'The manifest is larger than 256 KiB.',
  MANIFEST_TOO_DEEP: 'The manifest nests objects and lists more than 16 levels deep.',
  JSON_INVALID: 'The text is not UTF-8 JSON, or holds a number too large to read or a damaged character.',
  JSON_DUPLICATE_KEY: 'An object names the same key twice. The pointer names the key.',
  THEME_FILE_TOO_LARGE: 'A theme file is larger than 16 KiB.',

  // ── schema: one code for each JSON Schema keyword that can fail ────────────
  SCHEMA_TYPE: 'A value is of the wrong type (keyword: type).',
  SCHEMA_REQUIRED: 'A required field is missing (keyword: required). The pointer names the missing field.',
  SCHEMA_UNKNOWN_PROPERTY:
    'A field the manifest does not know (keyword: additionalProperties). The pointer names the field.',
  SCHEMA_ENUM: 'A value is not one of the allowed ones (keyword: enum).',
  SCHEMA_CONST: 'A value is not the one value allowed (keyword: const).',
  SCHEMA_PATTERN: 'Text is not in the form asked (keyword: pattern).',
  SCHEMA_LENGTH: 'Text is too short or too long (keywords: minLength, maxLength).',
  SCHEMA_RANGE: 'A number is too small or too large (keywords: minimum, maximum, exclusiveMinimum).',
  SCHEMA_ITEM_COUNT: 'A list has too few or too many items (keywords: minItems, maxItems).',
  SCHEMA_DUPLICATE_ITEM: 'A list names the same item twice (keyword: uniqueItems). The pointer names the list.',
  SCHEMA_PROPERTY_COUNT: 'An object has too few fields (keyword: minProperties).',

  // ── rules ─────────────────────────────────────────────────────────────────
  TEXT_UNSAFE: 'Text holds a control, invisible or direction-changing character.',
  ID_RESERVED: "The id's publisher is a name Songstress keeps for its own API.",
  VERSION_INVALID: 'version is not a semantic version.',
  ENGINE_RANGE_INVALID: 'engines.songstress is not a range the specification allows.',
  ENGINE_UNSUPPORTED: 'engines.songstress leaves out the extension API of the host that is checking.',
  PATH_OUTSIDE_PACKAGE: 'A file path is not a plain path inside the package.',
  BANNER_NOT_16_9: "The banner's declared size is not 16:9.",
  ENTRY_REQUIRED: 'Something needs code in an entry the manifest does not declare.',
  ENTRY_UNUSED: 'An entry is declared but nothing in the manifest would ever start it.',
  PERMISSION_REQUIRED: 'Something needs a permission the manifest does not ask for.',
  PERMISSION_UNUSED: 'A permission is asked for that nothing in the manifest can use.',
  NETWORK_LOCAL_NOT_PRIVATE: 'A network.local target is an address outside the private and loopback ranges.',
  DUPLICATE_ID:
    'Two contributions of one kind share an id or a key, or a menu names one command twice. The pointer names the later one.',
  MENU_COMMAND_UNKNOWN: 'A menu item names a command the manifest does not declare.',
  ROUTE_DUPLICATE: 'Two routes answer the same method and path. The pointer names the later one.',
  LINK_PATTERN_TOO_BROAD: 'A link pattern would claim every web link.',
  PROVIDER_PLAY_NEEDS_SEARCH: 'A play provider has no search provider of the same id whose results it could play.',
  PROVIDER_MISMATCH: 'One source is given two names or two groups under different kinds. The pointer names the later one.',
  SETTING_DEFAULT_INVALID: "A setting's default is not a value the setting itself would accept.",
  SETTING_RANGE_INVALID: "A number setting's minimum is above its maximum.",
  SETTING_OPTION_DUPLICATE: 'Two options of a select setting share a value. The pointer names the later one.',
  THEME_LOOKS:
    "A theme's looks are not the ones its appearance names, or are written both in the manifest and in its file.",
  THEME_COLOR: "A theme's colour is not one a theme may write, or a part of it is out of its range.",
  THEME_COLOR_ALPHA: "A theme's colour is translucent where only border and surface.hover may be.",
  WHEN_INVALID: 'A when condition is not written in the grammar every app reads.',
  WHEN_KEY_UNKNOWN: 'A when condition names a key no app knows where it stands, or a setting it may not read.',

  // ── listing ───────────────────────────────────────────────────────────────
  LISTING_FIELD_REQUIRED: 'A field the official list requires is missing. The pointer names the field.',
  LISTING_LICENSE: 'The licence is not one the official list accepts.',
  LISTING_REPOSITORY: 'repository is not a GitHub repository address.',
  LISTING_SCREENSHOTS: 'The official list asks for three to six screenshots.',
}

/** A stable problem code. */
export type ManifestErrorCode = keyof typeof MANIFEST_ERROR_CODES

/** One problem: its code, where it is, and a sentence for a person. Only the
 * code and the pointer are part of the specification; the sentence may be
 * reworded. */
export interface ManifestIssue {
  code: ManifestErrorCode
  /** A JSON Pointer (RFC 6901) into the manifest; "" is the whole document. */
  pointer: string
  message: string
}

/** How a rule or a keyword hands a problem over. */
export type Report = (code: ManifestErrorCode, pointer: string, message: string) => void

/** Problems gathered from several checks, each (code, pointer) pair once. */
export interface Findings {
  readonly report: Report
  /** What was reported, by pointer and then by code. */
  list(): ManifestIssue[]
}

/** One problem, its sentence with the manifest's own unsafe characters
 * written by name: a message quotes the manifest, and must not hide or
 * reverse anything it quotes. */
export function issue(code: ManifestErrorCode, pointer: string, message: string): ManifestIssue {
  return { code, pointer, message: shown(message) }
}

export function gather(): Findings {
  const found = new Map<string, ManifestIssue>()
  return {
    report(code, pointer, message) {
      const key = `${code} ${pointer}`
      if (!found.has(key)) found.set(key, issue(code, pointer, message))
    },
    list: () =>
      [...found.values()].sort((a, b) => order(a.pointer, b.pointer) || order(a.code, b.code)),
  }
}

/** Code-unit order, the same in every language (never the locale's). */
function order(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}
