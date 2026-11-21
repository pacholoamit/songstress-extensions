import { defineConfig } from 'vitest/config'

// Node environment only: each extension's code is written for the server's
// sandbox, which has no DOM. A stand-in host (extensions/shared/testing.ts) answers
// what the code asks Songstress for. sdk/ and theme/ run their own suites.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['*.test.ts', '*/*.test.ts', 'extensions/*/*.test.ts'],
    exclude: ['sdk/**', 'theme/**', 'node_modules/**'],
    fsModuleCachePath: 'node_modules/.vitest-cache',
  },
})
