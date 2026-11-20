# The official list's index

What the public `songstress-extensions` repository publishes as `index.json`, on its `index` branch (`https://raw.githubusercontent.com/pacholoamit/songstress-extensions/index/index.json`, the server's default), and every Songstress server reads (`apps/pocketbase/internal/extensions/index.go`): which extensions install from the official list, each version pinned by its package's SHA-256, the block list, and the repository's `publishers.json` (who is Verified). It is the one source of what a server lists and whom it calls Verified; songstress.app's directory adds only the Featured order (`GET /api/extensions/directory/?v=1`, `{v, rev, featured}`), and a featured id the index does not list is never shown. `index.ts` makes and checks one; `cli.ts` is the command the repository's release workflow and its owner run.

## The format

A [DSSE](https://github.com/secure-systems-lab/dsse) envelope, signed with Ed25519:

```json
{
  "payloadType": "application/vnd.songstress.extension-index+json",
  "payload": "<the payload's JSON, base64>",
  "signatures": [{ "keyid": "<the first 16 hex digits of the raw public key's SHA-256>", "sig": "<base64>" }]
}
```

Each signature is over DSSE's pre-authentication encoding of the payload: `DSSEv1 <length of the type> <type> <length of the payload> <payload>`, lengths in bytes as decimal. Several keys may sign one index (the way a new key comes in while the old one still counts). The payload:

```json
{
  "format": 1,
  "issued": "2026-11-18T00:00:00.000Z",
  "expires": "2026-12-18T00:00:00.000Z",
  "sequence": 7,
  "extensions": [
    {
      "id": "songstress.soundcloud",
      "marketplace": false,
      "versions": [
        {
          "version": "1.0.0",
          "published": "2026-11-18T00:00:00.000Z",
          "sha256": "<the package archive's, hex>",
          "size": 73194,
          "url": "https://github.com/<owner>/songstress-extensions/releases/download/songstress.soundcloud%401.0.0/songstress.soundcloud-1.0.0.songstress",
          "manifest": { "...": "the whole songstress.json" }
        }
      ]
    }
  ],
  "blocked": [{ "id": "acme.bad", "versions": ["1.2.0"], "sha256": ["…"], "reason": "…", "at": "…" }],
  "publishers": [{ "name": "songstress", "verified": true }, { "name": "acme", "verified": false }]
}
```

`publishers` is the repository's `publishers.json` as it stands at signing: one entry a publisher, the first part of their extensions' ids, `verified` when the list's owner verified who they are (a change the registry App opens and CI merges). Signing folds it into the payload, so one signature covers what is listed and who is Verified, and no server reads Verified from anywhere else.

A server takes an index only when a key it trusts signed it (built in, or named in `SONGSTRESS_EXTENSIONS_INDEX_KEYS`), its `format` is 1, `expires` is still ahead and `issued` not ahead, and its `sequence` is not below the last one it took: an index is never rolled back to one that listed what a later one blocked. It keeps the last one taken, so the list works offline, and fetches it again when the worker's daily `extension_index` job asks (`POST /api/songstress/extensions/v1/server/official/refresh`).

- **A version** installs from the official list when its manifest, carried whole, passes the install profile on the server's API (the publisher `songstress` allowed), and its package, downloaded from GitHub (`url`), is the one `sha256` names. A version listed with `marketplace: true` is the one songstress.app's Marketplace shows; the index's maker sets it only when the manifest passes the listing profile, so an extension that plays or downloads, or has no screenshots yet, installs from the list without being shown there (PLAN.md, decision 4).
- **Updates**: a server moves an official install to a newer listed version by itself a day after its `published` time (the cool-down), and only when it asks for nothing new; one that does is held for an admin, with a notice.
- **The block list**: an install whose id (all versions, or those named) or package digest is listed is switched off at once, with a notice and a line in the audit.

## Making and signing one

```sh
node index/cli.ts keygen ~/.songstress/official-index.key   # once: prints {keyid, publicKey}
node index/cli.ts build dist/*.songstress \
  --url 'https://github.com/<owner>/songstress-extensions/releases/download/{id}%40{version}/{file}' \
  --publishers publishers.json --sequence 1 --days 30 > payload.json
node index/cli.ts sign payload.json ~/.songstress/official-index.key > index.json
node index/cli.ts verify index.json <publicKey>
```

The private key never goes into the repository: it lives where only `main`'s release workflow reads it, a GitHub environment of its own, or on its owner's machine when he signs by hand (PLAN.md, decision 9). The public key goes into `officialKeys` in `index.go` a release before an index signed with it is published. The sequence grows by one each publication; the expiry is renewed within 30 days, or servers stop taking the index (and list nothing until a fresh one comes).
