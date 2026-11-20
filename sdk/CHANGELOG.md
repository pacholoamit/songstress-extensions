# Changelog

What moved in each version of `songstress`. The package's version is the version of the extension API, which a manifest's `engines.songstress` is held against (SPEC.md, section 13).

## 0.1.2

The first version on npm.

- **`songstress/testing`.** A mock Songstress for an extension's own tests: `createMockHost`. Given the manifest, it refuses a call whose permission the manifest does not ask for, a request to a host it does not name and a hook it does not list. Its types are part of the frozen surface from this version on.
- **`songstress/sandbox`.** The types of the sandbox's globals (`console`, the timers), for `tsconfig.json`'s `types`: with them and the ES2023 library alone, `fetch`, `process` and the DOM do not compile.
- **`songstress check`.** Checks the manifest of each extension a folder holds, as a server does when it installs one, or as the Marketplace checks a listing (`--profile listing`), and says what each one's release is called. Exits 1 when any fails.
- **A repository of several extensions.** Each in a folder of its own, released on its own tag, `<id>@<version>`, with the asset `<id>-<version>.songstress` (SPEC.md, "A release").
- **Built for npm.** The entries are ES modules with their declarations, and the `songstress` command is one file for Node.

## 0.1.1

- **Sign-in.** An extension can sign the server in to its service: `contributes.signIn` in the manifest, `songstress.signIn.register` in the server entry (SPEC.md, section 9). Never published.

## 0.1.0

The specification as code: the manifest's JSON Schema and its validator (`songstress/manifest`), the corpus of manifests every reader must agree on, the API's types (`songstress`, `songstress/server`, `songstress/client`), and the `songstress` command (`build`, `pack`, `dev`). Never published.
