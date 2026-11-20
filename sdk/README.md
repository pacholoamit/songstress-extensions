# songstress

The extension SDK of [Songstress](https://songstress.app), the self-hosted music server: what you write an extension against, check it with, test it with, run it on your own server with, and release it with.

```sh
npm create songstress-extension@latest
```

That starts a working extension, with this package installed. To add it to a project by hand: `npm install --save-dev songstress`. It needs Node 22.12 or later.

## What is in it

| Part | What it is |
|---|---|
| `songstress/server`, `songstress/client`, `songstress` | The API an extension's code is written against, as types, with a thin object that hands each call to Songstress. `server` is the entry that runs on the user's own server, `client` the one that runs inside an app; the bare name is what both have |
| `songstress/manifest` | The types of the manifest, `songstress.json`, and its validator. It needs nothing but JavaScript, so it runs in a terminal, on a server and in a browser |
| `songstress/testing` | A mock Songstress for your own tests |
| `songstress/sandbox` | The types of the few globals the sandbox has, so the compiler refuses the ones it lacks |
| The `songstress` command | `check`, `build`, `pack` and `dev`: from a folder to an extension running on your server |
| [SPEC.md](./SPEC.md) | The specification: what an extension is, the manifest field by field, the hooks, the permissions, the API, versions. Start here |
| `schema/extension.v1.json` | The manifest's JSON Schema. Its address, `https://songstress.app/schema/extension/v1.json`, in a manifest's `$schema` makes an editor check the file as you type |
| [corpus/](./corpus/README.md) | The manifests every reader of the format must agree on, with the answer for each: for whoever writes another one |

## An extension

An extension is a folder with a manifest, `songstress.json`, and whatever the manifest names. The manifest declares everything the extension adds and each permission it asks for; code gives each thing its behaviour.

```json
{
  "$schema": "https://songstress.app/schema/extension/v1.json",
  "manifestVersion": 1,
  "id": "acme.play-count",
  "name": "Play Count",
  "version": "0.1.0",
  "description": "Counts the songs each member plays.",
  "engines": { "songstress": "^0.1.0" },
  "entry": { "server": "dist/server.js" },
  "hooks": { "server": ["onScrobble"] },
  "permissions": {
    "listening.read": { "reason": "Hear what you play, to count it." },
    "storage": { "reason": "Keep your count." }
  }
}
```

```ts
// src/server.ts, built to dist/server.js
import { songstress } from 'songstress/server'

songstress.hooks.onScrobble(async (_song, play) => {
  const member = { userId: play.userId }
  const count = (await songstress.storage.get<number>('count', member)) ?? 0
  await songstress.storage.set('count', count + 1, member)
})
```

The code runs in a sandbox with the JavaScript language, timers, `console.log` and the `songstress` API, and nothing else: no `fetch` (the way out is `songstress.net.fetch`, to the hosts the manifest names), no Node, no DOM. Songstress starts an entry when something it declared is called for and may stop it when it is idle, so an entry registers everything at its top level and keeps what must last in `songstress.storage`. Outside Songstress there is no host, and every call throws a `SongstressError` with the code `no-host`.

Hold the compiler to the sandbox in `tsconfig.json`, and `fetch`, `process` and `document` stop compiling:

```json
{ "compilerOptions": { "lib": ["ES2023"], "types": ["songstress/sandbox"], "moduleResolution": "bundler" } }
```

## The command

`songstress <command> [folder]`, the folder being the extension's own (where `songstress.json` is; `.` by default):

| Command | Does |
|---|---|
| `check` | Checks the manifest of each extension the folder holds, as a server does when it installs one, and says what its release is called. `--profile listing` asks what the Marketplace asks on top: a licence, the repository, a category, an icon, screenshots. A folder holds one extension, or several, one folder each, each id once (SPEC.md, "A release"). Exits 1 when any fails: what a repository's CI runs |
| `build` | Builds each entry the manifest names under `dist/` from its source under `src/` (`dist/server.js` from `src/server.ts`, `.tsx`, `.mts`, `.js` or `.mjs`): one classic script with all it imports inside it, an IIFE bundled by rolldown. An entry with no such source is left as your own build wrote it |
| `pack` | Builds, then writes the package's archive, `<id>-<version>.songstress` (`--out <file>` to name it): the manifest, every file it names and the documents at the folder's root (README, LICENSE, NOTICE, CHANGELOG and the like), nothing else, stored in a ZIP that is the same byte for byte wherever it is made (SPEC.md, section 3). What a release carries, what a server installs from a file |
| `dev` | Builds, packs and pushes it to your own server as a development install, switched on, granted what its manifest asks and seen by you alone; again whenever a file changes. Prints the extension's log as the server's host writes it. A build that fails or a package the server refuses is said, and the last good one keeps running |

`dev` signs in as an admin of the server: `--server <url>` (or `SONGSTRESS_SERVER`), http or https, with `--email <email>` (or `SONGSTRESS_EMAIL`) and the password in `SONGSTRESS_PASSWORD`, or `SONGSTRESS_TOKEN`, an admin's session.

```sh
SONGSTRESS_PASSWORD=… songstress dev --server http://music.local:8090 --email you@example.com
```

## Test it

`songstress/testing` puts a mock Songstress in place. It keeps what the entry registers and lets a test call it as Songstress does, answers the store, the secrets and the settings from memory, and hands the network to a function of yours. Given the manifest, it refuses what a real server refuses for the same reason: a call whose permission the manifest does not ask for, a request to a host it does not name, a hook it does not list.

```ts
import { createMockHost } from 'songstress/testing'
import { expect, it, vi } from 'vitest'
import manifest from '../songstress.json'

it('counts a play', async () => {
  const host = createMockHost({ manifest })
  vi.resetModules()
  await import('./server') // the entry registers as it loads

  await host.emit('onScrobble', { id: 's1', title: 'Blue in Green', artist: 'Miles Davis' }, { userId: 'ana', playedAt: '2026-01-01T20:00:00Z' })

  expect(host.calls.at(-1)).toEqual({ member: 'storage.set', args: ['count', 1, { userId: 'ana' }] })
  host.remove()
})
```

| On the mock host | What it does |
|---|---|
| `emit(hook, ...)` | Fires a hook: each listener is called and waited for |
| `run(command, input?, context?)` | Runs a command the entry registered, as a person picking it would |
| `provider(kind, id)` | The provider the entry registered: call its methods as Songstress does |
| `registered(member, id?)` | What the entry handed to any other registering member: `registered('jobs.register', 'sync')` |
| `calls`, `requests` | Every call the code made, and every request through `net.fetch` |
| `remove()` | Takes it away again |

`createMockHost` takes the `manifest`, the `settings` by key (a function answers for one member), a `fetch` that answers the network, `answers` for any other member by its full name (`'library.getSong'`), and `side: 'client'` for a client entry. It runs no sandbox: limits, deadlines and what a member granted are for a real server to show, with `songstress dev`.

## Check a manifest from code

```ts
import { parseManifest } from 'songstress/manifest'

const result = parseManifest(bytes, { profile: 'install' })
if (result.valid) {
  console.log(result.manifest.id)
} else {
  for (const issue of result.issues) console.log(issue.code, issue.pointer, issue.message)
}
```

- `parseManifest(input, options)` takes the file's bytes (preferred: only they can show a file that is not UTF-8) or its text. `validateManifest(value, options)` takes a value that is already parsed.
- `profile` is `install` (what a server takes from a link or a file) or `listing` (what the Marketplace asks on top). `apiVersion`, when given, is the extension API version of the host that is checking: a manifest whose `engines.songstress` leaves it out is refused.
- An issue is a stable `code`, a JSON Pointer, and a sentence. The codes and pointers are the contract; the sentences may be reworded.

## Release it, install it, list it

- **Release.** A release is a GitHub release that carries the package, `<id>-<version>.songstress`, as its one asset. A repository of one extension tags it with the manifest's version (`v1.2.0`); a repository of several keeps each in a folder of its own and tags `<id>@<version>`. The workflows `create-songstress-extension` writes do this from a pushed tag.
- **Install.** In Songstress, an admin opens Manage, then Extensions, chooses "Add an extension", and gives it the repository's address or the `.songstress` file. Songstress shows what the extension asks for, and nothing runs until the admin has agreed.
- **List.** Submit the repository's link at <https://songstress.app/extensions/submit>. `songstress check --profile listing` says what a listing still needs, and a person reviews it before it is listed.

## Versions

This package's version is the version of the extension API (`API_VERSION`), which a manifest's `engines.songstress` is held against: `^0.1.0` runs on every 0.1 host. It is 0.x, and may still change between minor versions. [CHANGELOG.md](./CHANGELOG.md) says what moved in each version, and SPEC.md, section 13, has the rules.

Questions and problems: <https://github.com/pacholoamit/songstress-extensions/issues>.

## Licence

MIT, in [LICENSE](./LICENSE). The rest of the repository is GPL-3.0-only; this package is MIT so that anyone can build an extension against it. It takes code only from sources whose licence allows that, and none from a GPL or LGPL project.

## NOTICE

What this package took from elsewhere:

- **The regular expression for a semantic version** in `src/manifest/semver.ts` is the one suggested at <https://semver.org> (Semantic Versioning 2.0.0, by Tom Preston-Werner, [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/)), changed to hold each number to 15 digits.

- **The code points `TEXT_UNSAFE` refuses** follow a property of the Unicode Character Database, `Default_Ignorable_Code_Point` (DerivedCoreProperties.txt). The ranges are written out by hand in `src/manifest/unsafe.ts`; no file of the database is in this package.

Nothing else was copied. The design follows systems that came before, for their ideas and not their text: Visual Studio Code (contribution points declared in a manifest, commands, disposables, an engine range), Chrome extensions (permissions with host patterns), Figma plugins (a sandbox with nothing reachable unless granted), Raycast (an interface sent as a tree of the host's own components), Shopify's Remote DOM (the same tree on the web), foobar2000 and Spicetify (playback hooks), and the W3C web app manifest (images with their stated sizes).
