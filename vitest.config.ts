import { defineConfig } from 'vitest/config'

// Node environment only: each extension's code is written for the server's
// sandbox, which has no DOM. A stand-in host (shared/testing.ts) answers
// what the code asks Songstress for. sdk/ runs its own suite.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['*.test.ts', '*/*.test.ts'],
    exclude: ['sdk/**', 'node_modules/**'],
    fsModuleCachePath: 'node_modules/.vitest-cache',
  },
})
