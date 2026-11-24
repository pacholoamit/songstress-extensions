# Working on the SDK

This is for whoever changes the `songstress` package itself. To write an extension, read [README.md](./README.md) and [SPEC.md](./SPEC.md).

## What is where

| Path | What it is |
|---|---|
| `SPEC.md` | The specification |
| `schema/extension.v1.json` | The manifest's JSON Schema (draft 2020-12), every object closed |
| `corpus/` | Valid and invalid manifests, `cases.json` (what a validator must answer for each), `engines.json` (versions and ranges), and a README for the authors of other parsers |
| `examples/tunelog/` | The example of SPEC.md: a manifest and a server entry, checked, compiled and run by the tests |
| `api/surface.txt` | The package's public surface at its current version |
| `testdata/differential.json.gz` | Thousands of generated manifests with this validator's answers, which the Go server's reader (`apps/pocketbase/internal/extensions/manifest`) must give too |
| `src/manifest.ts` | The entry `songstress/manifest` |
| `src/manifest/scan.ts` | The reader: size, depth, UTF-8 JSON, duplicate keys |
| `src/manifest/structure.ts` | The schema stage: a reader of the JSON Schema keywords the schema uses |
| `src/manifest/rules/` | The rules a schema cannot say, and the listing rules |
| `src/manifest/semver.ts` | Versions and the range grammar of `engines.songstress` |
| `src/manifest/generate.ts` | Writes `types.generated.ts` and `patterns.generated.ts` from the schema |
| `src/api/` | The API's types: hooks, commands, declared interface, providers, sign-in, settings, storage, network, jobs, routes, library, player |
| `src/host.ts` | Where the API object meets a host, and the permission each member needs |
| `src/cli/` | The `songstress` command (`main.ts`, the package's `bin`): `build.ts`, `pack.ts`, `zip.ts` (the archive), `check.ts` (the manifests a folder holds, with the SDK's validator bundled for Node), `release.ts` (a release's tag and asset in both layouts), `dev.ts` and `remote.ts` (the server it pushes to) |
| `testdata/tunelog.songstress` | The example packed as `pack` packs it (its images left out of the manifest, as the example ships none), which the Go server's tests install from a file |
| `src/index.ts`, `server.ts`, `client.ts` | The three code entries |
| `src/test/` | What the tests share: the corpus loader, the reference validator, the fuzz helpers, the surface printer, the differential fixture's generator |

## Working on it

```sh
pnpm --dir packages/extensions typecheck
pnpm --dir packages/extensions lint
pnpm --dir packages/extensions test
```

Use `--dir`, or turbo's `--filter=songstress`. `pnpm --filter songstress` also matches the repository's root package, which has the same name.

**To change the manifest**, change `schema/extension.v1.json`, then run `pnpm --dir packages/extensions generate`. That rewrites the types and the patterns; a stale one fails the tests. Then add corpus cases for what changed, and say it in SPEC.md: a test fails when the specification does not name a field, a value, a code or a member of the API.

**To change a rule**, write its corpus case first, by hand, with the answer the definitions in `corpus/README.md` give. Then change the rule. Never paste a validator's output into `cases.json`.

**When an answer changes** (a rule, the schema, the corpus, the fuzz helpers), the differential test fails as stale: run `pnpm --dir packages/extensions differential:record`, which writes `testdata/differential.json.gz` again, then the Go server's reader's tests (`go test ./internal/extensions/manifest/` in `apps/pocketbase`), which must agree with every answer. The fixture, unlike the corpus, is this validator's output: it tests that two readers agree, not what the answers should be.

**To change the API**, change the types in `src/api/` and the table in `src/host.ts`. The surface test then fails, because the public surface is frozen at its version. Move the version in `package.json` and in `src/version.ts` (and the skill's, `skill/.claude-plugin/plugin.json` and `marketplace.json`, which follow it: `src/skill.test.ts`), then run `pnpm --dir packages/extensions api:record`. It refuses to record while the version stands still.

### Decisions worth knowing

- **The API has no dependency, and imports nothing but itself.** The surface test compiles the five entries with the ES2023 library and nothing else (no DOM, no Node types), so a file that reaches for `process`, `Buffer` or `fetch` fails it. The one thing used beyond ECMAScript is `TextDecoder`, to read bytes, looked up by name.
- **The command is the one part with dependencies**: PocketBase's SDK, to reach a server as the apps do (no raw `fetch` of an address the user types), and rolldown, to build. No entry reaches it, so nothing of it is bundled into an extension. It is TypeScript Node runs as it is (type stripping): its files import one another by their `.ts` names (`allowImportingTsExtensions`), use only erasable syntax, and import nothing from the rest of the package, whose own imports name no extension.
- **The archive is stored, never compressed**, so a package makes the same bytes, and the same SHA-256, on every machine (deflate differs between zlib builds; the images are compressed already). The server reads deflated archives too.
- **The schema stage is this package's own reader, not a schema library.** Ajv compiles a schema into code as it runs, so under a content security policy it needs `'unsafe-eval'` in `script-src`, which [its own documentation](https://ajv.js.org/security.html) advises against and which the desktop app's policy (`apps/desktop/src-tauri/tauri.conf.json`) does not grant. Its precompiled "standalone" code would be generated code in the repository, held to fallow's complexity limits. Ajv is a development dependency instead, and the oracle: the tests hold the reader to it on every corpus file and on thousands of mangled manifests.
- **Types are generated from the schema**, so there is one copy of the manifest's shape. The schema's patterns are generated too, as regular expression literals: no expression is built from text at run time.
- **The validator answers a set of (code, pointer) pairs.** One mistake is one pair, whatever the order of the checks, so another implementation can be held to the same answers.
- **The API object holds no implementation.** Each member is a function that hands its call to the host found under `Symbol.for('songstress.host')` on the global object: `{ call(member, args) }`, where `member` is the member's full name (`hooks.onPlay`, `providers.lyrics.register`). `API_PERMISSIONS` lists every member with the permission it needs, for a host to check grants from.
- **Patterns stay inside what ECMAScript and RE2 both read**, so the Go server can use the same schema.

## The package as npm gets it

Inside this repository the package's `exports` and `bin` name its TypeScript sources, so the other packages and the tests use it with no build. What is published is `dist/`, which `pnpm --dir packages/extensions build` (`scripts/build.ts`) writes:

- the five entries as ES modules, bundled by rolldown, with what they share in `dist/chunks/` (one `SongstressError` for all of them) and the schema inside;
- the command as one file for Node, `dist/cli.js`, with its two dependencies left to be installed;
- the declarations under `dist/types/`, as TypeScript emits them, each relative import given the file name that Node's own resolution needs.

`package.json`'s `publishConfig` points `exports` and `bin` at `dist/`. pnpm applies it when it packs or publishes, and npm does not: **pack and publish with pnpm**, never with `npm publish`, which would publish a package that points at sources it does not carry. `prepack` builds first, and refuses to go on for anything but pnpm. The build script is TypeScript that Node runs as it is: Node 22.18 or later.

```sh
pnpm --dir packages/extensions pack --pack-destination /tmp/songstress-pack
tar -tzf /tmp/songstress-pack/songstress-*.tgz
```

CI publishes both packages to npm, under npm's trusted publishing: [RELEASING.md](./RELEASING.md) says how, and the owner's one-time step on npmjs.com. Never publish by hand with `npm publish` of the folder, which skips `publishConfig`.

The proof that the packed package works for an author is `e2e/sdk/`: it packs this package and `create-songstress-extension`, starts both kinds of repository from the tarballs, installs, checks, tests, builds and packs each, and installs the result on a lane's server.

**To add an entry**, add it to `exports` and to `publishConfig.exports` in `package.json`, to `ENTRIES` in `scripts/build.ts`, to `tsconfig.build.json`, and to `ENTRIES` in `src/test/surface.ts`: the surface test records it.

**A release** moves the version (see "To change the API" above; the Go host's `APIVersion` in `apps/pocketbase/internal/extensions/host/members.go` moves with it), says what moved in `CHANGELOG.md`, and moves `SDK_RANGE` in `packages/create-songstress-extension/src/plan.ts`, whose test holds it to this package's version.
