import { defineConfig } from 'vitest/config'

// Node environment: what is tested here is colour arithmetic. Mirrors
// packages/config/vitest.config.ts.
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
