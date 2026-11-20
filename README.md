# songstress-extensions

Songstress's official extensions: the ones made by Songstress's maintainer, which every Songstress server can install from its catalogue. Other authors publish their extensions from their own GitHub repositories and submit them to the Marketplace on songstress.app; they never need to add them here.

| Folder | Extension | Licence |
|---|---|---|
| `apple-music/` | `songstress.apple-music` | LGPL-3.0-only (`COPYING`, `LICENSE`, `NOTICE`) |
| `genie-music/` | `songstress.genie-music` | MIT (`LICENSE`) |
| `jiosaavn/` | `songstress.jiosaavn` | LGPL-3.0-only (`COPYING`, `LICENSE`, `NOTICE`) |
| `soundcloud/` | `songstress.soundcloud` | LGPL-3.0-only (`COPYING`, `LICENSE`, `NOTICE`) |
| `spotify-web/` | `songstress.spotify-web` | LGPL-3.0-only (`COPYING`, `LICENSE`, `NOTICE`) |

`shared/` is the code they share, built into each one's package. `sdk/` is the Songstress extension SDK (MIT), carried here until it is published on npm. `index/` makes and signs the official index (MIT).

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
