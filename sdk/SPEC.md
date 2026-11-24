# Songstress extensions: the specification

Manifest version 1 · extension API 0.1.10

This document says what a Songstress extension is, what its manifest holds, what its code may do and where each part of it works. It is written for people who build extensions. Three things in this package say the same in a form a program reads, and they win where this text and they differ:

- `schema/extension.v1.json`, the manifest's JSON Schema;
- the validator (`songstress/manifest`) with its corpus of manifests (`corpus/`), and the reader of a theme's colours (`songstress/theme`) with theirs (`corpus/colors.json`);
- the API's types (`songstress`, `songstress/server`, `songstress/client`).

The specification is ahead of the hosts that run it. It is version 0.x: it may still change between minor versions (section 14).

## Contents

1. [What an extension is](#1-what-an-extension-is)
2. [A complete example](#2-a-complete-example)
3. [The package](#3-the-package)
4. [The manifest](#4-the-manifest)
5. [What an extension contributes](#5-what-an-extension-contributes)
6. [Where each part works](#6-where-each-part-works)
7. [Hooks](#7-hooks)
8. [Permissions](#8-permissions)
9. [The API](#9-the-api)
10. [Declared interface](#10-declared-interface)
11. [Providers](#11-providers)
12. [Themes](#12-themes)
13. [Validation](#13-validation)
14. [Versions and stability](#14-versions-and-stability)
15. [Not in this version](#15-not-in-this-version)
16. [Notes: what this follows](#16-notes-what-this-follows)

## 1. What an extension is

An extension is a package: a folder with a manifest, `songstress.json`, at its root, and beside it whatever the manifest names. A theme is a manifest, its colours written in it or in a theme file beside it. A scrobbler is a manifest and one JavaScript file.

Six ideas hold the rest together.

**The manifest declares, code attaches.** Everything an extension adds to Songstress is listed in the manifest: its commands, menu items, settings, pages, providers and the rest. Code gives each of them its behaviour, by id. So an app can show an extension's menus and settings, and a listing can say what the extension does, without running a line of it.

**Two entries, both optional.** An extension's code is one JavaScript bundle for each side it runs on.

| Entry | Runs | Good for |
|---|---|---|
| `entry.server` | On the user's own server, in a sandbox, for every member and every app | Anything that must work for a phone, or while no app is open: hearing plays, providers, jobs, routes, pages every app can draw |
| `entry.client` | Inside one app, in a sandbox, while that app is open | Following this device's player live, and interface that reacts at once |

An app may not run client code at all (section 6). What must work everywhere belongs in the server entry.

**Code is started when it is needed.** There is no "on start-up". Songstress starts an entry when something it declared is called for: a hook it listens to fires, one of its commands is run, a provider is asked, a page or a panel is drawn, a job is due, a route is called. It may stop the entry again when it is idle. So an entry registers everything at its top level each time it starts, and keeps what must last in `songstress.storage`, never in a variable.

**Hooks observe.** A hook tells an extension what did happen. Nothing waits for a listener, and there is no hook that can refuse or delay: no extension can stall the music.

**An extension adds, and never replaces.** A provider answers beside Songstress's own sources, in the order the admin sets. An extension draws inside the places given to it, never over Songstress's own interface.

**Nothing is allowed until a person allows it.** The manifest asks for each permission with a reason in plain words. The server's admin grants them; what concerns one member's listening, that member grants for themselves.

### The sandbox

Code runs with nothing but the JavaScript language and the `songstress` API.

- **There:** ECMAScript 2023 (promises, async functions, iterators), timers, and `console.log`, which writes to the extension's log.
- **Not there:** `fetch` (use `songstress.net.fetch`), the DOM, every Node.js API, the file system, `eval`, `new Function` and WebAssembly. On the server do not count on `URL`, `TextEncoder`, `crypto` or `Intl` either, and dates are in UTC. Bundle what you need.
- **One file.** An entry is one classic script with everything bundled into it and no `import` or `export` left: a bundler's IIFE output. An app's sandbox cannot load a module.
- **Limits on the server.** 64 MiB of memory and 30 seconds for one call (a hook, a command, a provider's answer). A timer does not keep a call alive past the promise it returned.
- **Limits in an app.** Client code that stops answering, or floods the app with messages, is stopped, and an extension stopped again and again is switched off.
- **JSON at the border.** Everything that crosses between an extension and Songstress is JSON: no function, no date object, no binary value.

## 2. A complete example

Tunelog Scrobbler sends each member's plays to their own profile on a made-up service. It is a whole extension: a manifest and one server entry. Both files are in `examples/tunelog/`, and the package's tests check the manifest, compile the code against the API and run it.

`songstress.json`:

```json
{
  "$schema": "https://songstress.app/schema/extension/v1.json",
  "manifestVersion": 1,
  "id": "acme.tunelog",
  "name": "Tunelog Scrobbler",
  "version": "1.2.0",
  "description": "Sends what you play to your Tunelog profile, what is playing now included.",
  "engines": {
    "songstress": "^0.1.0"
  },
  "license": "MIT",
  "repository": "https://github.com/acme/songstress-tunelog",
  "about": [
    "Tunelog Scrobbler sends each song you finish to your Tunelog profile, and shows there what is playing now.",
    "Every member signs in with a token of their own, so each profile holds only its own plays."
  ],
  "sponsor": {
    "url": "https://github.com/sponsors/acme"
  },
  "categories": [
    "scrobbling-stats"
  ],
  "keywords": [
    "scrobble",
    "tunelog",
    "stats"
  ],
  "icon": {
    "path": "assets/icon.png",
    "width": 512,
    "height": 512
  },
  "banner": {
    "path": "assets/banner.png",
    "width": 1280,
    "height": 720
  },
  "screenshots": [
    {
      "path": "assets/settings.png",
      "width": 1280,
      "height": 800,
      "caption": "Connecting a Tunelog account",
      "platform": "web"
    },
    {
      "path": "assets/phone.png",
      "width": 1179,
      "height": 2556,
      "caption": "The same setting on a phone",
      "platform": "ios"
    },
    {
      "path": "assets/profile.jpg",
      "width": 1280,
      "height": 800,
      "caption": "Plays arriving on the profile"
    }
  ],
  "entry": {
    "server": "dist/server.js"
  },
  "hooks": {
    "server": [
      "onPlay",
      "onScrobble"
    ]
  },
  "permissions": {
    "network": {
      "reason": "Send your plays to Tunelog.",
      "hosts": [
        "api.tunelog.example"
      ]
    },
    "listening.read": {
      "reason": "Know what you play, to send it to your profile."
    },
    "storage": {
      "reason": "Keep the plays that could not be sent yet."
    }
  },
  "contributes": {
    "settings": [
      {
        "key": "token",
        "type": "secret",
        "title": "Tunelog token",
        "description": "From your Tunelog account, under Settings and then API.",
        "scope": "user",
        "required": true
      },
      {
        "key": "nowPlaying",
        "type": "boolean",
        "title": "Show what I am playing",
        "scope": "user",
        "default": true
      }
    ],
    "commands": [
      {
        "id": "test-connection",
        "title": "Test the connection",
        "run": "server"
      }
    ],
    "menus": {
      "settings/actions": [
        {
          "command": "test-connection"
        }
      ]
    }
  }
}
```

`src/server.ts`, bundled to `dist/server.js`:

```ts
// Tunelog Scrobbler: the server entry of the example in SPEC.md.
// It sends each member's plays to their own Tunelog profile.

import { songstress, type NetRequest, type Song } from 'songstress/server'

// Every address the extension reaches, written out. The manifest's `network`
// permission names the same host, and Songstress lets no request go elsewhere.
const tunelog = {
  nowPlaying: (request: NetRequest) => songstress.net.fetch('https://api.tunelog.example/v1/now-playing', request),
  listens: (request: NetRequest) => songstress.net.fetch('https://api.tunelog.example/v1/listens', request),
  profile: (request: NetRequest) => songstress.net.fetch('https://api.tunelog.example/v1/me', request),
}

interface Listen {
  title: string
  artist: string
  album?: string
  playedAt: string
}

/** A request signed with one member's token. */
function signed(token: string, body?: object): NetRequest {
  return {
    method: body ? 'POST' : 'GET',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  }
}

const named = (song: Song) => ({ title: song.title, artist: song.artist, album: song.album })

// A song started in one of the member's apps: show it on their profile, when
// they want that. onPlay is live and may be missed, which suits "now playing".
songstress.hooks.onPlay(async (song, play) => {
  const member = { userId: play.userId }
  const token = await songstress.settings.get<string>('token', member)
  const wanted = await songstress.settings.get<boolean>('nowPlaying', member)
  if (token && wanted !== false) await tunelog.nowPlaying(signed(token, named(song)))
})

// A play counted. onScrobble is the reliable one: a play made offline arrives
// later with the time it really happened. What Tunelog does not take now is
// kept in the member's part of the store and sent with the next play.
songstress.hooks.onScrobble(async (song, play) => {
  const member = { userId: play.userId }
  const token = await songstress.settings.get<string>('token', member)
  if (!token) return
  const waiting = (await songstress.storage.get<Listen[]>('waiting', member)) ?? []
  const listens = [...waiting, { ...named(song), playedAt: play.playedAt }]
  const answer = await tunelog.listens(signed(token, { listens })).catch(() => null)
  const sent = answer !== null && answer.status < 300
  await songstress.storage.set('waiting', sent ? [] : listens.slice(-500), member)
})

// The "Test the connection" button of the settings page.
songstress.commands.register('test-connection', async (_input, context) => {
  const token = await songstress.settings.get<string>('token', { userId: context.userId })
  const answer = token ? await tunelog.profile(signed(token)).catch(() => null) : null
  const connected = answer?.status === 200
  const message = connected ? 'Tunelog is connected.' : 'Tunelog did not accept the token.'
  return { action: { type: 'toast', message, tone: connected ? 'success' : 'danger' } }
})
```

What to notice:

- The manifest lists the two hooks under `hooks.server`. Without that list the entry would never be started, and the validator says so (`ENTRY_UNUSED`).
- `onPlay` and `onScrobble` need `listening.read`, the request to `api.tunelog.example` needs `network` with that host, and the store needs `storage`. Each has a reason a person will read.
- The token is a setting of type `secret` and scope `user`: each member types their own, Songstress seals it, and only the server entry can read it.
- Nothing is kept in a variable between calls. The plays that could not be sent wait in storage.
- The button on the settings page is a command, placed by `menus["settings/actions"]`. Its handler answers with an action, and the app shows the message.
- It listens with hooks, to show them. An extension whose one job is to report plays to a service can declare a `scrobble` provider instead (section 11): Songstress then hands it each play and tries again itself when the service fails.

## 3. The package

- **`songstress.json`** is at the root. It is UTF-8 JSON, at most 256 KiB, with objects and lists nested at most 16 deep and no key written twice in one object. No comments, no trailing commas, no byte-order mark.
- **Every path in the manifest** is a plain path from the package root, with forward slashes: `assets/icon.png`. No name in it is empty or ends in a dot or a space (so no `.`, no `..`, no leading or doubled slash), and it holds none of `\ : * ? " < > | % #`.
- **An entry** is one `.js` file: a classic script, readable JavaScript, with everything it needs inside it. No native code, no bytecode, nothing fetched when it is installed.
- **Images** are PNG for the icon and PNG, JPEG or WebP for the rest (`.png`, `.jpg`, `.jpeg`, `.webp`, in lowercase), and the manifest states each one's size in pixels. Whoever installs or lists the package holds the files to what the manifest says.
- **A theme file** and **a view's HTML file** are named by the manifest and kept in the package. A theme file is section 12's, and a server holds it to that section when it installs the package; a view's own format is not part of this document.

**The archive.** A package travels as one ZIP archive: the file an admin uploads, the asset of a GitHub release, what a development build sends to a server. Its root is the package's root: `songstress.json` at the top, with no folder around it. `songstress pack` writes one, and `songstress dev` sends one (README, "The command"). A server installs it only when all of this holds:

- It is at most 32 MiB, holds at most 512 entries, and unpacks to at most 64 MiB, no file over 16 MiB.
- It is one plain archive. Nothing comes before its first file or after its directory (so no comment), nothing lies hidden between its files, no two entries share one file's data, nothing is encrypted, it is not ZIP64, and each file is stored or deflated.
- Every path in it is a plain path, as above, of at most 200 bytes and at most 8 folders deep; UTF-8, and marked as UTF-8 when it is not ASCII; and no two paths name one file on a file system that ignores letter case or Unicode normalisation. There is no link, device or pipe.
- Every file is JavaScript (`.js`), JSON (`.json`), a source map (`.map`), HTML (`.html`), CSS (`.css`), Markdown (`.md`), text (`.txt`), PNG, JPEG or WebP (`.png`, `.jpg`, `.jpeg`, `.webp`), each extension in lowercase; or a `LICENSE`, `LICENCE`, `NOTICE`, `COPYING`, `README`, `CHANGELOG` or `AUTHORS`. Text is UTF-8, with no control character but tab, line feed, form feed and carriage return, so neither a native binary nor QuickJS bytecode passes, whatever its name.
- Nothing in it runs when it is installed: no `node_modules` folder, and no `package.json` with one of npm's install scripts (`preinstall`, `install`, `postinstall`, `prepublish`, `preprepare`, `prepare`, `postprepare`) or dependencies to fetch.
- Every file the manifest names is in it, and every image the manifest names is the type its name says, at the size the manifest states.

**A release.** A server installs from a GitHub release, never a branch: a release that is neither a draft nor a prerelease, carrying the package as its one asset whose name ends in `.songstress`, named `<id>-<version>.songstress` (`acme.tunelog-1.2.0.songstress`). The server holds the asset to the SHA-256 GitHub publishes for it, so upload the asset as it is; an immutable release, and an attestation of the asset, are shown to the admin installing it. A repository holds its extensions one of two ways, and its tags say which:

| A repository of | Holds | A release is tagged | Its latest release |
|---|---|---|---|
| one extension | `songstress.json` at its root | the version: `1.2.0` or `v1.2.0` | the repository's latest full release |
| several | each in a folder of its own, of any name, `<folder>/songstress.json` (the official repository names it by the id's name, `soundcloud/` for `songstress.soundcloud`; `create-songstress-extension` by the whole id, `acme.lamp/`), with shared code beside them; each id once | `<id>@<version>`, the whole id: `songstress.soundcloud@1.2.0` | the newest full release whose tag names that id, by version; another extension's releases are not its own |

A link to a repository of one installs its latest release. A link to a repository of several names the extension, or a release of it (`…/releases/tag/songstress.soundcloud@1.2.0`); a link to such a repository alone is answered with the extensions it holds, to pick from. An update follows the extension's own releases either way, and a release's tag must say the package's version (and, in a repository of several, its id). `songstress check` checks a folder of either kind, or one extension's folder in a repository of several, and says what each release is called; `songstress pack` writes the asset.

## 4. The manifest

Every object in the manifest is closed: a field this document does not name is an error, not something ignored. Text is one line, in one language, and holds no control and no character that draws nothing or turns the direction of text (`TEXT_UNSAFE`); the joiners, direction marks and variation selectors that scripts and emoji need are fine (`corpus/README.md` lists every range). Lengths are counted in characters.

### Identity and versions

| Field | Required | What it holds |
|---|---|---|
| `$schema` | no | The schema's address, `https://songstress.app/schema/extension/v1.json`, so an editor checks the file as you type. |
| `manifestVersion` | yes | `1`. |
| `id` | yes | `publisher.name`: the extension's identity, which never changes. Each part is lowercase letters, digits and single hyphens; 80 characters at most. A publisher may not be named like a part of the API (`ID_RESERVED`): `commands`, `hooks`, `host`, `jobs`, `library`, `listening`, `net`, `network`, `player`, `providers`, `queue`, `routes`, `secrets`, `settings`, `storage`, `themes`, `ui`, `users`. The publisher `songstress` is Songstress's own: a `songstress.*` id comes from the official list alone, and a server refuses one installed from a GitHub link or a file (`ID_RESERVED` at `/id`). |
| `name` | yes | The name people see. 1 to 50 characters. |
| `version` | yes | The extension's own version, a [semantic version](https://semver.org) such as `1.4.0` or `2.0.0-beta.1`. A release is tagged with it. |
| `description` | yes | One or two sentences, shown under the name. 1 to 160 characters. |
| `engines.songstress` | yes | The versions of the extension API the extension runs on, as a range (section 14). `^0.1.0` is the usual answer. Never `*`. |

### Listing

| Field | Required | What it holds |
|---|---|---|
| `license` | for a listing | The code's licence, as an SPDX identifier: `MIT`, `Apache-2.0`. |
| `repository` | for a listing | Where the source lives, an https address. A listing needs `https://github.com/owner/name`. |
| `sponsor.url` | no | Where people can support the author, an https address. |
| `homepage` | no | The extension's own page: its site or its documentation, an https address. |
| `demo` | no | Where it can be seen at work: a video or a live demo, an https address. |
| `support` | no | Where people ask for help: an issue tracker, a forum, a chat, an https address. |
| `about` | for a listing | What the extension is and does, at length: the Description of its page in the Marketplace and in the apps. A list of one to 16 blocks of prose (below). |
| `useCases` | no | What people use it for: one to eight lines of up to 240 characters, each read as a block of prose is. The Use cases of its page. |
| `howItWorks` | no | How it works: what it asks its service, what it keeps, what it changes. One to 32 blocks of prose. The How it works of its page. |
| `categories` | for a listing | A list of exactly one of: `sources`, `lyrics`, `metadata-artwork`, `scrobbling-stats`, `discovery`, `playback-audio`, `visualisers`, `themes`, `social-jam`, `library-tools`, `integrations`, `server-worker`. |
| `keywords` | no | Up to ten tags, each up to 30 lowercase letters and digits with single dots or hyphens between them. |
| `platforms` | no | The apps the extension's interface and client code work in: `web`, `desktop`, `ios`, `android`. Left out, all four. It says nothing of the server entry, which reaches every app. |

**Prose.** A manifest's text is one line, so a page's longer text is a list of blocks, each a line of up to 600 characters: a paragraph, a heading (the block starts with `## ` or `### `) or a list item (it starts with `- `; items that follow one another make one list). Inside a block, `**bold**`, `*emphasis*`, a span in backticks and `[a link](https://example.com)` are read as Markdown, and a link goes only to an https address. Nothing else is: HTML, an image, a table are shown as the text they are, so a page can show what an author wrote and nothing an author did not. A page's copy as Markdown is the blocks, a blank line between them. `songstress/prose` reads them as every page does (`parseProse`, `proseSpans`, `proseToMarkdown`), and carries nothing else.

### Images

Each image is an object with its `path` and its real `width` and `height` in pixels.

| Field | Required | What it holds |
|---|---|---|
| `icon` | for a listing | A PNG of exactly 512 by 512. |
| `banner` | no | The wide image of the extension's card: PNG, JPEG or WebP, 16:9 (`BANNER_NOT_16_9`), from 1280 by 720 to 3840 by 2160. |
| `screenshots` | for a listing | One to six captures, each 320 to 3840 pixels a side, with an optional `caption` (up to 120 characters, also read by screen readers) and the `platform` it was taken on. A listing needs three to six. |

### Code

| Field | Required | What it holds |
|---|---|---|
| `entry.server` | no | The path of the server entry's `.js` file. |
| `entry.client` | no | The path of the client entry's `.js` file. |
| `hooks.server` | no | The hooks the server entry listens to (section 7). |
| `hooks.client` | no | The hooks the client entry listens to. |

Whatever needs code needs its entry (`ENTRY_REQUIRED`), and an entry that nothing would ever start is an error too (`ENTRY_UNUSED`).

### Permissions

`permissions` is an object keyed by the permission's name. Each value has a `reason`, 10 to 200 characters, in words the person granting it will read. Section 8 says what each permission allows.

```json
"permissions": {
  "network": { "reason": "Send your plays to Tunelog.", "hosts": ["api.tunelog.example"] },
  "listening.read": { "reason": "Know what you play, to send it to your profile." }
}
```

- `network` also takes `hosts`: 1 to 20 public hosts, each by name (`api.example.com`) or as every host under a domain (`*.example.com`), with an optional port. Never an address, a scheme, a path, a bare `*` or a whole top-level domain. A server may also refuse a wildcard over a domain under which anyone can have a name (`*.github.io`, `*.co.uk`): name the domain that is yours.
- `network.local` may take `targets`: up to 20 targets on the user's own network, each an IPv4 address (`192.168.1.20`), a block (`192.168.1.0/24`) or a host name (`nas.local`), the address and the name with an optional port. An address or a block must lie inside `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16` or `127.0.0.0/8` (`NETWORK_LOCAL_NOT_PRIVATE`). Left out, the admin names the targets when granting.

A permission the manifest needs and does not ask for is an error (`PERMISSION_REQUIRED`), and so is one it asks for and could never use (`PERMISSION_UNUSED`).

## 5. What an extension contributes

Everything under `contributes`. An id is lowercase letters, digits and single hyphens, starts with a letter, is at most 40 characters, and is unique among its kind (`DUPLICATE_ID`). A title is 1 to 60 characters; a description is 1 to 160. An `icon` is a name from Songstress's icon set, in the same form as an id; a name an app does not know is drawn as the extension mark.

### `commands`

Named actions that code carries out. Up to 50.

| Field | Required | What it holds |
|---|---|---|
| `id` | yes | The name code registers the handler under: `songstress.commands.register(id, handler)`. |
| `title` | yes | The label of the menu item or button that runs it. |
| `run` | yes | `server` or `client`: the entry that holds the handler. |
| `description`, `icon` | no | What it does; the icon beside the title. |

### `menus`

Where commands appear. An object keyed by location; each value is a list of up to ten `{ "command": "<id>" }` items, each naming a declared command (`MENU_COMMAND_UNKNOWN`), none twice in one menu (`DUPLICATE_ID`). An item may have a `when`: a condition it shows under (section 10, "Conditions").

```json
"menus": {
  "song/context": [{ "command": "add-to-chart", "when": "signedIn && !favorite" }],
  "player/actions": [{ "command": "open-visualiser", "when": "views && platform != 'ios'" }]
}
```

| Location | Where | The handler's input |
|---|---|---|
| `song/context` | A song's menu | The song |
| `album/context` | An album's menu | The album |
| `artist/context` | An artist's menu | The artist |
| `playlist/context` | A playlist's menu | The playlist |
| `queue/item` | The menu of a song waiting in the queue | The song |
| `player/actions` | The player's own menu | The song that is playing |
| `sidebar` | The sidebar of the web and desktop apps | Nothing |
| `settings/actions` | Buttons on the extension's settings page | Nothing |

On phones an extension's items in a menu sit together in one "Extensions" submenu.

### `settings`

The settings Songstress draws and keeps for the extension: a list, in the order they are shown, of up to 50. Every setting has a `key` (the name code reads it by: letters and digits, starting with a lowercase letter), a `type`, a `title`, an optional `description`, and a `scope`.

| `scope` | Whose it is | Who reads it |
|---|---|---|
| `server` | The whole server's; the admin sets it | The server entry, and client code unless it is a secret |
| `user` | Each member's own | The server entry (naming the member), and that member's client code |
| `device` | Each device's own | Client code on that device |

| `type` | Drawn as | Also takes |
|---|---|---|
| `string` | A line of text | `default`, `placeholder`, `maxLength` (1 to 2000), `required` |
| `secret` | A password field | `placeholder`, `required`. Its scope is `server` or `user`, and it has no default. Songstress seals it, never shows it again and never sends it to an app |
| `number` | A number | `default`, `minimum`, `maximum`, `step` (more than 0), `required` |
| `boolean` | A switch | `default` |
| `select` | One choice from a list | `options` (1 to 50 of `{ "value", "title" }`), `default` (the value of an option), `required` |

`required` means Songstress asks for the setting and does not start the extension for whoever lacks it: for anyone while a `server` setting is empty, for a member while their `user` setting is, on a device while its `device` setting is. A default must be a value the setting itself would accept (`SETTING_DEFAULT_INVALID`), a `minimum` may not be above its `maximum` (`SETTING_RANGE_INVALID`), and no two options share a value (`SETTING_OPTION_DUPLICATE`).

**The settings form.** Every app draws the settings on the extension's own page, each scope where its owner sets it: the server's for the admin, a member's own, and this device's under "This device" (on a phone, "This phone"). A setting may name a `section`, up to 40 characters: the settings that name one section are drawn together under it as a heading, in the order the sections first come, and those that name none come first. The buttons of `menus["settings/actions"]` stand under them.

### `pages`, `panels` and `status`

Interface drawn from a tree of Songstress's own components, in places Songstress gives it (section 10). Each names `render` (`server` or `client`): the entry that builds its tree, which registers the renderer under its `id`. What the server entry renders shows in every app. Each may have a `when` (section 10, "Conditions").

A page is a screen of its own, opened by an action, or from the apps' own navigation when it sets `sidebar`: the sidebar of the web and desktop apps, the Library tab of the phones. Up to 20: `id`, `title`, `render`, and optionally `icon`, `sidebar` and `when` (which holds back its navigation entry, never the page).

A panel is a section inside one of Songstress's own screens. Up to 10: `id`, `title`, `render`, `location`, and optionally `when`:

| `location` | Where the panel is drawn | Its renderer is told |
|---|---|---|
| `now-playing` | The player's now-playing view | The song playing |
| `home` | Home, after Songstress's own shelves | |
| `artist` | An artist's page | The artist |
| `album` | An album's page | The album |
| `playlist` | A playlist's page | The playlist's id |

A status item is the extension's state at a glance, in the player: a few words and an icon ("Sent", a check), in a tone, with what a tap does. Up to 2: `id`, `title` (what it is, for people who do not see it), `render`, and optionally `icon` (shown until the renderer answers) and `when`.

```json
"status": [{ "id": "sent", "title": "Tunelog", "render": "server", "icon": "check", "when": "signedIn" }]
```

Status items, `when`, a `playlist` panel and a setting's `section` came with API 0.1.4, so a manifest that has one asks for it: `"songstress": "^0.1.4"`.

### `views`

Free-form pages: the extension's own HTML file. An app opens a view in the browser, apart from the app (section 10, "Views"): it gets no `songstress` API, and nothing of the app's storage or session. Up to 10: `id`, `title`, `path` (an `.html` file), and optionally `icon` and `sidebar`. A view and a page are opened the same way, so they share their ids. An app may be unable to open views (section 6): offer a page for what must work everywhere.

### `themes`

Themes for the picker. Up to 20, each with an `id`, a `label` (its name in the picker), an `appearance` (`dark`, `light` or `both`: the looks it has), and those looks: written here as `dark` and `light`, or in a theme file whose `path` it names (a `.json` file), never in both. Section 12 says what a look holds. A theme is data: it needs no entry and no permission.

```json
"themes": [
  { "id": "mocha", "label": "Catppuccin Mocha", "appearance": "dark", "dark": { "colors": { "background": "#1e1e2e", "text": "#cdd6f4", "accent": "#cba6f7" } } },
  { "id": "nord", "label": "Nord", "appearance": "both", "path": "themes/nord.json" }
]
```

### `providers`

Sources the extension adds beside Songstress's own. An object keyed by kind, each a list of up to five sources: `search`, `lookup`, `links`, `lyrics`, `metadata`, `artwork`, `artistInfo`, `scrobble`, `recommend`, `play`, `download`. Section 11 has each kind's fields and what its code answers.

### `jobs`

Work on the server, shown in Activity while it runs. Up to 20: `id`, `title` (as Activity shows it) and optionally `every`: how often the job runs by itself, as a number and `m`, `h` or `d` (`15m`, `6h`, `1d`). Without `every` the job runs only when code starts it.

### `routes`

JSON routes for signed-in callers, under a prefix that belongs to the extension. Up to 50: `id`, `method` (`GET`, `POST`, `PUT`, `PATCH` or `DELETE`) and `path`: segments of lowercase letters, digits, dots, hyphens and underscores, or `:name` for a part the handler reads (`/charts/:period`). Two routes may not answer the same method and path (`ROUTE_DUPLICATE`); the name of a `:name` part does not tell two paths apart.

### `signIn`

A sign-in to the service the extension reaches, which a person starts and ends in Songstress: one object, not a list.

| Field | Required | What it holds |
|---|---|---|
| `scope` | yes | Whose account it is. `server`: one account for the whole server, which its admin signs in. `user`: each member's own, which they sign in themselves, from their own page of the extension. |
| `title` | no | The service as the sign-in names it. Left out, the extension's name. |

It needs the server entry (`ENTRY_REQUIRED`), whose handler does the signing in (section 9), and the `secrets` permission (`PERMISSION_REQUIRED`): the tokens a sign-in is given are the extension's own secrets. It came with API 0.1.1, so a manifest that has one asks for it: `"songstress": "^0.1.1"`. Scope `user` came with API 0.1.7: `"songstress": "^0.1.7"`.

## 6. Where each part works

"Phone" is the iPhone, iPad and Android apps. A phone build made for an app store leaves three things out: the web views that run client code, free-form views, and the in-app catalogue of extensions. Everything an extension does on the server, its declared interface, its settings, and installing by link or QR code are in every build.

| Part | Server | Web and desktop | Phone | Phone build for a store |
|---|---|---|---|---|
| Server entry: hooks, providers, jobs, routes | Runs here | Reaches them | Reaches them | Reaches them |
| Client entry and its hooks | | Runs while the app is open; not yet on Windows and Linux | Runs while the app is open and in front | Not available |
| `commands` with `run: server` | Runs here | Yes | Yes | Yes |
| `commands` with `run: client` | | Yes; not yet on Windows and Linux | Yes | Not available |
| `menus` | | Every location | Every location but `sidebar`; an extension's items in a menu share one submenu | As a phone |
| `settings` | Kept here | Drawn | Drawn | Drawn |
| `pages`, `panels` and `status` with `render: server` | Rendered here | Drawn | Drawn | Drawn |
| `pages`, `panels` and `status` with `render: client` | | Drawn; not yet on Windows and Linux | Drawn | Not available |
| `views` | Serves the files | Opened in a tab of the browser (web) or the system's browser (desktop) | Opened in the in-app browser | Not available |
| `themes` | | Applied | Applied | Applied |
| `providers` | Runs here | Shows the results | Shows the results | Shows the results |
| `jobs` | Runs here | Shown in Activity | Shown in Activity | Shown in Activity |
| `signIn` | Runs here, and keeps the account's name | The admin signs in from the extension's page; a member signs in to their own account (scope `user`) from their own page of it, in Settings | As the web | As the web |

On a phone, client code runs in a web view of its own, never in the app's own engine, so it needs an app that carries one. On the web and the desktop it runs in a hidden frame of its own, sandboxed to scripts alone, whose origin is no one's: it reaches none of the app's storage, session or network, nor the desktop's own calls, and speaks with the app only through the calls it was granted. The Windows and Linux desktops run none yet, as their web views give a frame more than the macOS one does. An app without client code, or a build for a store, still draws everything else an extension declares; the server entry's work goes on for it as for any app. A view opens in the browser on every app, never inside one.

Nothing of an extension appears on a watch, in a car or in a widget.

An extension does not have to guess which app it is drawing for. Every render and every command run by a person is told the app (`client` in its context), and `songstress.host.info()` tells client code about its own:

```ts
const { client } = await songstress.host.info()
if (client?.capabilities.views) { /* offer the free-form view */ }
```

`ClientInfo` holds the `platform`, the version of the component vocabulary the app draws (`ui`), and its `capabilities`: `clientCode` (it runs client entries) and `views` (it opens free-form views). An app may draw an older vocabulary than this package describes: a renderer that answers something newer than `client.ui` for an app is drawn there as "needs a newer app".

## 7. Hooks

A hook is delivered only when the manifest lists it under `hooks.server` or `hooks.client`, with the entry (`ENTRY_REQUIRED`) and the permission it needs (`PERMISSION_REQUIRED`). A listener's first argument is the thing itself, its second what is known of the moment:

```ts
songstress.hooks.onPlay((song) => { /* … */ })
```

Events reach listeners through a bounded queue, never in playback's path: under a flood, events are dropped rather than the music made to wait.

### Server hooks

They see every app of every member who granted the extension their listening, phones included. A play started from a car, or from a watch that controls the phone, goes through the phone's player and is reported like any other.

| Hook | Fires when | Permission | How far to trust it |
|---|---|---|---|
| `onPlay` | A member started a song: their app reported it, about a second in, once for each song | `listening.read` | Live only. A play that starts offline is never reported, a locked Android phone may report late or not at all, a watch playing on its own reports none, and an audition of a search result reports nothing. Use it for "now playing" |
| `onScrobble` | A play counted: half the song, or four minutes of it, was heard | `listening.read` | Reliable. A play made offline waits on the device and arrives later, with the time it really happened (`playedAt`) |
| `onFavorite` | A member marked a song, an album or an artist as a favourite, or took the mark away | `listening.read` | |
| `onPlaylistChange` | A public playlist was created, changed or deleted | `library.read` | Playlists their owners keep private are not reported |
| `onLibraryChange` | Songs came into the library, changed or left it | `library.read` | Ids only, in batches |
| `onScanComplete` | A scan of the library finished | `library.read` | |

A server delivers `onPlay` at most once: an event it cannot hand over at once (a flood, or its extension host restarting) is dropped, never told late. It delivers `onScrobble` at least once, in the order the plays were counted, going back a week at most: a play is told again when the server or its host stopped while it was being delivered, or when the extension's code crashed in it. So a listener that keeps or sends plays takes one it has already seen as done; a play is its member's `userId` with its `playedAt`.

### Client hooks

They follow the player of the one device the code runs on, while its app is open. In the background client code is stopped, and when the app comes back it is told the current state; what must not be missed belongs in a server hook.

| Hook | Fires when | Permission |
|---|---|---|
| `onPlay` | Playback started, or went on after a pause | `listening.read` |
| `onPause` | Playback paused | `listening.read` |
| `onTrackChange` | Another song became the current one | `listening.read` |
| `onSeek` | The listener moved to another place in the song | `listening.read` |
| `onVolumeChange` | The volume changed | none |
| `onQueueChange` | Songs were added to the queue, removed or moved | `listening.read` |
| `onProgress` | Playback moved on: at most once a second, while a song plays | `listening.read` |

`onPlay` is the one hook both entries have. They do not mean the same: the server's fires once for each song a member starts, the client's each time this device's player starts or resumes.

## 8. Permissions

| Permission | Allows | Unlocks | Granted by |
|---|---|---|---|
| `network` | Requests to the public hosts it names, over http or https. The address a name resolves to is checked when connecting and on every redirect | `net.fetch` | The admin |
| `network.local` | Requests to targets on the user's own network, from server code only | `net.fetch` to those targets, in the server entry | The admin, who confirms twice |
| `library.read` | Reading the catalogue and hearing when it changes | `library.*`; `onPlaylistChange`, `onLibraryChange`, `onScanComplete` | The admin |
| `users.read` | Members' ids and display names, nothing else | `users.*` | The admin |
| `listening.read` | One member's plays, what they are playing now and what they like | `onPlay`, `onScrobble`, `onFavorite`; the client hooks; `player.getState`, `queue.get`; a `scrobble` provider, which is handed members' plays | That member, for themselves, once the admin has allowed the extension |
| `player.control` | Starting, pausing, skipping and seeking the player of the device the code runs on, and adding to its queue | `player.play`, `pause`, `next`, `previous`, `seek`; `queue.add` | The admin |
| `providers` | Answering beside Songstress's own sources. Each source joins switched off or last | `providers.*.register` | The admin |
| `routes` | Serving the extension's own signed-in routes | `routes.register` | The admin |
| `jobs` | Scheduled and background work | `jobs.*` | The admin |
| `storage` | Keeping the extension's own data, under a quota | `storage.*` | Listed at install, no question asked |
| `secrets` | Keeping the extension's own credentials, sealed | `secrets.*`; `signIn.register` | Listed at install, no question asked |

A call the manifest did not ask for, or that nobody granted, fails with the code `permission-denied`. When an update asks for a permission the installed version did not have, the update waits until a person accepts it.

`net.fetch` from client code goes to the public hosts `network` names and nowhere else: never to a target of `network.local`, which server code alone reaches, and the server's host refuses such a request whatever the manifest asks for.

A hook's event carries the id of the member it concerns whether or not the extension may read their name; `users.read` turns an id into a name.

## 9. The API

The API is one object, `songstress`, imported from the entry the code is written for:

```ts
import { songstress } from 'songstress/server' // the server entry
import { songstress } from 'songstress/client' // the client entry
import { songstress } from 'songstress'        // code that runs in either
```

The types in this package are the reference: every member is documented where it is declared. This section is the map.

| Namespace | Entry | Permission | What it is for |
|---|---|---|---|
| `hooks` | both, each with its own hooks | by hook (section 7) | Listening to what happens |
| `commands` | both; `execute` on the client | none | `register` a declared command's handler; from client code, `execute` one of the extension's own |
| `ui` | both | none | `ui.pages.register`, `ui.panels.register` and `ui.status.register`: the renderers of declared pages, panels and status items; `ui.notify` and `ui.refresh` (section 10, "Live") |
| `settings` | both | none | `get` a setting; `onChange` while the entry runs |
| `storage` | both | `storage` | `get`, `set`, `delete`, `keys`: the extension's own small store |
| `net` | both | `network`, `network.local` | `fetch`: the only way to the network |
| `host` | both | none | `info`: the API version, the side, and on the client the app |
| `secrets` | server | `secrets` | `get`, `set`, `delete`: sealed credentials |
| `providers` | server | `providers` | One registry for each kind (section 11) |
| `jobs` | server | `jobs` | `register` a declared job's handler; `start` a run |
| `routes` | server | `routes` | `register` a declared route's handler |
| `signIn` | server | `secrets` | `register` the declared sign-in's handler (below) |
| `library` | server | `library.read` | `getSong`, `getAlbum`, `getArtist`, `getPlaylist`, `getAlbumSongs`, `getPlaylistSongs`, `search` |
| `users` | server | `users.read` | `get`, `list` |
| `player` | client | `listening.read`, `player.control` | `getState`; `play`, `pause`, `next`, `previous`, `seek` |
| `queue` | client | `listening.read`, `player.control` | `get`; `add` |

Rules that hold for every call:

- **Registration gives back a disposable.** Every `on…` and every `register` returns an object with `dispose()`, which takes the listener or handler away. Everything is disposed for the extension when it is stopped.
- **Calls to the host answer with a promise.** Registration is the exception: it is immediate. Outside Songstress (a test with no stand-in host) every call throws at once, with the code `no-host`.
- **One member at a time.** On the server one extension serves every member, so a call that concerns one of them names them: `songstress.settings.get('token', { userId })`, `songstress.storage.set(key, value, { userId })`. In an app the member is the one signed in and is never named. A member's part of the store is the part their own client code sees.
- **Commands cross sides.** Client code may `execute` a command of the server entry and gets back the `value` its handler left: this is how the two halves of an extension talk. Server code has no `execute`: it calls its own functions. A handler may also leave an `action` for the app to carry out when a person ran the command.
- **Failure has a code.** A call that fails rejects with a `SongstressError` whose `code` is one of: `no-host` (the code is not running inside Songstress), `permission-denied`, `not-available` (this side, this app or this build cannot do it), `limit-exceeded` (a quota, a size, a rate or a deadline), `invalid` (a wrong argument, or something that does not exist), `failed`.
- **The network is the host's.** `net.fetch` sends the request from the server, server and client code alike (client code's goes by way of its server), and answers within the host's limits: 30 seconds unless `timeoutMs` or the call's own deadline is sooner, ten redirects, and an answer's body of at most 2.5 MiB. Both refusals are `limit-exceeded`: a request with no answer in time says `no answer in time`, and an answer too large says it is larger than its limit. The headers are sent as given. Each request carries `User-Agent: songstress-extension/<API version>` (the version `host.info()` gives) unless it names its own: a service that asks a client to say who it is (an app's name, its version and a way to reach its author) gets the extension's `User-Agent` as written. An answer's header names come back in lowercase, the values of a repeated header joined with `, `. A request that names its own `accept-encoding` gets the body as the source sent it, still packed (its `content-encoding` says how), and the 2.5 MiB counts the packed bytes; any other answer comes unpacked, and is counted unpacked.
- **The player is asked, not commanded.** `player` and `queue` requests are carried out as a tap on the app's own controls would be. Adding to the queue never touches what is playing.

`songstress/manifest` is apart from all this. It needs no host: it is the manifest's schema, its types and its validator, for tools.

### Helpers

`songstress/server` also exports helpers: functions of the SDK's own, which run in the extension and reach Songstress only through the API's members (`net.fetch` under `network`, `storage`, `providers.*.register`), so they need no permission those members do not. They stand in for what the server's sandbox lacks (`URL`, `atob`, `TextDecoder`, zlib) and for what every provider writes again. They are part of the API's surface and follow its version (section 14).

- **Reaching a source.** `fetchResponse(url, init)` is `net.fetch` tried a second time, 300 ms later, when the call failed with the code `failed` or without a code (no answer), or the source answered a 5xx. A 429 throws a `ProviderFailure` `rate-limited` with `retryAfterS` from its `Retry-After` (seconds, or a date), and is not tried again; two tries without an answer, or two 5xx, throw `unavailable`, whose message names the source's host and never its address, its query or an error's words; a refusal of the host's own (any other code, a deadline's `limit-exceeded` too: the call's time is spent) is thrown as it comes; any other status is answered. `fetchText` answers a 2xx's body and throws an `HttpStatusError` (its `status` and `url`) for any other status. `fetchJson` sends `accept: application/json` unless the request names an `accept` in any case, and throws `unavailable` for a body that is not JSON. `nullIfMissing(load, statuses)` answers `null` for an `HttpStatusError` of 404 or 410, or of the statuses given. `findInAnswer(url, find, init)` hands `find` the text of a 2xx answer; when the host refuses that answer as too large (a `limit-exceeded` that is not a deadline's), it asks again with `accept-encoding: gzip` in place of any the request named and `responseEncoding: 'base64'`, and hands `find` the unpacked text a block at a time, one character a byte, each block with the last 2048 characters of the one before, until `find` answers something other than `null`. A packed answer that does not unpack throws `unavailable`.
- **A value kept a while.** `new KeptValue(key)` keeps `{ value, until }` (`until` in milliseconds since 1970) in memory and under `key` in the extension's store: `get()` answers the value until `until`, else `null`; `set(value, until)` and `delete()` change both; `getOr(fetch)` answers the value or else what `fetch` brings, kept until the `until` it gives, and calls made while one `fetch` runs share it. A store that refuses (no `storage` permission) is passed over: the value is kept in memory only.
- **The one result that is the song.** `matchScore(wanted, offered)` is from 0 to 100. When both carry an ISRC it is 100 for the same one (in any case) and 0 for two different ones. Otherwise the title's likeness counts 50, the artist's 30, and the length's 20 when both have one (whole within 2 seconds, falling to nothing at 30 seconds off), else the album's 20 when both have one, else 10. Names are compared folded (`foldText`: NFKD, marks removed, lowercase, every run of anything but letters and digits one space, NFC): two that fold the same are alike 1, one held whole in the other 0.9, any other 1 less their edit distance over the longer one's length, and nothing past 300 characters. `bestMatch(wanted, candidates, read, min)` answers the first of the candidates that score highest, when that score is at least `min` (65 unless given), else `null`.
- **A catalogue.** `registerCatalog(id, catalog)` registers, under `id`, the `search` provider; a `lookup` provider with whichever of `track`, `album`, `artist` and `playlist` the catalogue has, and none when it has none of them; and a `links` provider when it has `resolve`. Each method is called on the catalogue itself. It answers one disposable that takes all of them back.
- **Text, addresses and bytes.** `htmlToText` (comments and tags out, `<br>` a space, references read, spaces closed up) and `unescapeHtml` (numeric references, and `&amp;`, `&lt;`, `&gt;`, `&quot;`, `&apos;`, `&nbsp;` as a space; any other name kept). `parseUrl` reads an absolute http or https address and nothing else, none with a user or a password; `urlParam` answers the first parameter of the name, decoded, or `""`; `resolveUrl` resolves a reference against an address as a browser does; `queryString` writes each parameter encoded and leaves out `undefined` and `""`. `base64Bytes` reads either alphabet, its padding optional, past anything else; `utf8Text` reads UTF-8, U+FFFD for what is not; `base64Text` is the two together; `gunzip` unpacks one gzip member of at most 24 MiB, without checking its CRC.

### Signing in

The admin starts a declared sign-in (section 5) in Songstress, signs in on the service's own page, and is sent back. The server entry registers the one handler that does the service's part:

```ts
import { ProviderFailure, songstress } from 'songstress/server'

const service = 'https://tunelog.example/oauth'

songstress.signIn.register({
  // Where the admin signs in. The service sends them back to redirectUrl, with state as it was.
  start({ redirectUrl, state }) {
    const back = `redirect_uri=${encodeURIComponent(redirectUrl)}&state=${encodeURIComponent(state)}`
    return { url: `${service}/authorize?response_type=code&client_id=songstress&${back}` }
  },
  // What came back, traded for the account's token, which stays in secrets.
  async finish({ url, redirectUrl }) {
    const code = /[?&]code=([^&#]+)/.exec(url)?.[1]
    if (!code) throw new ProviderFailure('sign-in-required', { message: 'Tunelog sent no code back.' })
    const body = `grant_type=authorization_code&code=${code}&redirect_uri=${encodeURIComponent(redirectUrl)}`
    const headers = { 'content-type': 'application/x-www-form-urlencoded' }
    const answer = await songstress.net.fetch(`${service}/token`, { method: 'POST', headers, body })
    if (answer.status !== 200) throw new ProviderFailure('unavailable')
    const { token, name } = JSON.parse(answer.body)
    await songstress.secrets.set('token', token)
    return { account: name }
  },
  async signOut() {
    await songstress.secrets.delete('token')
  },
})
```

- **`start`** is handed `redirectUrl`, this server's own address for coming back (the redirect address to register with the service), and `state`, a one-time value the service must hand back unchanged. It answers the `url` of the service's page: an http or https address, with both in it as the service asks for them. What `finish` will need (a code verifier) goes in `songstress.secrets`: another instance of the entry may run it.
- **`finish`** is handed the `url` the admin came back on, whole, with what the service added to it, and `redirectUrl` again for a service that asks for it twice. It keeps the account's tokens with `songstress.secrets` and answers the `account`: the name the admin reads beside "Signed in as".
- **`signOut`** is optional. It forgets the tokens, and tells the service when it has a way to. Songstress forgets the account whether it runs, fails or is not there.

**Each member's own account.** A sign-in of scope `user` is the same two halves, started by each member for themselves from their own page of the extension (Settings › Extensions; an admin signs in there too, as a member). `start`, `finish` and `signOut` are each handed that member's `userId`, and the handler keeps what it is given as theirs:

```ts
  async finish({ url, redirectUrl, userId }) {
    // … the code traded for a token, as above
    await songstress.secrets.set('token', token, { userId })
    return { account: name }
  },
  async signOut({ userId }) {
    await songstress.secrets.delete('token', { userId })
  },
```

Each member has a sign-in of their own: one starting, finishing or signing out never touches another's, and no admin signs a member in or out. The extension's other code reads a member's token with the same `{ userId }` (a `scrobble` provider is handed the member it reports for), and throws `sign-in-required` for a member who has none.

Songstress finishes only the sign-in whose `state` came back, once, within ten minutes of its start, and keeps the account's name and nothing else: no token reaches it or an app. A server with no public address set cannot be sent back to, and refuses the start. Where the service's page cannot reach the server all the same, the admin pastes the address they landed on, and `finish` is handed that. A half that cannot be done throws a `ProviderFailure` (section 11); the admin is told the sign-in did not go through, and the reason is in the extension's log. An extension's other code reads the tokens where the handler kept them, and throws `sign-in-required` while there are none.

## 10. Declared interface

An extension's interface fits Songstress because Songstress draws it. As in VS Code, an extension says what it means: a page, a list, a tree, a choice to make, a notice, a status in the player. Each app draws it with its own controls in its own places: the web and desktop apps in their own design, the phones natively. What it says is JSON. What happens on a tap is JSON too: an action, which the app carries out. An extension never sets a colour, never reaches the app's own screens, and never shows anything without its mark.

This section has the places (where), the components (what), the actions (what a tap does, and what it asks), conditions (when), and how an extension has its interface drawn again.

### Places

| Place | Declared in | Web and desktop | Phones | Drawn from |
|---|---|---|---|---|
| A page | `pages` | The main area, and an entry in the sidebar with `sidebar` | A page of its own, and an entry in the Library tab's "Extensions" group with `sidebar` | Its renderer's screen |
| A sheet | A `navigate` action with `present: "sheet"` | A page over the screen it came from | A sheet | The page's renderer |
| A panel | `panels` | A section of Songstress's own screen, at its `location` | The same | Its renderer's blocks |
| A status item | `status` | The player bar | The full player (never the small player over the tabs) | Its renderer's status |
| A menu item | `menus` | The menu at its location | One "Extensions" submenu in that menu | A declared command |
| The settings form | `settings`, `menus["settings/actions"]` | The extension's own page | The extension's own page in Settings | The manifest |
| A notice | A `notify` action, `songstress.ui.notify` | Over the app, until it is closed | The same | The notice |
| A view | `views` | A tab of the browser (web), the system's browser (desktop) | The in-app browser | The extension's own HTML |

A renderer is a function its entry registers under the declared id, in the entry the manifest names in `render`: `songstress.ui.pages.register(id, render)`, `songstress.ui.panels.register(id, render)`, `songstress.ui.status.register(id, render)`. It is told who is looking, in which app (`client`), and what the screen shows: the song, the artist or the album, handed over whole to an extension granted `library.read` and left out for any other (a playlist's id alone, as playlists themselves are not read for extensions yet).

### Screens

What a whole page is:

| `type` | What it is |
|---|---|
| `list` | Sections of rows, with an optional search field, an empty state and more rows on demand |
| `grid` | Sections of cards, with the same |
| `tree` | Nodes that hold nodes: folders, groups, anything that holds more of itself; with an optional search field and an empty state |
| `detail` | Blocks, read from top to bottom |
| `form` | Sections of fields and one button that hands them to a command |

**Trees.** A `tree` holds `nodes`: each a `node` of the extension's own (a row with a title, a subtitle, an icon or an image, a badge, an action on a tap and a menu) or a library `song`. A node holds what is under it in one of two ways: its `children`, given now, or `expandable`, which says it has some and is asked for them when the person opens it: the page is rendered again with the node's id in `RenderContext.node`, and the answer's `nodes` are what is under it. The web and desktop apps open a node in place, under it (`open` opens it at first). The phones open a node that holds others as a page of its own, titled with the node's title, as Files does.

**Rows and cards.** `row` and `card` are the extension's own: a title, a subtitle, an icon or an image, an action on a tap, a menu. `song`, `album`, `artist` and `playlist` are Songstress's own, named by library id and drawn exactly as Songstress draws them elsewhere, with their own menus and their own behaviour.

**Blocks**, what a `detail` page, a section and a panel are built from: `stack`, `section`, `text`, `icon`, `image`, `badge`, `progress`, `banner`, `divider`, `spacer`, `collapsible`, `button`, `menu`, `shelf`, and the four library types above.

**Fields**, what a `form` holds: `text-field`, `switch`, `checkbox`, `slider`, `picker`, `date-picker`. The app keeps what is typed until the form is submitted; the command then receives the values by field name.

### Actions

What a tap does:

| `type` | What it does |
|---|---|
| `invoke` | Runs one of the extension's commands |
| `navigate` | Opens one of the extension's pages or views, or Songstress's page for something in the library; as a page or as a sheet |
| `play` | Plays library songs now, as a tap on a song does |
| `queue` | Adds library songs to the queue, at its end or next |
| `openUrl` | Opens an http or https address in the browser |
| `copy` | Copies text |
| `share` | Opens the device's share sheet |
| `toast` | Shows a short message that goes away by itself |
| `notify` | Shows a notice that stays until it is closed, with up to two buttons |
| `confirm` | Asks first, then carries out another action |
| `pick` | Asks the person to choose, then hands their choice to a command |
| `input` | Asks the person for a line of text, then hands it to a command |
| `refresh` | Renders the page, panel or status item it came from again |

A command answers with an action for the app to carry out (`CommandOutcome.action`), so an extension leads a person through steps that each run on its own: a pick hands its answer to a command, which answers with an input, whose answer goes to another command, which answers with a notice.

### Asking

`pick`, `input` and `confirm` ask the person something in Songstress's own way, then carry on with their answer. Nothing runs when the person closes what was asked.

- **`pick`**, Songstress's picker: a `title`, the `items` to choose from (each an `id` and a `title`, and optionally a `subtitle`, an `icon` or an `image`), a search field over them with an optional `placeholder`, and `many` for a choice of several (`picked` marks those chosen at first). Then the `command` runs with the action's `input`, and `CommandContext.answer` holds the `id` chosen, or the ids for a pick of several. Up to 100 items: a pick of more is no action at all. On the web and the desktop it is a dialog with its search field on top, as a command palette is; on a phone, a sheet.
- **`input`**, one field: a `title`, a `prompt` under it, a `placeholder`, the `value` it holds at first, `multiline`, a `maxLength` (up to 2000), `required` (it is not sent empty), and `submit`, the word on its button. Then the `command` runs with `input`, and `answer` is the text. Never a password: a secret is a setting.
- **`confirm`** asks yes or no, then carries out its `action`.

The command's `CommandContext.source` says which asked: `pick` or `input`. A question may lead to one more question and no further: a confirm, a pick, an input and a notice each count as one, and a third in a row is no action at all.

### Notices

A `toast` is a short message that goes away by itself: "Copied". A notice is what an extension has to tell, that stays until the person closes it: a `title`, a `message`, a `tone` (`info`, `success`, `warning` or `danger`; left out, `info`), and up to two `buttons`, each a `title` and an `action`. The app shows it with the extension's name.

```ts
return { action: { type: 'notify', title: 'Import finished', message: '1,204 plays came in.', tone: 'success',
  buttons: [{ title: 'Open', action: { type: 'navigate', to: { page: 'recent' } } }] } }
```

A notice is an action, so a tap or a command's answer shows one. Code may also tell one without being asked, while the member has an app open, with `songstress.ui.notify(notice)`: the server entry names the member (`songstress.ui.notify(notice, { userId })`) and every app they have open shows it; client code shows it in its own app. Nothing is kept for an app that is closed, so what must not be missed belongs on a page. At most ten an hour for one member: more reject with `limit-exceeded`. An app may let a person silence an extension's notices.

### Status items

A status item (section 5) is rendered for the song playing: when the player shows it, when the song changes, and when it is refreshed. Its renderer answers what it shows, or `null` to show nothing now:

| Field | What it holds |
|---|---|
| `text` | A few words, up to 24 characters. Left out, the icon alone, which the declared `title` names for people who do not see it |
| `icon` | From Songstress's icon set |
| `tone` | Its colour, by meaning |
| `tooltip` | A line more, shown on hover or a long press |
| `progress` | From 0 to 1: how far some work of the extension's is |
| `busy` | Work is going on, with no telling how far |
| `action` | What a tap does |

The apps show as many status items as their player has room for, in the order of the extensions' names. On a phone the rest are a swipe along the line; on the web and the desktop, a tap away under the player bar's "More from extensions", and the full player shows them all.

### Live

What an extension draws is rendered when it is shown. It is rendered again when the person pulls to refresh, when a `refresh` action asks, and when the extension's code asks with `songstress.ui.refresh(target)`, where `target` is `{ page }`, `{ panel }` or `{ status }` with the id. The server entry names the member it is for (`songstress.ui.refresh({ status: 'sent' }, { userId })`), and each of their open apps renders it again where it is showing. Asked more often than once every five seconds for one target, an app renders it once.

### Conditions

A menu item, a page's navigation entry, a panel and a status item may name a `when`: a condition the app holds it to, so it shows only while the condition holds, as VS Code's `when` clauses do. A condition is up to 200 characters:

- a key, alone (true when its value is true, a text that is not empty, or a number that is not 0) or compared to a value with `==` or `!=`;
- a value is `'text'` in single quotes, a number, `true` or `false`;
- `!` turns a condition round, `&&` and `||` join two, and parentheses group them, nested at most eight deep.

| Key | Its value | Known in |
|---|---|---|
| `platform` | `web`, `desktop`, `ios` or `android` | Every place |
| `clientCode`, `views` | The app's `capabilities` (section 6) | Every place |
| `admin` | The member is the server's admin | Every place |
| `signedIn` | The extension's sign-in has an account (`contributes.signIn`): the server's, or with scope `user` the viewing member's own | Every place |
| `playing` | This device's player is playing | Every place |
| `setting.<key>` | The value of one of the extension's settings, as this member and this device have it (never a secret) | Every place |
| `favorite` | The song, album or artist the menu was opened on is one of the member's favourites | The menus of a song, an album, an artist, the queue and the player |

```json
{ "command": "send-again", "when": "signedIn && setting.mode == 'manual' && platform != 'web'" }
```

The validator refuses a condition no app can read (`WHEN_INVALID`), and a key no app knows where it stands, a setting the manifest does not declare or a secret one, `signedIn` with no sign-in, and a `platform` that is none of the four (`WHEN_KEY_UNKNOWN`). An app that cannot read a condition (a key newer than it, say) leaves the item out.

### Views

A view is the extension's own HTML file, for what Songstress's components cannot draw: a visualiser, a game, a chart of its own. An app opens it in the browser, apart from the app: a tab of the browser on the web, the system's browser on the desktop, the in-app browser on a phone. It gets no `songstress` API and nothing of the app's: no storage, no session, no player. It is served by the member's own server at an address of its own that expires, and is handed the `params` it was opened with as the address's query. Any data it needs it fetches itself, as any web page does.

A view never runs inside an app: there no browser can keep a page's script from the network (WebRTC goes round every policy). What must react to the app, or work offline, belongs in the client entry and a declared page.

### What a tree cannot do

By design:

- run script, expressions or timers in the app: a tree is data;
- choose a colour, a font, a size in pixels or a position: colour is said by meaning (`tone`: `default`, `muted`, `accent`, `success`, `warning`, `danger`, `info`) and the theme decides the rest, so an extension's interface takes the theme a person chose;
- load an image from the device: a picture is a cover from the library, or an address the app fetches through the server;
- ask for a password: a secret is a setting;
- draw outside its places, replace a part of Songstress, add a tab, or appear without the extension's mark;
- grow without bound: the apps cap a tree's size, depth and number of rows and how often it is redrawn, and do not draw a tree over a cap.

An app says which version of this vocabulary it draws (`ClientInfo.ui`; this document describes version 2, which added trees, status items, notices, `pick` and `input`). A node it does not know is shown as "needs a newer app", and an action it does not know does nothing: a renderer reads `client.ui` and answers what that app draws.

## 11. Providers

A provider is declared under `contributes.providers.<kind>` and registered, in the server entry and under the same id, with `songstress.providers.<kind>.register(id, provider)`. It needs the permission `providers`; a `scrobble` provider, which is handed members' plays, needs `listening.read` too and hears only the members who granted it.

Every source has an `id` and may have a `name` (as people read it; left out, the extension's name). The same id under several kinds is one source, with one name and one group (`PROVIDER_MISMATCH`).

| Kind | The manifest also says | Code answers |
|---|---|---|
| `search` | `types`: what a search finds, of `track`, `album`, `artist`, `playlist`; optionally `group` | `search(query)`: results of each type asked for |
| `lookup` | `types`: what it opens by id; optionally `group` | `track(id)`, `album(id)`, `artist(id)`, `playlist(id)`, for each type listed |
| `links` | `patterns`: the links it reads; optionally `group` | `resolve(url)`: what the link is |
| `lyrics` | | `find(song)`: synced or plain lines, "instrumental" or nothing |
| `metadata` | `supports`: `discography`, `enrich`; optionally `group` | `releases`, `topTracks`, `releaseTracks` for a discography; `enrich(track)` for a track's missing facts |
| `artwork` | `supports`: `artist-photo`, `album-cover` | `artistPhoto(artist)`, `albumCover(album)` |
| `artistInfo` | `supports`: `biography`, `similar` | `biography(artist)`: who they are, in words; `similarArtists(artist, limit)`: the artists like them |
| `scrobble` | | `scrobble(play)`, and optionally `nowPlaying(play)` |
| `recommend` | `modes`: `track`, `artist`, `context` | `similarTracks`, `artistRadio`, `contextMix` |
| `play` | | `resolve(track)`: where one whole audio file is |
| `download` | `qualities`: `id`, `title` and optionally `lossless`, best first | `check(track)`, then `locate({ id, quality })`: where the audio is |

- **`lookup` and `metadata`.** A `lookup` source's artists and albums give their discographies as well: an artist's `albums` and `topTracks`, an album's `tracks`. Declare `metadata` with `discography` for a source that answers discographies without pages of its own to open, and with `enrich` for one that fills a track's missing facts.
- **`artistInfo`** is what an artist's page says about them. A biography is plain text, its paragraphs apart by a line break, of which the first 4000 characters are kept; it may carry the page it is from (`url`, http or https, at most 2000 characters) and its language (`language`, a BCP 47 tag such as `en` or `pt-BR`). Similar artists come most alike first, 50 at most, each named by the source's own id; Songstress finds them in the library by name and by the catalogue ids they carry. Both are asked by the server for itself, with what the library holds under the artist's name, and kept: `null` is the answer of a source that cannot tell the artist from a namesake. The kind came with API 0.1.6, so a manifest that has one asks for it: `"songstress": "^0.1.6"`.
- **`group`** names the catalogue of Songstress's own that the source reads too: `musicbrainz`, `spotify`, `deezer`, `tidal`, `itunes` or `ytmusic`. Its results are then merged with that catalogue's and it speaks that catalogue's ids. Left out, the source is a group of its own.
- **A link pattern** is a host with an optional path that a link must begin with (`soundcloud.com`, `example.com/album/`), or an app link's scheme (`spotify:`). A host also takes links to the hosts under it. The longest pattern that fits a link wins. `http:` and `https:` alone are refused (`LINK_PATTERN_TOO_BROAD`).
- **Beside, never instead.** A source joins switched off or last, the admin's order decides, and one that fails never fails the rest. Lyrics from a provider never replace the lyrics a song's own file carries. Its results carry the extension's mark, so people can tell them from Songstress's own.
- **Lyrics, as they are shown.** A lyrics answer is rebuilt before anyone sees it. At most 2000 lines are kept. Each line's `text` is one line of at most 500 characters: line breaks and tabs become spaces, control characters go, and runs of white space close up. An empty line stays, as a pause. A `startS` below 0 or past seven days is dropped. The lines are synced only when every one has its `startS` and none comes before the line above it (equal times may follow each other); otherwise every time is dropped and the lyrics are shown as plain text, since the server never sorts them. `synced` is worked out again from the lines. There is no word-by-word timing. A `found` answer with no lines is read as `none`.
- **When lyrics are asked, and what is kept.** A lyrics source is never asked while a song plays. It is asked once an admin adds it to the server's lyrics order (beside Songstress's own lyrics sources, kept with the library's enrichment), by the server's nightly library pass, about the tracks that have no synced lyrics yet, those with plain lyrics included: one track at a time, at most 1000 a night, each source in that order until one answers synced lyrics or `instrumental` (a plain answer is kept while the rest are asked). A `find` has 10 seconds. A track with plain lyrics is asked because one of Songstress's own sources may match it exactly enough to replace them with synced ones; an extension's answer is never that sure, so its lyrics are written only to a track that has none at all, synced as LRC or else as plain text, and never replace lyrics a track already has. No answer is cached as such: the track keeps its last outcome and is asked about again only once that has rested (`none` 30 days, then 180; `instrumental` a year; plain lyrics 30 days, doubling up to 180; a failure a day, doubling up to 30). After ten failures in a row the night's pass pauses five minutes, then goes on; a `rate-limited` failure's `retryAfterS` does not lengthen that pause, so a source that is rate-limited keeps its own pace.
- **`play` and `download`** are switched off until the admin turns each on. An extension that has either may be listed in the Marketplace like any other. A `play` provider plays what the `search` provider of the same id found (`PROVIDER_PLAY_NEEDS_SEARCH`). Both answer where the audio is, as addresses; Songstress fetches it, under the extension's own `network` permission on every hop, and joins segments itself. Nothing is decrypted.
- **Failure.** "Nothing found" is an empty list or `null`. A failure Songstress knows what to do about is thrown as a `ProviderFailure` with one of four codes: `rate-limited` (with `retryAfterS`), `sign-in-required`, `not-configured`, `unavailable`. Anything else thrown counts as the provider being broken for now.

## 12. Themes

A theme sets the colours the apps draw. Songstress's own look is the only one an app carries: every other theme is an extension's, which the server's admin installs, and each member picks from the themes installed there. A theme may set every colour token below, Songstress Red's place included. It sets no more than that: what is Songstress's own keeps its look whatever the theme ("What no theme reaches", below).

### Looks

A theme has a dark look, a light one or both, as its `appearance` says (section 5). A phone in dark mode shows a dark look and one in light mode a light look; Android shows a theme's dark look when it has one, else its light one. The web and desktop apps show the appearance their person picks (dark, light, or the device's own), dark until they pick one. A person may take the dark look of one theme and the light look of another, and each app keeps what they took on that device.

A look is an object of these fields, every one optional, though a look holds at least one:

- `colors`: the colour tokens below, by name, each a colour (below, "Colours").
- `seed`: one colour the look grows from where it names no other. The seed is the accent, and the stage and the text take a little of its hue (in Material's HCT colour space: tones 6 and 92 in a dark look, 98 and 10 in a light one). A look of one seed is a whole theme.
- `glow`: one to three colours for the ambient light behind the stage of the web and desktop apps. Without it, the accent.

A dark look and a light look are written alike.

### The tokens

| Token | May be translucent | Where it shows |
|---|---|---|
| `background` | | The stage behind every screen: lists, a tab's root, the window |
| `surface` | | Grouped rows, cards and sheets on the stage; Android's tab bar |
| `surface.raised` | | What sits on a surface: menus, popovers, the disc of a pull to refresh |
| `surface.hover` | yes | The wash under a pressed or hovered row, and behind secondary controls |
| `sidebar` | | The sidebar of the web and desktop apps |
| `border` | yes | Hairlines between rows, and around cards and fields |
| `text` | | Words: titles, rows, body copy |
| `text.muted` | | The second voice: an artist under a title, a caption |
| `text.faint` | | Placeholders, chevrons, and captions that repeat what is beside them |
| `accent` | | The theme's colour in Songstress Red's place: icons, active states, progress, links, the tab bar's tint, focus rings |
| `accent.fill` | | A filled accent that carries a label: Play, a primary button, a selected segment, a badge |
| `accent.fill.pressed` | | A filled accent under a press or the pointer, and the far end of Play's sweep |
| `accent.onFill` | | The label on a filled accent, at rest and pressed |
| `success` | | Lossless audio, done, connected |
| `warning` | | Lossy audio, something to look at |
| `danger` | | Delete, Sign Out, errors, a menu's destructive items |
| `info` | | Work in progress: running, importing |

The tokens are few on purpose: each is a role many parts of the apps share, never one control's. There is no token for one button's border or one row's hover; a part of the apps takes its colours from these roles, and a new token comes only when a role the apps draw has none (see "Versions").

### Colours

A colour is written in any of these forms, as CSS writes them:

- hex: `#RGB`, `#RGBA`, `#RRGGBB` or `#RRGGBBAA`, in either case;
- `rgb()` and `rgba()`, the two alike: three channels, each 0 to 255 or 0% to 100%, and an optional alpha, between commas (`rgb(108, 182, 255)`, `rgba(108, 182, 255, 0.5)`; the three channels of one kind) or between spaces with the alpha after a slash (`rgb(108 182 255 / 50%)`);
- `hsl()` and `hsla()`, the two alike: a hue in degrees or as an angle (`deg`, `grad`, `rad`, `turn`), a saturation and a lightness from 0% to 100%, and an optional alpha, between commas or between spaces as `rgb()`'s are (between spaces, a saturation or a lightness may be a plain number of percent).

An alpha is 0 to 1 or 0% to 100%. A function's name is in lower case; a colour is at most 64 characters. A name (`red`, `transparent`), `currentColor`, `var()`, a gradient and the other colour spaces (`oklch()` and its kind) are not colours a theme writes.

Each colour is read into one form, `#rrggbb`, or `#rrggbbaa` when its alpha is below 1, in lower case, every part rounded to the nearest byte; it is all an app's engine, the rules below and the server ever see, and the server hands the apps every colour in it. Only `border` and `surface.hover` may be translucent: an alpha below 1 anywhere else, the seed and the glow included, is refused (`THEME_COLOR_ALPHA`, naming the token), as a colour in no form is (`THEME_COLOR`). `songstress/theme` reads them as the apps do: `parseColor` a colour, `normalizeLook` a whole look. The forms and their answers are `corpus/colors.json`.

### What a look leaves out

An app fills every token a look leaves out. It derives it from the look's own colours where it can, so a theme's few colours keep the apps' order of surfaces and voices:

- the seed, for the accent and the tint of the stage and the text;
- `surface` from the background with 8% of the text in it, and `sidebar` as the surface;
- `surface.raised` from the surface with 6% of the text, `border` from the surface with 12%, and `surface.hover` as the text at 8%;
- `text.muted` and `text.faint` from the text, 30% and 50% of the way to the background;
- `accent.fill` from the accent as written; `accent.onFill` as white or near black, whichever reads; and `accent.fill.pressed` from the fill moved 16% away from its label (toward black under a light label, toward white under a dark one), so the label reads better pressed than at rest, and at 5:1 or more.

Anything else it takes from Songstress's own look of the same appearance. A colour the app fills in is moved to the nearest tone of it that meets the rules below; a colour the look writes is never moved to fill the look in (where the apps write words in a voice, below, they show it at a tone that reads). So a look of three colours is a whole theme.

### What no theme reaches

These keep Songstress's own look whatever theme is showing, Songstress Red included, and no look has a field for them:

- the logo and the app's icon, and the brand art beside the sign-in form;
- Wrapped's stories and the share cards;
- the pages a public link opens: a shared playlist or song, a public Wrapped;
- the first run, and its art;
- supporters' medals and their tiers' art.

The full player, and a page's header over its artwork, are themed like every other screen: they are drawn from the tokens of the look showing, light when that look is light. The stage under the artwork is `background`, the words are `text`, `text.muted` and `text.faint`, the controls `accent`, and Play `accent.fill` with `accent.onFill` on it. Their words lie on a floor, the look's `background` at 90% over the artwork's blur, so a cover shows through by 10% at most, and the rules below hold them there over the darkest artwork and the lightest. Under Songstress's own look the player stays as it is, dark in either appearance: that is Songstress's own design.

No theme reaches what the system draws or the app's binary carries: the splash screen, widgets, the watch and car screens, the system's own menus, alerts and pickers; nor pictures (covers, avatars).

### Colours that follow the tokens

These are never written: each app makes them from the tokens.

- An accent label on a grouped surface: the accent where it reads there (4.5:1), else the text.
- Words in a second or third voice or a status colour (`text.muted`, `text.faint`, `success`, `warning`, `danger`, `info`): the look's colour where words in it read at 4.5:1 on `background`, `surface` and `surface.raised`, else the nearest tone of it that does, its hue and chroma kept. The rules below hold these colours to less (a placeholder, a glyph); words never read by less. `text`, the grounds and the accent are never moved, and Songstress's own looks read as they are.
- Android's touch ripples, the text at 10%, and the tab bar's selected mark, the accent at 16%.
- Android's snackbars: a light surface made from the text and the background, with the action in the first of `accent.fill.pressed`, `accent.fill` and `accent` that reads on it.
- Android's own controls (switches, segmented buttons): Material 3's roles, the primary ones from the accent and the rest from the neutrals.
- The disc behind a reaction's emoji: the dark look's text at 80%.
- On the web and the desktop: the glass of a card, the surface at 78% over the stage; the glass of the chrome (the sidebar, the player bar, sheets), the sidebar at 86%; washes and hairlines the apps draw in a touch of white on Songstress's own dark look, in a touch of the text; the chrome's active item (the sidebar's page), the accent's words on a tint of the accent up to 15%, as strong as those words still read on it, else the text on a 10% tint; focus rings and the charts' heat, from the accent.

### The rules

A look is shown only if it meets these, once it is filled. Contrast is WCAG 2's ratio.

- The background's relative luminance is under 0.10 in a dark look and over 0.55 in a light one, so the system's bars read on it.
- `text` on `background`, `surface`, `surface.raised` and `sidebar`: 4.5:1.
- `text.muted` on `background` and `surface`: 4.5:1.
- `text.faint` on `background`: 3:1. On `surface`: 3:1, and 2.9:1 in a light look.
- `accent` on `background`: 4.5:1. On `surface`: 3:1.
- `success` and `warning` on `background` and `surface`: 4.5:1, and 1.9:1 in a light look (iOS's own light green and orange).
- `danger` and `info` on `background` and `surface`: 4.5:1.
- `accent.onFill` on `accent.fill` and on `accent.fill.pressed`: 4.5:1.
- On the full player's floor, over black artwork and over white: `text` and `text.muted` 4.5:1, `accent` 3:1.

4.5:1 is a floor, not a target: words read best nearer 7:1, and the official themes aim there wherever their palette allows. The rules are the apps' own. Each app holds a theme to them before it applies one: a look that fails is not shown, and the theme already showing stays. `songstress check` runs the apps' code and reports a look that fails as `THEME_CONTRAST` or `THEME_LUMINANCE`, with the ratio it reaches, so the official list never carries one. The manifest's validator holds a theme to its shape and each colour to its form and its place (`THEME_COLOR`, `THEME_COLOR_ALPHA`) wherever it runs, on a server that installs one too, and a server holds each theme file to the same when it installs the package (section 3).

### A theme file

A theme's looks may live in a file of their own, which the theme names by its `path`: a JSON object holding `dark`, `light` or both, written as the manifest would write them, and optionally its schema's address as `$schema` (`https://songstress.app/schema/theme/v1.json`; `schema/theme.v1.json` in this package). It is at most 16 KiB, read as strictly as the manifest is (section 13), and holds exactly the looks its theme's `appearance` names.

```json
{
  "$schema": "https://songstress.app/schema/theme/v1.json",
  "dark": { "colors": { "background": "#2e3440", "text": "#eceff4", "accent": "#88c0d0", "border": "rgb(236 239 244 / 12%)" } },
  "light": { "colors": { "background": "#eceff4", "text": "#2e3440", "accent": "hsl(212, 42%, 40%)" } }
}
```

`parseThemeFile`, in `songstress/manifest`, reads one for a tool, and answers its looks as written; `normalizeLook` puts each in its one form.

### Versions

The tokens are version 1, the theme file's schema with them. A token is never renamed and never changes its meaning. A new one comes with a new minor version of the API and a default that follows from the others: a manifest that writes it says so in `engines.songstress`, and an older server refuses it rather than misread it. Themes as this section has them came with API 0.1.3, so a manifest that has one asks for it: `"songstress": "^0.1.3"`.

## 13. Validation

One validator checks a manifest everywhere: in a tool, when a server installs, when a listing is submitted. It works in four stages, and a stage runs only when the ones before found nothing.

1. **The reader.** The size, the depth, that the text is UTF-8 JSON, that no object names a key twice.
2. **The schema.** The shape `schema/extension.v1.json` describes.
3. **The rules.** What a schema cannot say.
4. **The listing rules**, only for the official list.

There are two profiles: `install`, what a server takes from a link or a file, and `listing`, what the official list asks on top. A server also knows where a manifest came from, which the validator is not told: from a GitHub link or a file it refuses the publisher `songstress` with `ID_RESERVED` (section 4).

Each problem has a stable code, a [JSON Pointer](https://www.rfc-editor.org/rfc/rfc6901) to where it is, and a sentence. The code and the pointer are the contract, the same for every implementation; the sentence is for a person and may be reworded. `corpus/README.md` says how another parser is held to the same answers.

```ts
import { parseManifest } from 'songstress/manifest'

const result = parseManifest(bytes, { profile: 'listing' })
if (!result.valid) for (const issue of result.issues) console.log(issue.code, issue.pointer, issue.message)
```

### The reader's codes

| Code | Means |
|---|---|
| `MANIFEST_TOO_LARGE` | The manifest is larger than 256 KiB |
| `MANIFEST_TOO_DEEP` | Objects and lists are nested more than 16 deep |
| `JSON_INVALID` | The text is not UTF-8 JSON, or holds a number too large to read, or a damaged character (half a surrogate pair, or U+FFFD) |
| `JSON_DUPLICATE_KEY` | An object names a key twice. The pointer names the key |
| `THEME_FILE_TOO_LARGE` | A theme file is larger than 16 KiB. A theme file is read by the same four checks, its own size first |

### The schema's codes

One for each kind of thing the schema asks. For a missing or an unknown field the pointer names the field itself.

| Code | Means |
|---|---|
| `SCHEMA_TYPE` | A value is of the wrong type |
| `SCHEMA_REQUIRED` | A required field is missing |
| `SCHEMA_UNKNOWN_PROPERTY` | A field the manifest does not have |
| `SCHEMA_ENUM` | A value is not one of those allowed |
| `SCHEMA_CONST` | A value is not the one value allowed |
| `SCHEMA_PATTERN` | Text is not in the form asked |
| `SCHEMA_LENGTH` | Text is too short or too long |
| `SCHEMA_RANGE` | A number is too small or too large |
| `SCHEMA_ITEM_COUNT` | A list has too few or too many items |
| `SCHEMA_DUPLICATE_ITEM` | A list says the same thing twice. The pointer names the list |
| `SCHEMA_PROPERTY_COUNT` | An object that must hold something is empty |

### The rules' codes

| Code | Means |
|---|---|
| `TEXT_UNSAFE` | Text holds a control, invisible or direction-changing character |
| `ID_RESERVED` | The id's publisher is a name Songstress keeps for its API, or `songstress` from anywhere but the official list |
| `VERSION_INVALID` | `version` is not a semantic version |
| `ENGINE_RANGE_INVALID` | `engines.songstress` is not a range of section 14 |
| `ENGINE_UNSUPPORTED` | `engines.songstress` leaves out the API version of the host that is checking |
| `PATH_OUTSIDE_PACKAGE` | A path is not a plain path inside the package |
| `BANNER_NOT_16_9` | The banner's stated size is not 16:9 |
| `ENTRY_REQUIRED` | Something needs code in an entry the manifest does not have |
| `ENTRY_UNUSED` | An entry that nothing in the manifest would ever start |
| `PERMISSION_REQUIRED` | Something needs a permission the manifest does not ask for |
| `PERMISSION_UNUSED` | A permission nothing in the manifest could use |
| `NETWORK_LOCAL_NOT_PRIVATE` | A `network.local` target outside the private and loopback ranges |
| `DUPLICATE_ID` | Two contributions of a kind share an id, two settings a key, or a menu names one command twice |
| `MENU_COMMAND_UNKNOWN` | A menu item names a command that is not declared |
| `ROUTE_DUPLICATE` | Two routes answer the same method and path |
| `LINK_PATTERN_TOO_BROAD` | A link pattern would claim every web link |
| `PROVIDER_PLAY_NEEDS_SEARCH` | A play provider with no search provider of the same id |
| `PROVIDER_MISMATCH` | One source with two names or two groups |
| `SETTING_DEFAULT_INVALID` | A default its own setting would refuse |
| `SETTING_RANGE_INVALID` | A minimum above its maximum |
| `SETTING_OPTION_DUPLICATE` | Two options with the same value |
| `WHEN_INVALID` | A `when` condition is not in the grammar every app reads (section 10) |
| `WHEN_KEY_UNKNOWN` | A `when` condition names a key no app knows where it stands, a setting it may not read, or a value its key never has |
| `THEME_LOOKS` | A theme's looks are not the ones its `appearance` names, or are written both in the manifest and in its file |
| `THEME_COLOR` | A colour of a look is not one of a theme's forms, or a part of it is out of its range (section 12, "Colours") |
| `THEME_COLOR_ALPHA` | A colour of a look is translucent where its place is opaque: anywhere but `border` and `surface.hover` |

### The listing's codes

| Code | Means |
|---|---|
| `LISTING_FIELD_REQUIRED` | One of `license`, `repository`, `categories`, `icon`, `screenshots`, `about` is missing |
| `LISTING_LICENSE` | The licence is not one of: `MIT`, `Apache-2.0`, `BSD-2-Clause`, `BSD-3-Clause`, `ISC`, `0BSD`, `MPL-2.0`, `LGPL-3.0-only`, `LGPL-3.0-or-later`, `GPL-3.0-only`, `GPL-3.0-or-later` |
| `LISTING_REPOSITORY` | `repository` is not `https://github.com/owner/name` |
| `LISTING_SCREENSHOTS` | Fewer than three screenshots |

## 14. Versions and stability

Three numbers are in play.

**`manifestVersion`** is the version of the manifest's format, `1`. A change that an older reader would misread makes a new format with a new schema at a new address; `1` stays readable.

**`version`** is the extension's own. It is a semantic version, compared as semver.org says: a prerelease comes before its release, and build metadata is ignored.

**`engines.songstress`** is held against the version of the extension API, which is the version of this package (`API_VERSION`). The server, the desktop app and the phone apps share no release number, so none of them could be the yardstick. A range is one of:

| Range | Takes |
|---|---|
| `^1.2.0` | From 1.2.0 up to, not including, 2.0.0 and its prereleases. For 0.x: `^0.2.0` stops before 0.3.0, `^0.0.3` before 0.0.4 |
| `~1.2.0` | From 1.2.0 up to, not including, 1.3.0 and its prereleases |
| `>=1.2.0` | 1.2.0 and everything after it |
| `>=1.2.0 <2.0.0` | From 1.2.0 up to, not including, 2.0.0. This lets in 2.0.0's own prereleases: write `<2.0.0-0` to keep them out |
| `1.2.0` | That version alone |

There is no `*`, no `x`, no `||`, and exactly one space between the two halves of the fourth form. `corpus/engines.json` is the table every implementation agrees with.

The ends of `^` and `~` are npm's (`^1.2.0` stops before `2.0.0-0`). Membership is not: npm leaves a prerelease out of a range unless the range names a prerelease of the same version, while here a version is inside a range whenever its precedence is, as with npm's `includePrerelease`. The version held against the range is the host's own, and a host on a prerelease of a compatible line (`1.3.0-beta.1` against `^1.2.0`) should still run the extension.

**What may change, and when.**

- The API follows semantic versioning. While it is 0.x, a minor version (0.1 to 0.2) may break and a patch version only adds, which is what `^0.1.0` assumes. From 1.0.0 on, only a major version breaks.
- The public surface of this package is frozen in `api/surface.txt`. A change to it that does not come with a new version fails the package's tests.
- Additions are quiet: a new optional manifest field, a new hook, a new permission, a new component, a new error code arrive with a new minor version. A manifest that uses one says so through `engines.songstress`, and an older host refuses it rather than misread it.
- An error code is never renamed and never changes its meaning.
- A host runs an extension whose `engines.songstress` takes the host's API version, and refuses any other (`ENGINE_UNSUPPORTED`).

## 15. Not in this version

Left out on purpose, so that nothing here promises what is not there. Each can be added without breaking an extension written today.

- **Permissions for writing to the library, reading audio files and converting audio.** No call needs them yet. A download's audio is fetched and joined by Songstress itself.
- **Signed-out routes.** Every route is for a signed-in member. Where on the server an extension's routes are served is the host's to say.
- **Keyboard shortcuts**, a **command palette** of an extension's own commands, context keys an extension sets itself, and **more than one language** for a manifest's text.
- **Notices kept for later.** A notice reaches the apps a member has open, and only those.
- **A schedule by the clock.** A job runs every so often, not at a time of day.
- **The API a view's own script uses**, with what it may reach. It belongs to the client runtime.
- **The numbers behind the caps** on a tree, on storage and on requests. The hosts set them.
- **Anything on a watch, in a car or in a widget.**
- **IPv6 addresses as `network.local` targets.** Name the device by its host name instead.

## 16. Notes: what this follows

Each detail below that this specification takes from an established system was checked against that system's own documentation on 2026-11-17. Where Songstress differs, the note says so.

**The manifest and its versions**

- A standalone manifest with its own format number, `manifestVersion`: Chrome's `manifest_version`, "the version of the manifest file format that your extension uses" ([Chrome: manifest file format](https://developer.chrome.com/docs/extensions/reference/manifest)).
- `id` as `publisher.name`: "The id of an extension is always `${publisher}.${name}`"; `engines` "Cannot be `*`", with `^0.10.5` as its example; `sponsor` as "an object with a single property `url`" ([VS Code: extension manifest](https://code.visualstudio.com/api/references/extension-manifest)).
- `version` and the order of versions: [Semantic Versioning 2.0.0](https://semver.org), rules 9 to 11, and its suggested regular expression (CC BY 3.0), here with each number held to 15 digits.
- The ends of `^` and `~` ranges, `-0` included, and npm's own treatment of prereleases, which section 14 departs from: [node-semver](https://github.com/npm/node-semver#caret-ranges-123-025-004).

**Contributions, commands and code**

- Contributions declared in the manifest and attached by id; menus pointing at commands; settings, which VS Code describes with "a superset of JSON Schema" and which here are a closed set of five types instead, so that a phone can draw every one: [VS Code: contribution points](https://code.visualstudio.com/api/references/contribution-points).
- `when` conditions, with `!`, `&&`, `||`, `==`, `!=` and parentheses, a subset of VS Code's operators, over keys the app knows; VS Code's own keys are its editor's, these are Songstress's ([VS Code: when clause contexts](https://code.visualstudio.com/api/references/when-clause-contexts)).
- The interface an extension asks the host to draw, with the host's own controls: a tree with nodes asked for when opened (`TreeDataProvider.getChildren`), a quick pick of one or several (`showQuickPick`, `canPickMany`), an input box (`showInputBox`), a message with buttons (`showInformationMessage(message, ...items)`), and a status bar item of text, an icon, a tooltip and a command (`createStatusBarItem`) ([VS Code: tree view](https://code.visualstudio.com/api/extension-guides/tree-view), [VS Code API: window](https://code.visualstudio.com/api/references/vscode-api#window)). Here each is data, which a phone draws natively too, and a pick or an input hands its answer to a command instead of to a promise.
- No start-up activation: VS Code derives activation from what is contributed since 1.74, and asks for `*` "only when no other activation events combination works" ([VS Code: activation events](https://code.visualstudio.com/api/references/activation-events)).
- Registration that gives back a disposable: `registerCommand(…): Disposable` ([VS Code API](https://code.visualstudio.com/api/references/vscode-api)).
- Typed settings a person fills in, `required` among them; a 512 by 512 PNG icon; at most six screenshots (Raycast recommends three, the official list here asks for three); a job's interval, whose "minimum value is 1 minute" ([Raycast: manifest](https://developers.raycast.com/information/manifest), [Raycast: preparing for the store](https://developers.raycast.com/basics/prepare-an-extension-for-store)).
- Interface sent as a tree of the host's own components, List, Grid, Detail and Form, that the host "renders … to our native UI" ([Raycast: user interface](https://developers.raycast.com/api-reference/user-interface)); asking the host what it can do, as Raycast's `environment.canAccess` and VS Code's `env.uiKind` do ([Raycast: environment](https://developers.raycast.com/api-reference/environment)).
- Images with their sizes stated in the manifest: the web app manifest's image resources and their `sizes` ([W3C: Web Application Manifest](https://www.w3.org/TR/appmanifest/)).

**Permissions**

- A reason with each permission: Figma's `networkAccess.reasoning`, "why your plugin needs to access the allowed domains", and its `allowedDomains`, where `*` may stand for subdomains ([Figma: manifest](https://developers.figma.com/docs/plugins/manifest/)). Here a reason is always required and a bare `*` is never allowed.
- Hosts named by pattern, Chrome's `host_permissions` ([Chrome: declare permissions](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions)); an update that asks for more waits for a person, as in Chrome, where "the extension will be disabled until the user accepts the new permission" ([Chrome: permission warnings](https://developer.chrome.com/docs/extensions/develop/concepts/permission-warnings)).
- The private and loopback blocks of `network.local`, and the blocks left out (link local `169.254.0.0/16`, shared address space `100.64.0.0/10`): the [IANA IPv4 Special-Purpose Address Registry](https://www.iana.org/assignments/iana-ipv4-special-registry/iana-ipv4-special-registry.xhtml) (RFC 1918, RFC 1122, RFC 3927, RFC 6598).

**Reading and checking a manifest**

- JSON: [RFC 8259](https://www.rfc-editor.org/rfc/rfc8259). Names in an object "SHOULD be unique", and with repeats the behaviour of software "is unpredictable": refused here. A parser "MAY ignore" a byte-order mark: refused here. JSON exchanged between systems "MUST be encoded using UTF-8", and an unpaired surrogate makes behaviour "unpredictable": both refused. Limits on numbers are allowed: a number no IEEE 754 double holds is refused.
- Pointers: [RFC 6901](https://www.rfc-editor.org/rfc/rfc6901), `~0` for `~` and `~1` for `/`.
- The schema: [JSON Schema 2020-12, validation](https://json-schema.org/draft/2020-12/json-schema-validation) (a string's length is "the number of its characters"; a `pattern` is an ECMA-262 expression and "not implicitly anchored"; an `integer` is "any number with a zero fractional part") and [core](https://json-schema.org/draft/2020-12/json-schema-core) (when two values are equal, for `uniqueItems`, `enum` and `const`; expressions with Unicode support).
- `TEXT_UNSAFE`: Unicode's `Default_Ignorable_Code_Point` property in [DerivedCoreProperties.txt](https://www.unicode.org/Public/UCD/latest/ucd/DerivedCoreProperties.txt) (Unicode 18.0.0), less what scripts and emoji need.
- Host names: labels may begin with a letter or a digit ([RFC 1123](https://www.rfc-editor.org/rfc/rfc1123), section 2.1).

**The official list**

- The publisher `songstress` kept for Songstress's own extensions, from the official list alone: the decision recorded in the foundation handoff, item 2, after Obsidian, whose plugin `id` "can't contain `obsidian`" ([Obsidian: submit your plugin](https://docs.obsidian.md/Plugins/Releasing/Submit+your+plugin)), and Zed, whose extension ID must "not include the words `zed` or `extension`" ([Zed: extension prerequisites](https://zed.dev/docs/extensions/publishing/prerequisites)). Here only the publisher `songstress` itself is kept, and the official list may carry it.
- Licences by their [SPDX identifiers](https://spdx.org/licenses/); every one the list accepts is approved by the Open Source Initiative.
- A GitHub owner's name: "alphanumeric characters and dashes", not starting or ending with a dash, at most 39 characters ([GitHub Docs](https://docs.github.com/en/enterprise-cloud@latest/admin/managing-iam/iam-configuration-reference/username-considerations-for-external-authentication)). The rule for a repository's name (letters, digits, `.`, `-`, `_`, at most 100) follows what GitHub's forms accept; no page of GitHub's documentation was found that states it.
