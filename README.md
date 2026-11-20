# songstress-extensions

Songstress's official extensions: the ones made by Songstress's maintainer, which every Songstress server can install from its catalogue. Other authors publish their extensions from their own GitHub repositories and submit them to the Marketplace on songstress.app; they never need to add them here.

| Folder | Extension | What it adds | Licence |
|---|---|---|---|
| `apple-music/` | `songstress.apple-music` | Search, songs, albums, playlists and artists by id or link, a song's ISRC, and synced lyrics with your own Media User Token (a secret setting). It joins the iTunes group | LGPL-3.0-only, a port of zarzet's Mornye extension (`COPYING`, `LICENSE`, `NOTICE`) |
| `genie-music/` | `songstress.genie-music` | Search Genie Music's songs, albums and artists, and open them by id or link | MIT, written for Songstress from Genie's own pages (`LICENSE`) |
| `jiosaavn/` | `songstress.jiosaavn` | Search, songs, albums, playlists and artists by id or link, a song's facts; a stream to audition and five AAC qualities to acquire (both off until an admin turns them on). Its setting: the languages it searches in | LGPL-3.0-only (the Mornye registry's version), from HemanthJabalpuri's MIT original (`COPYING`, `LICENSE`, `NOTICE`) |
| `soundcloud/` | `songstress.soundcloud` | Search, tracks, sets and artists by id or link, an ISRC for a track; a progressive stream to audition, and the AAC stream to acquire (both off until an admin turns them on) | LGPL-3.0-only, a port of zarzet's Mornye extension (`COPYING`, `LICENSE`, `NOTICE`) |
| `spotify-web/` | `songstress.spotify-web` | Spotify's web player's catalogue: search, links (`spotify:` ones too), a track's ISRC from Spotify's own metadata and its Deezer id. It joins the Spotify group | LGPL-3.0-only, a port of zarzet's Mornye extension (`COPYING`, `LICENSE`, `NOTICE`) |

They are the sources that were Mornye extensions. Nothing here is built into Songstress, its server image or an app: a server installs each from the official index, and a server that had the Mornye extension installed gets its version here in its place, with its settings, and tells its admins.

**Bugs Music and Melon Music are not here.** Their Mornye versions (and Genie's) are ldw0403-netizen's K-Music, which publishes no licence, so their code could not be ported; Genie Music was written anew from its live pages. Bugs answers with a JavaScript-and-cookie bot challenge, and Melon's site does not answer outside Korea, so neither could be written or checked yet. A server that had either let it go and told its admins so.

`shared/` is the code they share, built into each one's package. `sdk/` is the Songstress extension SDK (MIT), carried here until it is published on npm (below, "Refreshing the SDK"). `index/` makes and signs the official index (MIT).

## What runs where

Each extension's `src/server.ts` is its server entry, built by `songstress build` into one classic script (`dist/server.js`, not tracked) with `shared/` inside it: a catalogue source's search, lookups and links registered in one call (`register.ts`), the network with a browser's User-Agent and the SDK's failures (`http.ts`), a value kept in memory and in the extension's store (`kept.ts`), matching a song among a source's results (`match.ts`, `text.ts`), and addresses and base64 without the URL class the engine lacks (`url.ts`). Everything runs on the server, in its extension host, never in a phone's app.

## The layout

This repository holds several extensions, each in a folder of its own with its `songstress.json` (sdk/SPEC.md, "A release"). Each extension is released on its own: a release is tagged `<id>@<version>` with the whole id (`songstress.soundcloud@1.2.0`) and carries one asset, `<id>-<version>.songstress`. An extension's latest release is the newest full release whose tag names it; another extension's releases are not its own. A Songstress server installing from this repository by its link asks which extension, or takes the one a release link names.

## Releasing an extension

1. Raise the version in its `songstress.json`, through a pull request (the `ports` check must pass).
2. Tag the merged commit `<id>@<version>` and push the tag. The `release` workflow packs that folder and publishes the release with its asset; it refuses a tag that does not name the manifest's id and version. A pre-release version (`1.3.0-beta.1`) is published as a pre-release, which the index never lists.
3. The official index lists it once it is signed with the new version (below).

## The official index

Every Songstress server reads the signed index from this repository's `index` branch, which holds `index.json` alone: `https://raw.githubusercontent.com/pacholoamit/songstress-extensions/index/index.json`. It is a DSSE envelope signed with Ed25519 (`index/README.md` has its format), listing each version by its package's SHA-256, the block list, and the publishers. Servers trust only the keys built into them, so a change anywhere else cannot list anything.

The `index` workflow (`.github/workflows/index.yml`) makes it, after every release, whenever `main` changes one of the three files below, every Monday (an index holds 30 days, so it never lapses), and by hand (Actions, `index`, Run workflow). It lists each extension's three newest full releases, each version by its package as its release carries it (`index/cli.ts build`) and published at its release's own time (`index/releases.ts`), under the sequence after the last one's. It signs it with the key the `index` environment holds, reads it back with `index.pub`, commits it to the `index` branch, and tells songstress.app (`index/ping.ts`), which takes it only if its signature holds. The environment gives its secrets to `main` alone.

What it says, besides the releases, is three files on `main`, each changed through a pull request:

- `publishers.json`: the publishers this index vouches for, `[{ "name": "songstress", "verified": true }]`.
- `blocklist.json`: versions every server switches off, `{ "id", "versions", "sha256", "reason", "at" }` each (`versions` left out means every version of the id; `sha256` names packages whatever their id).
- `marketplace.json`: the ids songstress.app's directory shows. Every listed extension installs either way; one shown there meets the listing rules (`sdk/SPEC.md`, "Listing").

### Setting it up, once

1. On your own machine, never in this repository: `node index/cli.ts keygen ~/songstress-index.pem`. It prints the public key.
2. Put the public key in `index.pub` through a pull request, and give it to the Songstress server (`officialKeys`, a release before the first index signed with it) and to songstress.app.
3. Settings, Environments, New environment `index`. Deployment branches and tags: `main` only. Its secrets: `INDEX_SIGNING_KEY`, the whole `.pem` file; `INDEX_PING_SECRET`, the same value songstress.app holds as `EXTENSIONS_PING_SECRET` (32 characters or more).
4. Run the `index` workflow by hand once.

## Working on it

```sh
pnpm install
pnpm typecheck && pnpm lint && pnpm test
pnpm exec songstress check .          # every manifest, as a server checks it
pnpm exec songstress pack soundcloud  # one package, as its release carries it
```

Node 24.3 or later runs the `songstress` command as it is.

The tests:

- each extension's `server.test.ts`: its providers against a stand-in Songstress and a stand-in service (`shared/testing.ts`), with the answers the Mornye versions' own tests used where they had them;
- `official.test.ts`: every manifest is Songstress's own and passes the install profile, would pass the listing profile once it has its images, and packs the same package every time;
- `index/*.test.ts`: the signed index (`index/README.md`), `publishers.json` as a server reads it, the releases it lists, and the ping to songstress.app.

Songstress's own server tests install these extensions from packages recorded in its repository (`apps/pocketbase/internal/extensions/testdata`, test data that no build or image takes). Its `README.md` there says how to record them again from a checkout of this one, after a change here that its tests should see.

## Refreshing the SDK

`sdk/` is a copy of the Songstress repository's `packages/extensions` (the `songstress` package), made to stand alone: its TypeScript config extends this repository's `tsconfig.base.json` and its typecheck is plain `tsc`. Until `songstress` is published on npm, an extension built here uses the SDK this copy holds, so refresh it when Songstress's SDK changes (a new API version, a new check). From a checkout of Songstress beside this one:

```sh
SONGSTRESS=../songstress   # the Songstress checkout to take the SDK from
rsync -a --delete --exclude node_modules --exclude dist --exclude .vitest-cache --exclude .turbo \
  "$SONGSTRESS/packages/extensions/" sdk/
node -e '
const fs = require("node:fs")
const pkg = JSON.parse(fs.readFileSync("sdk/package.json", "utf8"))
delete pkg.devDependencies["@songstress/typescript-config"]
pkg.scripts.typecheck = "tsc --noEmit"
fs.writeFileSync("sdk/package.json", JSON.stringify(pkg, null, 2) + "\n")
const config = JSON.parse(fs.readFileSync("sdk/tsconfig.json", "utf8"))
config.extends = "../tsconfig.base.json"
fs.writeFileSync("sdk/tsconfig.json", JSON.stringify(config, null, 2) + "\n")
'
pnpm install && pnpm typecheck && pnpm lint && pnpm test && pnpm exec songstress check .
```

Those are the copy's only differences from Songstress's: `git diff --stat sdk` should show the SDK's own changes and nothing else. Commit `sdk/` on its own, naming the Songstress commit it came from. Once `songstress` is on npm, `sdk/` goes and the root's `songstress` devDependency names the published version instead.
