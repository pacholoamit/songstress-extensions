# Releasing to npm

CI publishes both packages, `songstress` (this folder) and `create-songstress-extension`
(`packages/create-songstress-extension`), with npm's trusted publishing: no npm token is kept anywhere.

## A release

1. Move `version` in the package's `package.json` (for this one, also `src/version.ts` and the rest
   CONTRIBUTING.md names when the API moves) and say what changed in its `CHANGELOG.md`.
2. Merge to `main`. A push to `main` that changes either `package.json` runs
   `.github/workflows/npm-publish.yml`: the packages' own checks (typecheck, tests, `songstress check` on the
   starter's templates), then `scripts/npm-publish.mjs`, which publishes each package only when npm does not
   have its version yet, the SDK first, and the starter only once npm answers for that SDK.

A rerun publishes nothing that is out already. Run it by hand from Actions (npm publish ▸ Run workflow): it
is a dry run unless `dry_run` is unticked, and always one when run on any branch but `main`. On a machine, `node scripts/npm-publish.mjs --dry-run` packs both
and has npm check each publish, sending nothing.

## The owner's one-time step

For each of the two packages: npmjs.com ▸ the package ▸ Settings ▸ Trusted Publisher ▸ GitHub Actions, with
organization or user `pacholoamit`, repository `Songstress`, workflow filename `npm-publish.yml`, and no
environment. The fields are case-sensitive and cannot be edited later. npm checks nothing on save: the first
publish proves it.

## What npm requires of it

- A GitHub-hosted runner (npm takes no self-hosted one) and npm 11.5.1 or later: the workflow installs npm 11.
- `repository` in each `package.json` naming this repository, as it does.
- Provenance is attached by npm itself to a package published from a public repository. This one is private,
  so the packages go out without it until the repository is public; nothing needs to change then.

## Why pnpm packs and npm publishes

`pnpm pack` applies `publishConfig` (exports and bin pointed at `dist/`) and runs `prepack`, the build. `npm
publish <tarball> --ignore-scripts` then sends that tarball as it is: `npm publish` of the folder would skip
`publishConfig`, and `prepack` refuses anything but pnpm. The repository's pnpm (9.15.9) has no trusted
publishing of its own; its `publish` hands the work to npm anyway.
