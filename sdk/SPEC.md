# Songstress extensions: the specification

Manifest version 1 · extension API 0.1.2

This document says what a Songstress extension is, what its manifest holds, what its code may do and where each part of it works. It is written for people who build extensions. Three things in this package say the same in a form a program reads, and they win where this text and they differ:

- `schema/extension.v1.json`, the manifest's JSON Schema;
- the validator (`songstress/manifest`) with its corpus of manifests (`corpus/`);
- the API's types (`songstress`, `songstress/server`, `songstress/client`).

The specification is ahead of the hosts that run it. It is version 0.x: it may still change between minor versions (section 13).

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
12. [Validation](#12-validation)
13. [Versions and stability](#13-versions-and-stability)
14. [Not in this version](#14-not-in-this-version)
15. [Notes: what this follows](#15-notes-what-this-follows)

## 1. What an extension is

An extension is a package: a folder with a manifest, `songstress.json`, at its root, and beside it whatever the manifest names. A theme is a manifest and a theme file. A scrobbler is a manifest and one JavaScript file.

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
- **A theme file** and **a view's HTML file** are named by the manifest and kept in the package. Their own formats are not part of this document.

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
| `engines.songstress` | yes | The versions of the extension API the extension runs on, as a range (section 13). `^0.1.0` is the usual answer. Never `*`. |

### Listing

| Field | Required | What it holds |
|---|---|---|
| `license` | for a listing | The code's licence, as an SPDX identifier: `MIT`, `Apache-2.0`. |
| `repository` | for a listing | Where the source lives, an https address. A listing needs `https://github.com/owner/name`. |
| `sponsor.url` | no | Where people can support the author, an https address. |
| `categories` | for a listing | A list of exactly one of: `sources`, `lyrics`, `metadata-artwork`, `scrobbling-stats`, `discovery`, `playback-audio`, `visualisers`, `themes`, `social-jam`, `library-tools`, `integrations`, `server-worker`. |
| `keywords` | no | Up to ten tags, each up to 30 lowercase letters and digits with single dots or hyphens between them. |
| `platforms` | no | The apps the extension's interface and client code work in: `web`, `desktop`, `ios`, `android`. Left out, all four. It says nothing of the server entry, which reaches every app. |

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

Where commands appear. An object keyed by location; each value is a list of up to ten `{ "command": "<id>" }` items, each naming a declared command (`MENU_COMMAND_UNKNOWN`), none twice.

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

### `pages` and `panels`

Interface drawn from a tree of Songstress's own components (section 10).

A page is a screen of its own, opened by an action, or from the sidebar of the web and desktop apps when it sets `sidebar`. Up to 20: `id`, `title`, `render` (`server` or `client`: the entry that builds the tree), and optionally `icon` and `sidebar`. A page rendered by the server entry shows in every app.

A panel is a section inside one of Songstress's own screens. Up to 10: `id`, `title`, `render`, and a `location`:

| `location` | Where the panel is drawn |
|---|---|
| `now-playing` | The player's now-playing view |
| `home` | Home, after Songstress's own shelves |
| `artist` | An artist's page |
| `album` | An album's page |

### `views`

Free-form pages: the extension's own HTML file, shown in a sandboxed frame kept apart from the app, its storage and its session. Up to 10: `id`, `title`, `path` (an `.html` file), and optionally `icon` and `sidebar`. A view and a page are opened the same way, so they share their ids. An app may be unable to show views (section 6): offer a page for what must work everywhere.

### `themes`

Theme files the extension ships. Up to 20: `id`, `label` (the family's name in the picker) and `path` (a `.json` file: a family of colour variants). A theme is data: it needs no entry and no permission.

### `providers`

Sources the extension adds beside Songstress's own. An object keyed by kind, each a list of up to five sources: `search`, `lookup`, `links`, `lyrics`, `metadata`, `artwork`, `scrobble`, `recommend`, `play`, `download`. Section 11 has each kind's fields and what its code answers.

### `jobs`

Work on the server, shown in Activity while it runs. Up to 20: `id`, `title` (as Activity shows it) and optionally `every`: how often the job runs by itself, as a number and `m`, `h` or `d` (`15m`, `6h`, `1d`). Without `every` the job runs only when code starts it.

### `routes`

JSON routes for signed-in callers, under a prefix that belongs to the extension. Up to 50: `id`, `method` (`GET`, `POST`, `PUT`, `PATCH` or `DELETE`) and `path`: segments of lowercase letters, digits, dots, hyphens and underscores, or `:name` for a part the handler reads (`/charts/:period`). Two routes may not answer the same method and path (`ROUTE_DUPLICATE`); the name of a `:name` part does not tell two paths apart.

### `signIn`

A sign-in to the service the extension reaches, which a person starts and ends in Songstress: one object, not a list.

| Field | Required | What it holds |
|---|---|---|
| `scope` | yes | Whose account it is. `server`: one account for the whole server, which its admin signs in. It is the only scope in this version. |
| `title` | no | The service as the sign-in names it. Left out, the extension's name. |

It needs the server entry (`ENTRY_REQUIRED`), whose handler does the signing in (section 9), and the `secrets` permission (`PERMISSION_REQUIRED`): the tokens a sign-in is given are the extension's own secrets. It came with API 0.1.1, so a manifest that has one asks for it: `"songstress": "^0.1.1"`.

## 6. Where each part works

"Phone" is the iPhone, iPad and Android apps. A phone build made for an app store leaves two things out: the web views that run client code and show free-form views, and the in-app catalogue of extensions. Everything an extension does on the server, its declared interface, its settings, and installing by link or QR code are in every build.

| Part | Server | Web and desktop | Phone | Phone build for a store |
|---|---|---|---|---|
| Server entry: hooks, providers, jobs, routes | Runs here | Reaches them | Reaches them | Reaches them |
| Client entry and its hooks | | Runs while the app is open | Runs while the app is open and in front | Not available |
| `commands` with `run: server` | Runs here | Yes | Yes | Yes |
| `commands` with `run: client` | | Yes | Yes | Not available |
| `menus` | | Every location | Every location but `sidebar`; an extension's items in a menu share one submenu | As a phone |
| `settings` | Kept here | Drawn | Drawn | Drawn |
| `pages` and `panels` with `render: server` | Rendered here | Drawn | Drawn | Drawn |
| `pages` and `panels` with `render: client` | | Drawn | Drawn | Not available |
| `views` | Serves the files | A sandboxed frame | A web view | Not available |
| `themes` | | Applied | Applied | Applied |
| `providers` | Runs here | Shows the results | Shows the results | Shows the results |
| `jobs` | Runs here | Shown in Activity | Shown in Activity | Shown in Activity |
| `signIn` | Runs here, and keeps the account's name | The admin signs in from the extension's page | As the web | As the web |

On a phone, client code and views run in a web view of their own, never in the app's own engine, so they need an app that carries one. An app without it, or a build for a store, still draws everything else an extension declares; the server entry's work goes on for it as for any app.

Nothing of an extension appears on a watch, in a car or in a widget.

An extension does not have to guess which app it is drawing for. Every render and every command run by a person is told the app (`client` in its context), and `songstress.host.info()` tells client code about its own:

```ts
const { client } = await songstress.host.info()
if (client?.capabilities.views) { /* offer the free-form view */ }
```

`ClientInfo` holds the `platform`, the version of the component vocabulary the app draws (`ui`), and its `capabilities`: `clientCode` (it runs client entries) and `views` (it shows free-form views).

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
| `network.local` | Requests to targets on the user's own network | `net.fetch` to those targets | The admin, who confirms twice |
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
| `ui` | both | none | `ui.pages.register` and `ui.panels.register`: the renderers of declared pages and panels |
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
- **The player is asked, not commanded.** `player` and `queue` requests are carried out as a tap on the app's own controls would be. Adding to the queue never touches what is playing.

`songstress/manifest` is apart from all this. It needs no host: it is the manifest's schema, its types and its validator, for tools.

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

Songstress finishes only the sign-in whose `state` came back, once, within ten minutes of its start, and keeps the account's name and nothing else: no token reaches it or an app. A server with no public address set cannot be sent back to, and refuses the start. Where the service's page cannot reach the server all the same, the admin pastes the address they landed on, and `finish` is handed that. A half that cannot be done throws a `ProviderFailure` (section 11); the admin is told the sign-in did not go through, and the reason is in the extension's log. An extension's other code reads the tokens where the handler kept them, and throws `sign-in-required` while there are none.

## 10. Declared interface

A page or a panel is a tree of the components below, as JSON. Each app draws the tree with its own controls, so one page works on the web, on the desktop and on a phone. A renderer is a function registered with `songstress.ui.pages.register(id, render)` or `songstress.ui.panels.register(id, render)`, in the entry the manifest names in `render`; it is told who is looking, in which app, and (for a panel) what the screen shows.

**Screens**, what a whole page is:

| `type` | What it is |
|---|---|
| `list` | Sections of rows, with an optional search field, an empty state and more rows on demand |
| `grid` | Sections of cards, with the same |
| `detail` | Blocks, read from top to bottom |
| `form` | Sections of fields and one button that hands them to a command |

**Rows and cards.** `row` and `card` are the extension's own: a title, a subtitle, an icon or an image, an action on a tap, a menu. `song`, `album`, `artist` and `playlist` are Songstress's own, named by library id and drawn exactly as Songstress draws them elsewhere, with their own menus and their own behaviour.

**Blocks**, what a `detail` page, a section and a panel are built from: `stack`, `section`, `text`, `icon`, `image`, `badge`, `progress`, `banner`, `divider`, `spacer`, `collapsible`, `button`, `menu`, `shelf`, and the four library types above.

**Fields**, what a `form` holds: `text-field`, `switch`, `checkbox`, `slider`, `picker`, `date-picker`. The app keeps what is typed until the form is submitted; the command then receives the values by field name.

**Actions**, what a tap does:

| `type` | What it does |
|---|---|
| `invoke` | Runs one of the extension's commands |
| `navigate` | Opens one of the extension's pages or views, or Songstress's page for something in the library; as a page or as a sheet |
| `play` | Plays library songs now, as a tap on a song does |
| `queue` | Adds library songs to the queue, at its end or next |
| `openUrl` | Opens an http or https address in the browser |
| `copy` | Copies text |
| `share` | Opens the device's share sheet |
| `toast` | Shows a short message |
| `confirm` | Asks first, then carries out another action |
| `refresh` | Renders the page or panel again |

What a tree cannot do, by design:

- run script, expressions or timers in the app: a tree is data;
- choose a colour, a font, a size in pixels or a position: colour is said by meaning (`tone`: `default`, `muted`, `accent`, `success`, `warning`, `danger`, `info`) and the theme decides the rest;
- load an image from the device: a picture is a cover from the library, or an address the app fetches through the server;
- ask for a password: a secret is a setting;
- draw outside its page or panel, replace a part of Songstress, add a tab, or appear without the extension's mark;
- grow without bound: the apps cap a tree's size, depth and number of rows and how often it is redrawn, and do not draw a tree over a cap.

An app says which version of this vocabulary it draws (`ClientInfo.ui`; this document describes version 1). A node it does not know is shown as "needs a newer app".

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
| `scrobble` | | `scrobble(play)`, and optionally `nowPlaying(play)` |
| `recommend` | `modes`: `track`, `artist`, `context` | `similarTracks`, `artistRadio`, `contextMix` |
| `play` | | `resolve(track)`: where one whole audio file is |
| `download` | `qualities`: `id`, `title` and optionally `lossless`, best first | `check(track)`, then `locate({ id, quality })`: where the audio is |

- **`lookup` and `metadata`.** A `lookup` source's artists and albums give their discographies as well: an artist's `albums` and `topTracks`, an album's `tracks`. Declare `metadata` with `discography` for a source that answers discographies without pages of its own to open, and with `enrich` for one that fills a track's missing facts.
- **`group`** names the catalogue of Songstress's own that the source reads too: `musicbrainz`, `spotify`, `deezer`, `tidal`, `itunes` or `ytmusic`. Its results are then merged with that catalogue's and it speaks that catalogue's ids. Left out, the source is a group of its own.
- **A link pattern** is a host with an optional path that a link must begin with (`soundcloud.com`, `example.com/album/`), or an app link's scheme (`spotify:`). A host also takes links to the hosts under it. The longest pattern that fits a link wins. `http:` and `https:` alone are refused (`LINK_PATTERN_TOO_BROAD`).
- **Beside, never instead.** A source joins switched off or last, the admin's order decides, and one that fails never fails the rest. Lyrics from a provider never replace the lyrics a song's own file carries. Its results carry the extension's mark, so people can tell them from Songstress's own.
- **`play` and `download`** are switched off until the admin turns each on, and the Marketplace lists no extension that has either (`LISTING_ACQUISITION`). A `play` provider plays what the `search` provider of the same id found (`PROVIDER_PLAY_NEEDS_SEARCH`). Both answer where the audio is, as addresses; Songstress fetches it, under the extension's own `network` permission on every hop, and joins segments itself. Nothing is decrypted.
- **Failure.** "Nothing found" is an empty list or `null`. A failure Songstress knows what to do about is thrown as a `ProviderFailure` with one of four codes: `rate-limited` (with `retryAfterS`), `sign-in-required`, `not-configured`, `unavailable`. Anything else thrown counts as the provider being broken for now.

## 12. Validation

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
| `ENGINE_RANGE_INVALID` | `engines.songstress` is not a range of section 13 |
| `ENGINE_UNSUPPORTED` | `engines.songstress` leaves out the API version of the host that is checking |
| `PATH_OUTSIDE_PACKAGE` | A path is not a plain path inside the package |
| `BANNER_NOT_16_9` | The banner's stated size is not 16:9 |
| `ENTRY_REQUIRED` | Something needs code in an entry the manifest does not have |
| `ENTRY_UNUSED` | An entry that nothing in the manifest would ever start |
| `PERMISSION_REQUIRED` | Something needs a permission the manifest does not ask for |
| `PERMISSION_UNUSED` | A permission nothing in the manifest could use |
| `NETWORK_LOCAL_NOT_PRIVATE` | A `network.local` target outside the private and loopback ranges |
| `DUPLICATE_ID` | Two contributions of a kind share an id, or two settings a key |
| `MENU_COMMAND_UNKNOWN` | A menu item names a command that is not declared |
| `ROUTE_DUPLICATE` | Two routes answer the same method and path |
| `LINK_PATTERN_TOO_BROAD` | A link pattern would claim every web link |
| `PROVIDER_PLAY_NEEDS_SEARCH` | A play provider with no search provider of the same id |
| `PROVIDER_MISMATCH` | One source with two names or two groups |
| `SETTING_DEFAULT_INVALID` | A default its own setting would refuse |
| `SETTING_RANGE_INVALID` | A minimum above its maximum |
| `SETTING_OPTION_DUPLICATE` | Two options with the same value |

### The listing's codes

| Code | Means |
|---|---|
| `LISTING_FIELD_REQUIRED` | One of `license`, `repository`, `categories`, `icon`, `screenshots` is missing |
| `LISTING_LICENSE` | The licence is not one of: `MIT`, `Apache-2.0`, `BSD-2-Clause`, `BSD-3-Clause`, `ISC`, `0BSD`, `MPL-2.0`, `LGPL-3.0-only`, `LGPL-3.0-or-later`, `GPL-3.0-only`, `GPL-3.0-or-later` |
| `LISTING_REPOSITORY` | `repository` is not `https://github.com/owner/name` |
| `LISTING_SCREENSHOTS` | Fewer than three screenshots |
| `LISTING_ACQUISITION` | The extension has a `play` or a `download` provider |

## 13. Versions and stability

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

## 14. Not in this version

Left out on purpose, so that nothing here promises what is not there. Each can be added without breaking an extension written today.

- **Permissions for writing to the library, reading audio files and converting audio.** No call needs them yet. A download's audio is fetched and joined by Songstress itself.
- **Signed-out routes.** Every route is for a signed-in member. Where on the server an extension's routes are served is the host's to say.
- **Conditions on menu items** (show this only when…), **keyboard shortcuts**, and **more than one language** for a manifest's text.
- **A schedule by the clock.** A job runs every so often, not at a time of day.
- **The format of a theme file**, and **the API a view's own script uses** with what it may reach. They belong to the themes and to the client runtime.
- **The numbers behind the caps** on a tree, on storage and on requests. The hosts set them.
- **Anything on a watch, in a car or in a widget.**
- **IPv6 addresses as `network.local` targets.** Name the device by its host name instead.

## 15. Notes: what this follows

Each detail below that this specification takes from an established system was checked against that system's own documentation on 2026-11-17. Where Songstress differs, the note says so.

**The manifest and its versions**

- A standalone manifest with its own format number, `manifestVersion`: Chrome's `manifest_version`, "the version of the manifest file format that your extension uses" ([Chrome: manifest file format](https://developer.chrome.com/docs/extensions/reference/manifest)).
- `id` as `publisher.name`: "The id of an extension is always `${publisher}.${name}`"; `engines` "Cannot be `*`", with `^0.10.5` as its example; `sponsor` as "an object with a single property `url`" ([VS Code: extension manifest](https://code.visualstudio.com/api/references/extension-manifest)).
- `version` and the order of versions: [Semantic Versioning 2.0.0](https://semver.org), rules 9 to 11, and its suggested regular expression (CC BY 3.0), here with each number held to 15 digits.
- The ends of `^` and `~` ranges, `-0` included, and npm's own treatment of prereleases, which section 13 departs from: [node-semver](https://github.com/npm/node-semver#caret-ranges-123-025-004).

**Contributions, commands and code**

- Contributions declared in the manifest and attached by id; menus pointing at commands; `when` clauses (left out here); settings, which VS Code describes with "a superset of JSON Schema" and which here are a closed set of five types instead, so that a phone can draw every one: [VS Code: contribution points](https://code.visualstudio.com/api/references/contribution-points).
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
