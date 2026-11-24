# The Songstress plugin

One skill, `songstress-extensions`, that teaches a coding agent to build, test, package and publish extensions and
themes for [Songstress](https://songstress.app), the self-hosted music server, with the `songstress` SDK: the
workflow from `npm create songstress-extension` to a release, the rules `songstress check` holds an extension to,
and what to build for each idea. For the format itself it sends the agent to the SDK's own SPEC.md and to
<https://songstress.app/llms.txt>, so it never goes stale against the SDK it is used with.

Its version is the SDK's. How to install it: <https://songstress.app/docs/develop/ai-agents/>.

- In a new extension, `npm create songstress-extension@latest` puts it in `.claude/skills/` already.
- In an extension that has `songstress` installed: `cp -R node_modules/songstress/skill/skills/songstress-extensions .claude/skills/`.
- As a Claude Code plugin: this folder is a marketplace of one (`.claude-plugin/marketplace.json`).
