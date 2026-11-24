# Releasing, installing and listing an extension

The rules behind each step are in `node_modules/songstress/SPEC.md` ("A release" in §3, §13, §14) and in the
developer docs, <https://songstress.app/docs/develop/> (each page's Markdown at its address plus `.md`).

## A release

A server installs an extension from a **GitHub release** that carries its package, `<id>-<version>.songstress`, as
the release's one asset. The starter's `.github/workflows/release.yml` makes that release from a pushed tag.

1. Move `version` in `songstress.json` (a semantic version) and say what changed in `CHANGELOG.md`.
2. Tag that commit and push the tag:
   - a repository that is one extension: `v1.2.0` (or `1.2.0`);
   - a repository of several, each in a folder of its own: `<id>@<version>`, such as `acme.lyrics@1.2.0`.

   `npm run check` prints the tag each extension's release takes.
3. The workflow holds the tag to the manifest, checks, tests, packs and publishes the release.

Leave a release as it is once it is out: a server holds the file to the checksum GitHub published for it. Fix a
mistake with a new version.

## Installing

An admin opens Manage, then Extensions, chooses "Add an extension", and gives the repository's address (from a
repository of several Songstress asks which extension), one release's address (`…/releases/tag/<tag>`), or the
`.songstress` file. Songstress shows every permission and its reason, and nothing runs until the admin agrees;
what concerns a member's listening, that member grants for themselves.

A provider's source joins switched off or last among Songstress's own: tell the user to switch it on, and put it
where they want it in the order, after installing.

An update that asks for a permission the installed version did not have waits until a person accepts it, so add
permissions only when a feature needs them.

## Listing in the Marketplace

The Marketplace is the catalogue the apps browse. `songstress.*` extensions are Songstress's own; everyone else's
are listed after a person reviews their submission. `check`'s listing messages call what a listing asks "the
official list's" needs: they are the same rules.

1. Run `npm run check -- --profile listing`. On top of what a server installs, a listing needs `about` (its page's
   Description, in blocks of prose: SKILL.md, "The extension's page"), `license` (one the Marketplace accepts, by
   its SPDX identifier), `repository` (`https://github.com/owner/name`, public), exactly one of the categories, a 512
   by 512 PNG `icon` and three to six `screenshots`, each with its real `width` and `height`. Images are files in the
   package beside the manifest. `useCases`, `howItWorks`, `homepage`, `demo`, `support` and a `banner` are optional
   and fill the rest of the page.
2. The pictures are the author's real captures: ask for them, never draw or generate stand-ins. The page's words
   are yours to write from the code, and true to it.
3. Release a version that passes, then submit the repository's link at <https://songstress.app/extensions/submit>
   (once for each extension of a repository of several). A person reviews it before it is listed.

Once listed, it has a page of its own at `https://songstress.app/extensions/<id>` (its Markdown at `….md`), the
same in the apps' Marketplace, with its downloads, and ratings from people signed in with GitHub once three have
rated it. An extension with a `play` or `download` provider may be listed like any other; its page should say that
an admin turns those on.

## A newer SDK

`songstress` follows the extension API's version: `npm install --save-dev songstress@latest`, read its
`CHANGELOG.md`, run the checks again. Raise `engines.songstress` only to use something a newer API brought; a
lower floor keeps the extension running on servers that have not updated.
