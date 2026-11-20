# The manifest corpus

Every program that reads a `songstress.json` must answer the same for the same file: the validator in this package, the server's parser, a check on a website. This folder is how that is held. It has manifests, and for each of them exactly what a validator must report.

If you are writing a parser in another language, this file is your specification and `cases.json` is your test suite. The JSON Schema is `../schema/extension.v1.json`.

## What is here

| Path | What it is |
|---|---|
| `valid/` | Manifests with nothing wrong with them |
| `invalid/` | Manifests with something wrong: one kind of mistake a file, so a failure points at one rule |
| `cases.json` | Every file with what a validator must answer for it |
| `engines.json` | The truth table for `version` and `engines.songstress` |

Some files in `invalid/` are not JSON, and two are not UTF-8. Read every file as bytes.

## Running the corpus

`cases.json` holds `{ "cases": [...] }`. Each case is:

| Field | What it says |
|---|---|
| `file` | The manifest, from this folder |
| `profile` | `install` or `listing`: what the manifest is held to |
| `apiVersion` | In a few cases: the extension API version of the host doing the check. Without it, the engine range is checked for its form only |
| `valid` | Whether the manifest passes. Always the same as `errors` being empty |
| `errors` | Exactly the problems to report, each a `code` and a `pointer` |
| `note` | What the case shows, for a person |

For each case: read the file's bytes, validate with the profile and the API version, and compare what you found with `errors` **as a set of (code, pointer) pairs**. Order does not count. Report each pair once however many ways you came to it. Your sentences are your own: nothing compares them.

One file may be in several cases. A file in `invalid/` may pass under another profile.

A pointer is a JSON Pointer (RFC 6901) into the manifest. `""` is the whole document, and a `/` inside a name is written `~1`: `/contributes/menus/song~1context/0/command`.

## The four stages

A stage runs only when the stages before it reported nothing. So a file with a duplicate key reports that and nothing about its fields, and a manifest of the wrong shape is never looked at by a rule.

### 1. The reader

Four checks, in this order. The first that fails ends the read.

1. **Size.** More than 262,144 bytes: `MANIFEST_TOO_LARGE` at `""`. No file is kept for this: test it with text you generate.
2. **Depth.** Counted on the raw bytes, before anything decodes or parses them, so that no parser is handed a text built to exhaust its stack. Walk the bytes. A `"` opens a string; inside a string a `\` skips the byte after it and a `"` closes the string. Outside strings, each `[` or `{` goes one level deeper and each `]` or `}` one level back up. If the level ever passes 16: `MANIFEST_TOO_DEEP` at `""`. This reads any bytes, JSON or not, UTF-8 or not: seventeen brackets that never close are too deep, not bad JSON (`invalid/reader-too-deep-not-json.json`, `invalid/reader-too-deep-not-utf8.json`).
3. **Syntax.** Anything below that fails: `JSON_INVALID` at `""`.
   - The bytes are UTF-8 (`invalid/reader-not-utf8.json`).
   - The text is JSON as RFC 8259 has it: no comments, no trailing commas, no byte-order mark.
   - Every number is one an IEEE 754 double holds: `1e400` is refused, never read as infinity. A number too small to tell from zero is zero.
   - Every text, key or value, is whole Unicode once its escapes are decoded: no half of a surrogate pair (`"\ud83c"`) and no U+FFFD. Some JSON parsers keep a lone surrogate and others replace it with U+FFFD, so a text holding either would not be the same text everywhere. If your decoder replaces, checking every decoded text for U+FFFD covers both.
4. **Keys.** No object may name a key twice, compared after escapes are decoded (`"reason"` and `"\u0072eason"` are one key). Each repeat: `JSON_DUPLICATE_KEY`, with the pointer of that key. Most JSON libraries silently keep the last of two keys, or the first: you will need a tokenizer that shows you keys as they come.

A parser that accepts more than JSON (comments, single quotes) must be told not to.

### 2. The schema

Validate against `../schema/extension.v1.json` (draft 2020-12), **collecting every error**, not stopping at the first. Each keyword that fails is one problem:

| Keyword | Code | Pointer |
|---|---|---|
| `type` | `SCHEMA_TYPE` | The value |
| `required` | `SCHEMA_REQUIRED` | The missing field: the object's pointer, then the field's name |
| `additionalProperties` | `SCHEMA_UNKNOWN_PROPERTY` | The unknown field: the object's pointer, then the field's name |
| `enum` | `SCHEMA_ENUM` | The value |
| `const` | `SCHEMA_CONST` | The value |
| `pattern` | `SCHEMA_PATTERN` | The value |
| `minLength`, `maxLength` | `SCHEMA_LENGTH` | The value |
| `minimum`, `maximum`, `exclusiveMinimum` | `SCHEMA_RANGE` | The value |
| `minItems`, `maxItems` | `SCHEMA_ITEM_COUNT` | The list |
| `uniqueItems` | `SCHEMA_DUPLICATE_ITEM` | The list |
| `minProperties` | `SCHEMA_PROPERTY_COUNT` | The object |

The schema uses no other keyword that can fail. `$ref`, `allOf`, `if` with `then`, `items` and `properties` only apply other schemas and report nothing of their own.

What to watch when you build this on a library:

- **Missing and unknown fields.** Most libraries report these at the object and name the field beside it. The contract points at the field. One error that names three missing fields is three problems.
- **`if` and `then`.** A setting's shape depends on its `type`, written as five `if`/`then` pairs. An error inside an `if` is never a problem: the `if` only chooses. Many libraries add an error for the `if` or the `allOf` itself; drop those and keep their leaves.
- **Report each pair once.** A setting that is not an object fails `type` once directly and once under each `then`: one problem.
- **Length is counted in characters** (Unicode code points), not bytes and not UTF-16 units. `valid/limits.json` has a name of 50 characters that is 100 UTF-16 units long.
- **Patterns** are written in the subset that ECMAScript and RE2 (Go) read alike: no lookaround, no backreference, no `\d`, `\s` or `\w`. They match anywhere in the text unless they anchor themselves, and all but the file-type ones do. They are matched against characters, not bytes.
- **Numbers.** `512.0` is the integer 512. `uniqueItems` compares values, not their spelling.
- **`uniqueItems` in one pass.** A manifest of 256 KiB can hold one list of 30,000 items, and the schema checks every list's items for repeats even when the list is already too long. Compare each item's canonical form (object fields sorted, numbers by value) against a set, never each item with every other: a quadratic check lets one upload keep a server busy for seconds.
- **Field names every object of your language already has** (`toString`, `constructor`, `__proto__` in JavaScript) are ordinary names in a manifest. `invalid/schema-unknown-property-object-names.json` and `valid/limits.json` are there to find a parser that trips on them.

### 3. The rules

What a schema cannot say. Every rule runs, each on its own, on a manifest that has the schema's shape. In the definitions below, "an entry of side S" is `entry.server` or `entry.client`.

**`TEXT_UNSAFE`**: every text value in the manifest, at its own pointer, that holds a code point in one of these ranges (inclusive, hexadecimal):

| From | To | What |
|---|---|---|
| 0000 | 001F | C0 controls: line breaks and tabs among them |
| 007F | 009F | Delete and the C1 controls |
| 00AD | 00AD | Soft hyphen |
| 034F | 034F | Combining grapheme joiner |
| 115F | 1160 | Hangul choseong and jungseong fillers |
| 17B4 | 17B5 | Khmer inherent vowels |
| 200B | 200B | Zero-width space |
| 2028 | 2029 | Line and paragraph separators |
| 202A | 202E | Direction embeddings and overrides |
| 2060 | 206F | Word joiner, invisible operators, direction isolates, deprecated format characters |
| 3164 | 3164 | Hangul filler |
| D800 | DFFF | A surrogate with no partner |
| FEFF | FEFF | Byte-order mark |
| FFA0 | FFA0 | Halfwidth Hangul filler |
| FFF0 | FFFB | Unassigned ignorable code points; interlinear annotation characters |
| FFFD | FFFD | The replacement character |
| 1BCA0 | 1BCA3 | Shorthand format controls |
| 1D173 | 1D17A | Musical symbol format characters |
| E0000 | E00FF | Tag characters, and unassigned ignorable code points |
| E01F0 | E0FFF | Unassigned ignorable code points |

That is the controls, the separators, the annotation characters and every code point of Unicode's `Default_Ignorable_Code_Point` property (DerivedCoreProperties.txt) but those a script or an emoji needs, which are legal: the joiners (200C, 200D), the direction marks (200E, 200F, 061C), the Mongolian variation selectors and vowel separator (180B to 180F) and the variation selectors (FE00 to FE0F, E0100 to E01EF). The reader already refuses two of the ranges, half a surrogate pair (D800 to DFFF) and U+FFFD: they are in the table for a validator that is handed a value that never went through a reader.

**`ID_RESERVED`** at `/id`: the part of `id` before the dot is one of `commands`, `hooks`, `host`, `jobs`, `library`, `listening`, `net`, `network`, `player`, `providers`, `queue`, `routes`, `secrets`, `settings`, `storage`, `themes`, `ui`, `users`. A server also reports it when that part is `songstress` and the manifest came from a GitHub link or a file, not the official list (SPEC.md, section 4). A case has no source, so no case holds that.

**`VERSION_INVALID`** at `/version`: not a version by `engines.json`.

**`ENGINE_RANGE_INVALID`** at `/engines/songstress`: not a range by `engines.json`.

**`ENGINE_UNSUPPORTED`** at `/engines/songstress`: the range is one, the case gives an `apiVersion`, and that version is not inside the range.

**`PATH_OUTSIDE_PACKAGE`** at each of `/icon/path`, `/banner/path`, `/screenshots/N/path`, `/entry/server`, `/entry/client`, `/contributes/views/N/path`, `/contributes/themes/N/path` whose text is not a plain path. A plain path holds none of the characters `\ : * ? " < > | % #` and, split at `/`, has no part that is empty or that ends in a dot or a space.

**`BANNER_NOT_16_9`** at `/banner`: `width × 9` is not `height × 16`.

**`ENTRY_REQUIRED`**: the manifest has no entry of side S, at each place that needs one. For the server: `/hooks/server`, `/contributes/providers`, `/contributes/jobs`, `/contributes/routes`, `/contributes/signIn`, when present. For either side: `/hooks/<side>` when present; `/contributes/commands/N/run` of each command whose `run` is S; `/contributes/pages/N/render` and `/contributes/panels/N/render` of each whose `render` is S. Call these places the starters of S.

**`ENTRY_UNUSED`** at `/entry/<side>`: the manifest has that entry, and S has no starter.

**`PERMISSION_REQUIRED`**, when `permissions` lacks the one needed:

- at `/hooks/server/N`: `listening.read` for `onPlay`, `onScrobble`, `onFavorite`; `library.read` for `onPlaylistChange`, `onLibraryChange`, `onScanComplete`;
- at `/hooks/client/N`: `listening.read` for every client hook but `onVolumeChange`, which needs none;
- at `/contributes/providers`, `/contributes/jobs`, `/contributes/routes`: the permission of the same name;
- at `/contributes/providers/scrobble`: `listening.read`, since a scrobble source is handed members' plays;
- at `/contributes/signIn`: `secrets`, since the tokens a sign-in is given are the extension's own secrets.

**`PERMISSION_UNUSED`** at `/permissions/<name>`. Say that the extension "runs on S" when it has an entry of S or S has a starter (a missing entry is reported once, as `ENTRY_REQUIRED`, and not again here).

- `providers`, `jobs`, `routes`: `contributes` has nothing of that name.
- `library.read`, `users.read`, `secrets`: the extension does not run on the server.
- `player.control`: the extension does not run on the client and has no `contributes.views`.
- every other permission: the extension runs on neither side and has no `contributes.views`.

**`NETWORK_LOCAL_NOT_PRIVATE`** at `/permissions/network.local/targets/N`: the target begins with an IPv4 address (alone, with `/bits` or with `:port`) and the block it names (the one address, when no `/bits`) does not lie wholly inside one of `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `127.0.0.0/8`. A block lies inside a range when its `bits` is at least the range's and its leading bits equal the range's. A host name is never reported.

**`DUPLICATE_ID`** at the later one's `/id` (for a setting, its `/key`), for each of these groups, each on its own: commands; pages then views, as one group; panels; themes; jobs; routes; settings by `key`; the sources of each provider kind; the `qualities` of each download source.

**`MENU_COMMAND_UNKNOWN`** at `/contributes/menus/<location>/N/command`: no command has that id.

**`ROUTE_DUPLICATE`** at `/contributes/routes/N`: an earlier route has the same `method` and the same `path` once every `:name` part is read as the same.

**`LINK_PATTERN_TOO_BROAD`** at `/contributes/providers/links/N/patterns/M`: the pattern is `http:` or `https:`.

**`PROVIDER_PLAY_NEEDS_SEARCH`** at `/contributes/providers/play/N/id`: no source under `search` has that id.

**`PROVIDER_MISMATCH`** at `/contributes/providers/<kind>/N`. Go through the kinds in the schema's order (`search`, `lookup`, `links`, `lyrics`, `metadata`, `artwork`, `scrobble`, `recommend`, `play`, `download`) and each kind's sources in order, remembering for each id a name and a group. A source's name is its `name`, or the manifest's `name` when it has none. Only `search`, `lookup`, `links` and `metadata` sources have a group: their `group`, or "none" when they have none. The first source with an id sets its name; the first of those four kinds sets its group. A later source with that id is reported when its name differs, or, if not, when it has a group and it differs.

**`SETTING_DEFAULT_INVALID`** at `/contributes/settings/N/default`: a `string` default longer than its own `maxLength` (in characters); a `number` default below its `minimum` or above its `maximum`; a `select` default that is not the `value` of one of its options.

**`SETTING_RANGE_INVALID`** at `/contributes/settings/N/maximum`: the `minimum` is above the `maximum`.

**`SETTING_OPTION_DUPLICATE`** at `/contributes/settings/N/options/M/value`: an earlier option has that value.

### 4. The listing rules

Only under the `listing` profile, and reported together with the rules.

**`LISTING_FIELD_REQUIRED`** at `/license`, `/repository`, `/categories`, `/icon`, `/screenshots`: each that is missing.

**`LISTING_LICENSE`** at `/license`: not one of `MIT`, `Apache-2.0`, `BSD-2-Clause`, `BSD-3-Clause`, `ISC`, `0BSD`, `MPL-2.0`, `LGPL-3.0-only`, `LGPL-3.0-or-later`, `GPL-3.0-only`, `GPL-3.0-or-later`, exactly as written.

**`LISTING_REPOSITORY`** at `/repository`: not `https://github.com/<owner>/<name>` and nothing after it. An owner is 1 to 39 letters, digits and hyphens, neither first nor last a hyphen; a name is 1 to 100 letters, digits, dots, hyphens and underscores.

**`LISTING_SCREENSHOTS`** at `/screenshots`: fewer than three.

**`LISTING_ACQUISITION`** at `/contributes/providers/play` and at `/contributes/providers/download`: each that is present.

## `engines.json`

- `versions.valid` and `versions.invalid`: text that is, and is not, a version. A version is a semantic version by semver.org 2.0.0, with each of its three numbers at most 15 digits long, so that they are exact in every language.
- `order.ascending`: versions from lowest to highest by semver.org's precedence, each strictly above every one before it. A prerelease identifier of digits is a number of any length: compare two by length, then as text, never as a floating-point number. `order.equal`: pairs that rank the same, because build metadata is ignored.
- `ranges.invalid`: text that is not a range.
- `ranges.cases`: a `range`, a `version` and whether the version is inside it.

A range is one of five forms and nothing else. `V` is a version without build metadata.

| Form | Is |
|---|---|
| `^V` | From V, before the next version that may break it: for `M.m.p`, `(M+1).0.0-0` when M is above 0, else `0.(m+1).0-0` when m is above 0, else `0.0.(p+1)-0` |
| `~V` | From V, before `M.(m+1).0-0` |
| `>=V` | From V on |
| `>=V <W` | From V, before W. W must be above V. Exactly one space |
| `V` | V alone (build metadata of the version held against it is ignored) |

`-0` is the lowest prerelease there is, so "before `2.0.0-0`" keeps every prerelease of 2.0.0 out. Membership is by precedence alone: `1.3.0-beta.1` is inside `^1.2.0`, and `2.0.0-beta` is inside `>=1.2.0 <2.0.0`.

## Adding a case

1. Write the manifest by hand, with one thing wrong with it.
2. Write its `errors` by hand, from the definitions above. Never paste what a validator printed: the corpus tests the validators, not the other way round.
3. Add the case to `cases.json` with a `note` that says what it shows.
4. If the definitions above could not tell you the answer, the definition is what needs fixing first.

A new code needs a case, and a new minor version of the package.
