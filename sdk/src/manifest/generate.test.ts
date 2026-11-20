import { expect, it } from 'vitest'
import { generatePatterns, generateTypes } from './generate'
import { MANIFEST_SCHEMA } from './schema'

// The two files written from the schema. A stale one fails here;
// `pnpm --dir packages/extensions generate` rewrites both.
it('types.generated.ts is what the schema says today', async () => {
  await expect(generateTypes(MANIFEST_SCHEMA)).toMatchFileSnapshot('./types.generated.ts')
})

it('patterns.generated.ts is what the schema says today', async () => {
  await expect(generatePatterns(MANIFEST_SCHEMA)).toMatchFileSnapshot('./patterns.generated.ts')
})
