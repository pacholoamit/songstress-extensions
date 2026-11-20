import { defineConfig } from 'vitest/config'

// Node environment only: the validator and the SDK's shim touch no DOM, which
// is what lets them run in a browser, in a sandbox and on a server alike.
// Mirrors packages/config/vitest.config.ts.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Its own module cache: one shared with another package's suite, which
    // turbo runs at the same time, crashes both at startup after a lockfile
    // change (see packages/app/vitest.config.ts).
    fsModuleCachePath: 'node_modules/.vitest-cache',
  },
})
