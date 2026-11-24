# Choosing what an extension contributes

A decision guide, one section per kind. It says which part fits, what it needs, and what goes wrong; the fields and
their limits are in `node_modules/songstress/SPEC.md` at the section named, and the API's types in the generated
reference, <https://songstress.app/docs/develop/reference/songstress/> (`…/reference/testing/` for the mock host).

## Contents

- [Providers](#providers): lyrics, artwork, metadata, artist info, search, lookup, links, scrobble, recommend
- [Hooks](#hooks): reacting to plays, likes and library changes
- [Interface](#interface): commands, menus, settings, pages, panels, status items, views
- [Jobs, routes and sign-in](#jobs-routes-and-sign-in)
- [Themes](#themes)
- [Server or client entry](#server-or-client-entry)

## Providers

SPEC §11. A provider answers **beside** Songstress's own sources, for every app. Declare it under
`contributes.providers.<kind>` with an `id` (and an optional `name`), register it in the server entry under the
same id with `songstress.providers.<kind>.register(id, provider)`, and ask for `providers`. Reaching a service needs
`network` with that service's hosts as well.

- **Pick the kind by what the user sees**: lines of a song's lyrics (`lyrics`), an artist's photo or an album's cover
  (`artwork`), an artist's biography or the artists like them (`artistInfo`), a discography or a track's missing
  facts (`metadata`), results in search (`search`), opening an item by its id (`lookup`), reading pasted links
  (`links`), sending plays somewhere (`scrobble`), radio and mixes (`recommend`).
- **Some kinds say more in the manifest** (`types` for search and lookup, `supports` for metadata, artwork and
  artist info, `patterns` for links, `modes` for recommend): the SPEC's table lists them. A source whose ids are a
  catalogue Songstress already reads (MusicBrainz, Spotify, Deezer…) names it as its `group`.
- **Reach the service with the helpers `songstress/server` exports**, not bare `songstress.net.fetch` (the server's
  sandbox has no `URL`, `atob`, `TextDecoder` or zlib; each helper has an example in the API reference,
  https://songstress.app/docs/develop/reference/server/):
  - `fetchJson` / `fetchText`: one retry when the service doesn't answer or fails, a 429 thrown as `rate-limited`
    with its wait, no answer as `unavailable`, any other non-2xx as an `HttpStatusError` (read its `status`);
    `nullIfMissing(() => fetchJson(…))` makes a lookup's 404 its `null`; `fetchResponse` hands back any status but a
    429 or a 5xx; `findInAnswer` finds a token in a script past the host's 2.5 MiB.
  - `queryString`, `parseUrl`, `urlParam`, `resolveUrl` for addresses; `htmlToText`, `unescapeHtml` for scraped pages.
  - `bestMatch(song, results, read)` keeps the one result that is the song asked for (title, artist, length, or the
    same ISRC; `matchScore` of 65 at least), so a namesake is never answered.
  - `KeptValue` keeps a token until it runs out, in memory and in storage (with the `storage` permission).
  - `registerCatalog(id, { search, track, album, …, resolve })` registers a catalogue's `search`, `lookup` and
    `links` in one call.
  - `base64Bytes`, `base64Text`, `utf8Text`, `gunzip` for bytes.

  ```ts
  import { bestMatch, fetchJson, queryString, songstress } from 'songstress/server'

  interface Hit { title: string; artist: string; seconds: number; text: string }

  songstress.providers.lyrics.register('my-source', {
    async find(song) {
      const hits = await fetchJson<Hit[]>(`https://api.example.com/search?${queryString({ q: `${song.artist} ${song.title}` })}`)
      const hit = bestMatch(song, hits, (one) => ({ title: one.title, artist: one.artist, durationS: one.seconds }))
      if (!hit) return { status: 'none' }
      return { status: 'found', synced: false, lines: hit.text.split('\n').map((text) => ({ text })) }
    },
  })
  ```
- **Nothing found is an empty list or `null`, not an error.** Throw a `ProviderFailure` (`rate-limited`,
  `sign-in-required`, `not-configured`, `unavailable`) only when Songstress can act on it; anything else thrown
  reads as broken for now.
- **A service that asks a client to say who it is** gets the extension's own `User-Agent` header, sent as written
  (SPEC §9, "The network is the host's"). For **lyrics**, SPEC §11's two Lyrics bullets say how lines are shown
  (order, pauses, limits) and when the server asks and keeps them: never while a song plays.
- **A `scrobble` provider** is handed members' plays, so it needs `listening.read` too, which each member grants
  for themselves.
- **`play` and `download`** fetch audio: switched off until the admin turns each on. Build one only when the user
  asks for exactly that.
- Test each method with the mock host, a `fetch` stand-in answering as the service would (its failures too), and
  the provider as registered (the names are in `node_modules/songstress/dist/types/testing/host.d.ts`):

  ```ts
  const host = createMockHost({ manifest, fetch: (url) => ({ status: 200, body: JSON.stringify(answerFor(url)) }) })
  await import('./server') // the entry registers as it loads: vi.resetModules() before each test
  const result = await host.provider('lyrics', 'my-source').find(song, {})
  expect(host.requests[0]?.url).toBe('https://api.example.com/…')
  ```

## Hooks

SPEC §7. A hook says what happened: a play started (`onPlay`, live, may be missed), a play counted (`onScrobble`,
reliable, arrives later for offline plays), a like, a playlist or library change, a scan done. List each hook the
entry listens to under `hooks.server` (or `hooks.client`) and ask for the permission the SPEC's §8 table names:
`listening.read` for a member's plays and likes, granted by each member; `library.read` for the library's changes.

- Count and record from `onScrobble`, not `onPlay`.
- Hooks cannot refuse, delay or change anything: they observe.
- Client hooks follow one device's player while its app is open; what must not be missed belongs in a server hook.

## Interface

SPEC §5 and §10. The apps draw interface **from the manifest and from trees of Songstress's own components**; an
extension never paints over Songstress.

- **A button that does something**: a `command` (its code registered with `songstress.commands.register`) placed
  in a `menu` location. Its outcome can be a toast, opening a page, and the like (SPEC §10, Actions).
- **Something the user configures**: a `setting`. Songstress draws and keeps it; code reads it with
  `songstress.settings.get`. Pick the `scope`: `server` (the admin sets it), `user` (each member's own) or `device`
  (one device's, client code only). A secret setting is never logged.
- **A screen of its own**: a `page` (a tree its entry renders, shown in every app when the server renders it).
  A `panel` sits in a place Songstress gives; a `status` item is a small live label.
- **An HTML page of its own**: a `view`, opened apart from the app with no `songstress` API. Phone builds cannot
  open views (SPEC §6): offer a page for them.
- Conditions (`when`) show a menu item or a part of a page only when they hold (SPEC §10, Conditions).

## Jobs, routes and sign-in

SPEC §5 and §9.

- **Work on a schedule or in the background**: a `job` with an optional `every` (`15m`, `6h`, `1d`), shown in
  Activity while it runs. Needs `jobs`.
- **An HTTP endpoint for signed-in callers**: a `route` under the extension's own prefix, JSON in and out. Needs
  `routes`.
- **Signing the server in to a service** (OAuth and the like): one `signIn`, started by a person in Songstress; the
  server entry registers its handler (SPEC §9, Signing in). The tokens it gets are the extension's own secrets, so
  it needs `secrets`. Check which API version its `scope` options came with before using them.

## Themes

SPEC §12. `npm create songstress-extension@latest -- --theme` starts one. A theme is data: colours for the apps'
tokens, a dark look, a light look or both, in the manifest or in a theme file. It needs no entry and no permission,
so there is nothing to build or test; `npm run check` and `npm run package` are the whole loop. Write colours for
the tokens the SPEC lists and keep text readable against its background in each look. Some things keep
Songstress's own look whatever the theme (the logo and icon, Songstress Red, Wrapped and its share cards, public
pages): the SPEC's "What no theme reaches" lists them, so do not promise to restyle them.

## Server or client entry

SPEC §1 and §6. Use **`entry.server`** unless the extension must follow one device's player live or react at once
in that app: server code reaches every app, phones included, and runs while no app is open. Client code runs in one
app's sandbox while it is open, phone store builds leave it out, and it is stopped in the background. An entry is
one bundled script; `songstress build` makes it from `src/server.ts` or `src/client.ts`.
