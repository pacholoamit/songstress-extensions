// songstress/prose: the reader of a manifest's prose (SPEC.md, section 3,
// "Prose"), and nothing else: it imports nothing, so an app that draws an
// extension's page takes these three functions without the validator and its
// schemas (songstress/manifest exports them too).

export { parseProse, proseSpans, proseToMarkdown } from './manifest/prose'
export type { ProseBlock, ProseSpan } from './manifest/prose'
