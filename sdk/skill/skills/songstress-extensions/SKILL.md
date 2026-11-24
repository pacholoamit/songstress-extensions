---
name: songstress-extensions
description: Build, test, package and publish extensions and themes for Songstress, the self-hosted music server, with the `songstress` SDK and `create-songstress-extension`. Use this whenever someone wants to make or change a Songstress extension of any kind (a lyrics, metadata, artwork, artist-info, search, links, scrobble or recommendation provider; a command, menu item, setting, page, panel or status item in the apps; a hook on plays; a job, a route, a sign-in; a theme), works in a folder that holds a songstress.json, or asks about songstress dev, songstress check, songstress pack, .songstress files, the extension manifest, its permissions, or listing an extension in the Songstress Marketplace, even if they never say "SDK".
---

# Building Songstress extensions

An extension is a folder with a manifest, `songstress.json`, and whatever it names. **The manifest declares, code
attaches**: every command, setting, provider or page is listed in the manifest with the permission it needs, and
code gives it behaviour by id. Code runs in a sandbox, on the user's own server (`entry.server`) or inside one app
(`entry.client`). Prefer the server entry: it works for every app, phones included, and while no app is open.

## Where the truth is

This skill is the workflow and the judgement. The format itself is versioned with the SDK, so read it from there
instead of from memory, and never from this file:

- **`node_modules/songstress/SPEC.md`**, installed with every extension: the manifest field by field (§4), what an
  extension contributes (§5), hooks (§7), permissions (§8), the API (§9), the declared interface (§10), providers
  (§11), themes (§12), every validation code (§13), versions (§14). Search it for the field or code at hand.
- **The API's types**, `node_modules/songstress/dist/types/`, and the starter's own `src/server.ts` and its test.
- **The docs**, written for agents too: the developer section is <https://songstress.app/docs/develop/>, with "Your
  first extension" (`…/develop/quickstart/`) walking a real run end to end. Its reference is generated from the SDK
  at <https://songstress.app/docs/develop/reference/songstress/>, one page per module (`…/reference/server/`,
  `client`, `manifest`, `prose`, `testing`, `theme`, `sandbox`), and **every function there has a usage example
  under its signature**, compiled by the SDK's own tests: start from that example rather than guessing a call. Any
  page's Markdown is at `https://songstress.app/docs/<path>.md`, and <https://songstress.app/llms.txt> indexes them
  all.

When the SPEC and anything else disagree, the SPEC of the installed version wins.

## The workflow

1. **Start from the starter**, never from an empty folder: it writes a manifest that passes, a typed entry with a
   test against a mock Songstress, the build and pack scripts, CI and release workflows.

   ```sh
   npm create songstress-extension@latest my-lyrics -- --yes --id acme.my-lyrics --name "My Lyrics" --category lyrics
   ```

   Every question has a flag (`--help` lists them), and `--yes` takes defaults for the rest: an agent has no
   terminal to answer at. `--theme` starts a theme instead of code. Whatever the category, the code it writes is
   one worked example (a play counter: two hooks, `listening.read`, `storage`, a setting and a command). Keep its
   shape, the scripts and the test setup, and replace its manifest entries, code, tests and README lines with what
   the user asked for; `check` then flags anything of the example left unused. Run in a repository that already holds several
   extensions, it adds one more. The publisher half of the id is the author's GitHub user or organisation: ask for
   it rather than invent one, because the id never changes once released.

2. **Declare before you code.** Decide what the extension contributes (the guide below, then
   [references/contributions.md](references/contributions.md) for the kind at hand), and put each piece in
   `songstress.json` with its permission and a reason a person will read. Then write the code that attaches to it.

3. **Write the entry** in `src/server.ts` (or `src/client.ts`). Register everything at the top level: the entry is
   started when something it declared is called for and may be stopped when idle, so keep what must last in
   `songstress.storage`, never in a variable.

4. **Test against the mock host**: `npm test`. `createMockHost` from `songstress/testing` is given the manifest and
   refuses what a real server refuses: a call without its permission, a request to a host the manifest does not
   name, a hook it does not list. Write a test for each thing the extension does.

5. **Check**: `npm run typecheck`, then `npm run check` until it prints `ok`. Each finding is a code and a JSON
   pointer into the manifest (`PERMISSION_REQUIRED /permissions`); look the code up in SPEC.md §13 and fix the
   cause, never the message.

6. **Try it on a real server** when the user has one: `SONGSTRESS_PASSWORD=… npm run dev -- --server <url> --email
   <admin's email>`. It pushes a development install only that admin sees, again on every save, and prints the
   extension's log. Ask for the address and the account; never guess them, never print or store the password.

7. **Pack**: `npm run package` writes `<id>-<version>.songstress`, the one file a server installs and a release
   carries.

8. **Release and list**: [references/publish.md](references/publish.md).

Before saying an extension is done, run `npm run typecheck && npm test && npm run check && npm run package` and
report what each said and the package's file name. Do not claim a listing is ready until
`npm run check -- --profile listing` passes.

## Rules that trip people

`songstress check` catches each of these, but knowing them first saves the round trip.

- **The id** is `publisher.name`, lowercase letters, digits and single hyphens. A publisher named like a part of
  the API (`player`, `storage`, `hooks`…) is refused, and `songstress.*` is Songstress's own: a server installs it
  from the official list alone (`ID_RESERVED`).
- **`engines.songstress`** is the range of API versions it runs on, `^0.1.0` style, never `*`. Using something
  that came with a later version (the SPEC says "came with API 0.1.x") means raising the floor to it.
- **Declared and used, both ways.** A contribution without its permission or its entry is an error
  (`PERMISSION_REQUIRED`, `ENTRY_REQUIRED`), and so is a permission or an entry nothing uses (`PERMISSION_UNUSED`,
  `ENTRY_UNUSED`). Ask for the least.
- **Network**: there is no `fetch`, and the server has no `URL`; use `songstress.net.fetch`, or the helpers
  `songstress/server` builds on it (`fetchJson`, `queryString`, `parseUrl`: contributions.md, Providers). Name every
  public host under `network.hosts` (a host, or `*.yourdomain.com`; never a scheme, a path, an address or a bare
  `*`). The user's own network is `network.local`, server code only.
- **Use the SDK's helpers, never your own copies.** Everything the official extensions use is public in
  `songstress/server`, so a third party needs nothing else: `registerCatalog` (a catalogue source's search, its
  track, album, artist and playlist lookups and its link resolving, registered under one id in one call),
  `fetchJson`, `fetchText`, `fetchResponse`, `nullIfMissing` and `findInAnswer` (requests tried once more after a
  network failure or a 5xx, with failures Songstress understands), `KeptValue` (a token kept until it
  runs out), `matchScore` and `bestMatch` (the one result of many that is the song asked for), `foldText`,
  `htmlToText`, `parseUrl`, `resolveUrl`, `urlParam`, `queryString`, `base64Bytes`, `utf8Text` and `gunzip`. Import
  them from `songstress/server`; a private helper that does the same is a finding in review. A failure the helpers
  raise names the host and a reason, never the address, its query or a secret: keep your own the same.
- **The sandbox** has ECMAScript 2023, timers and `console.log`, and nothing else: no DOM, no Node, no `eval` or
  WebAssembly, and on the server no `URL`, `TextEncoder`, `crypto` or `Intl`. Bundle what you need;
  `songstress build` makes the one script an entry must be. Only JSON crosses to and from Songstress. A server call
  has 64 MiB and 30 seconds.
- **Observe and add, never replace.** Hooks tell what happened and cannot refuse or delay it. A provider answers
  beside Songstress's own sources, switched off or last until the admin orders them.
- **Two profiles.** `check` holds the manifest to what a server installs. `--profile listing` adds what the
  Marketplace asks on top: `about`, `license`, `repository` (a GitHub address), one category, a 512 by 512 PNG `icon`
  and three to six screenshots with their real sizes.
- **The extension's page** (songstress.app/extensions/<id>, and the same page in the apps) is drawn from the
  manifest: `about` (its Description, required to list: one to 16 blocks), `useCases` (one to eight lines of up to
  240 characters), `howItWorks` (what it asks its service, keeps and changes: one to 32 blocks), the https addresses
  `homepage`, `demo` and `support`, and an optional `banner` (16:9, 1280 by 720 to 3840 by 2160, PNG, JPEG or WebP;
  without one the first wide screenshot is the card). Each block is ONE line of prose: a paragraph, a heading
  (`## `, `### `) or a list item (`- `), with `**bold**`, `*emphasis*`, `` `code` `` and https links inside; nothing
  else is drawn, and a line break is refused (`TEXT_UNSAFE`). `songstress/prose` (`parseProse`, `proseToMarkdown`)
  shows exactly how it reads. Write it from what the code really does, the way the official 18 do: what it adds,
  what it needs from an admin, what it never does. These fields came with API 0.1.9: raise `engines.songstress` to
  `^0.1.9` when you use them.
- **No made-up pictures or facts.** Icons and screenshots are real captures the author provides; leave them out and
  let `check --profile listing` list them as missing. Never log a token or a secret setting; credentials belong in
  `songstress.secrets`.

## What to build: a guide

| The user wants | It is | Read |
|---|---|---|
| Lyrics, artwork, artist bios, metadata, search results, link resolving, recommendations from a service | a **provider** (`contributes.providers.<kind>`) | contributions.md, Providers; SPEC §11 |
| Plays sent somewhere (Last.fm-like) | a `scrobble` provider, or `onScrobble` | contributions.md, Providers; SPEC §7, §11 |
| Something reacting to plays, likes or library changes | **hooks** | contributions.md, Hooks; SPEC §7 |
| A button, menu item, setting, page, panel or status item | the **declared interface** | contributions.md, Interface; SPEC §5, §10 |
| Work on a schedule, an HTTP endpoint, a sign-in to a service | **jobs**, **routes**, **signIn** | contributions.md; SPEC §5, §9 |
| New colours for the apps | a **theme** (`--theme`) | contributions.md, Themes; SPEC §12 |

Several pieces can live in one extension; one extension per service or idea keeps permissions small.
