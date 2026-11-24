# Changelog

What moved in each version of `songstress`. The package's version is the version of the extension API, which a manifest's `engines.songstress` is held against (SPEC.md, section 14).

## 0.1.10

- **The helpers every provider writes are the SDK's.** `songstress/server` exports what the official ports each carried a copy of, so a third party's extension does all they do with imports from `songstress` alone (SPEC.md, section 9, "Helpers"): `registerCatalog` registers a catalogue's `search`, `lookup` and `links` providers in one call; `fetchResponse`, `fetchText` and `fetchJson` reach a source through `net.fetch`, tried again when it did not answer or answered a 5xx, a 429 thrown as `ProviderFailure` `rate-limited` with its wait, and any other status but a 2xx as an `HttpStatusError`; `nullIfMissing` turns a 404 into `null`; `findInAnswer` reads an answer past the host's 2.5 MiB by asking for it gzipped and unpacking it a block at a time; `KeptValue` keeps a token until it runs out, in memory and in the store; `matchScore` and `bestMatch` pick the one result that is the song asked for. For what the server's sandbox has no global for: `parseUrl`, `urlParam`, `resolveUrl` and `queryString`; `foldText`, `htmlToText` and `unescapeHtml`; `base64Bytes`, `base64Text`, `utf8Text` and `gunzip`.
- **A usage example on every function.** Every exported function and class, each method of a class, every call of the `songstress` object, the mock host's methods and the sandbox's globals carry an `@example` in their doc comments, which the API reference on songstress.app draws under each one; the package's tests compile every example against the SDK, and the site's build fails on a function without one.
- **`songstress build` leaves doc comments out of the bundle** (licences and the bundler's annotations stay): an extension's package no longer carries the SDK's documentation and its examples.
- **The host's two `limit-exceeded` refusals of `net.fetch`** are told apart by their words: `no answer in time`, or an answer larger than its limit (SPEC.md, section 9).
- **The host's answer to a request that names its own `accept-encoding`** is written down: the body comes as the source sent it, still packed, and the 2.5 MiB counts the packed bytes (SPEC.md, section 9).

## 0.1.9

- **A page of its own for every extension.** The manifest takes what the Marketplace and the apps draw an extension's page from: `about` (its Description), `useCases` (a line each) and `howItWorks`, and the addresses `homepage`, `demo` and `support`. A listing needs `about` (`LISTING_FIELD_REQUIRED` at `/about`). A manifest's text stays one line, so the longer texts are lists of blocks, each a paragraph, a heading (`## `, `### `) or a list item (`- `), with bold, emphasis, code in backticks and https links inside (SPEC.md, section 3, "Prose").
- **`parseProse`, `proseSpans` and `proseToMarkdown`** (`songstress/manifest`) read those blocks the way every page does, and write them as Markdown.

## 0.1.8

- **An extension that plays or downloads may be listed.** The listing profile no longer refuses a manifest with a `play` or a `download` provider, and its code `LISTING_ACQUISITION` is gone: `songstress check --profile listing` passes such an extension when the rest of a listing is there. Both kinds are still switched off on a server until its admin turns each on.

## 0.1.7

The first version on npm.

- **An Agent Skill.** `skill/` is a Claude Code plugin holding the skill `songstress-extensions`, which teaches a coding agent to build, check, pack and release an extension. It sends the agent to this package's SPEC.md and to songstress.app's `llms.txt` for the format, and follows this package's version.
- **A sign-in can be each member's own.** `contributes.signIn.scope` takes `user` beside `server`: each member signs in to their own account of the service, from their own page of the extension, and no admin signs them in or out. `start`, `finish` and `signOut` are handed that member's `userId` (`SignInStart.userId`, `SignInReturn.userId`, and a new `SignOutRequest`), and the handler keeps their tokens as theirs with `songstress.secrets.set(key, value, { userId })`. A sign-in of scope `server` is unchanged: no call names a member, and `signOut` is handed an empty request.

## 0.1.6

Never published.

- **Artist info is a provider kind.** `contributes.providers.artistInfo` declares a source of words about an artist, with `supports` of `biography`, `similar` or both, and `songstress.providers.artistInfo.register` registers it: `biography(artist)` answers who they are (`ArtistBiography`: plain text of which 4000 characters are kept, the page it is from, its language as a BCP 47 tag), `similarArtists(artist, limit)` the artists like them, most alike first, 50 at most. SPEC.md section 11.

## 0.1.5

Never published.

- **A playlist panel is told the playlist's id** (`PanelContext.playlist`), to an extension granted `library.read`: playlists themselves are not read for extensions yet.

## 0.1.4

Never published.

- **Interface that fits, as VS Code's does.** The declared interface's vocabulary is version 2 (`UI_VERSION`), and SPEC.md section 10 says what goes where:
  - a `tree` screen, whose nodes open in place on the web and the desktop and as pages of their own on the phones, with children given or asked for (`RenderContext.node`);
  - status items in the player (`contributes.status`, `songstress.ui.status.register`): a few words, an icon, a tone, progress, a tap;
  - three actions that ask or tell: `pick` (Songstress's own picker, one or several), `input` (a line of text), each handing the person's answer to a command (`CommandContext.answer`, sources `pick` and `input`), and `notify` (a notice with up to two buttons);
  - `songstress.ui.notify` and `songstress.ui.refresh`: a notice, or a page, panel or status item rendered again, in a member's open apps;
  - `when` conditions on menu items, a page's navigation entry, panels and status items, with two new codes, `WHEN_INVALID` and `WHEN_KEY_UNKNOWN`;
  - panels on a playlist's page (`location: "playlist"`, `PanelContext.playlist`);
  - a `section` for settings, the heading they are drawn under.
- **Views open in the browser.** A view is the extension's own page, opened apart from the app, with no API.

## 0.1.3

Never published.

- **Themes.** A theme sets every colour the apps draw, Songstress Red's place included, and nothing that is Songstress's own (its logo and icon, Wrapped and the share cards, the first run, supporters' medals): `contributes.themes` gives each theme an `appearance` (`dark`, `light` or `both`) and its looks, each a seed, the colour tokens and a glow, written in the manifest or in a theme file (`schema/theme.v1.json`). SPEC.md's new section 12 has the tokens, the colours a theme writes, what an app fills in, what no theme reaches, and the rules a look is held to. The full player is themed too, its words held to the rules on a floor laid over the artwork. `songstress/manifest` reads a theme file (`parseThemeFile`) and names the tokens (`THEME_TOKENS`); four new codes, `THEME_LOOKS`, `THEME_COLOR`, `THEME_COLOR_ALPHA` and `THEME_FILE_TOO_LARGE`. 0.1.2's theme entry (an `id`, a `label` and a `path` to a family of colour variants) is gone: no version before this one was published, and no server ever read it.
- **`songstress/theme`.** A theme's colours as the apps read them: hex of three, four, six or eight digits, `rgb()`, `rgba()`, `hsl()` and `hsla()`, read by `parseColor` into one form, `#rrggbb` or `#rrggbbaa`, and a whole look by `normalizeLook`. Only `border` and `surface.hover` may be translucent. The apps' engine, `songstress check` and the server read colours the same way, held to `corpus/colors.json`.
- **`songstress check` holds each theme to the apps' own rules.** Each look, filled as an app fills it, on the stage and on the full player's floor over dark and light artwork (stricter than the stage alone: a second voice that reads on its stage by a hair is refused): a look an app would not show is `THEME_CONTRAST` or `THEME_LUMINANCE`, with the ratio it reaches; a theme file that is not there, or that a server would refuse, is reported at the theme's `path`. The command carries Material Color Utilities' HCT colour space for it (Apache-2.0, `NOTICE`).
- **`net.fetch` from client code** goes to the public hosts `network` names alone, never to `network.local`'s targets, as the server's host has always held it: SPEC.md section 8 and `Net`'s documentation said both permissions applied on either side.

## 0.1.2

Never published.

- **`songstress/testing`.** A mock Songstress for an extension's own tests: `createMockHost`. Given the manifest, it refuses a call whose permission the manifest does not ask for, a request to a host it does not name and a hook it does not list. Its types are part of the frozen surface from this version on.
- **`songstress/sandbox`.** The types of the sandbox's globals (`console`, the timers), for `tsconfig.json`'s `types`: with them and the ES2023 library alone, `fetch`, `process` and the DOM do not compile.
- **`songstress check`.** Checks the manifest of each extension a folder holds, as a server does when it installs one, or as the Marketplace checks a listing (`--profile listing`), and says what each one's release is called. Exits 1 when any fails.
- **A repository of several extensions.** Each in a folder of its own, released on its own tag, `<id>@<version>`, with the asset `<id>-<version>.songstress` (SPEC.md, "A release").
- **Built for npm.** The entries are ES modules with their declarations, and the `songstress` command is one file for Node.

## 0.1.1

- **Sign-in.** An extension can sign the server in to its service: `contributes.signIn` in the manifest, `songstress.signIn.register` in the server entry (SPEC.md, section 9). Never published.

## 0.1.0

The specification as code: the manifest's JSON Schema and its validator (`songstress/manifest`), the corpus of manifests every reader must agree on, the API's types (`songstress`, `songstress/server`, `songstress/client`), and the `songstress` command (`build`, `pack`, `dev`). Never published.
