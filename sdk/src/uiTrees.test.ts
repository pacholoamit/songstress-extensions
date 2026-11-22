import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { UI_TREES_FILE, uiTreesFixture } from './test/uiTrees'

// The Go server and the apps each read testdata/ui-trees.json in place
// (src/test/uiTrees.ts says why). It is stale when this package would write
// it differently today: then this fails, and
//
//   pnpm --dir packages/extensions ui-trees:record
//
// writes it again. Run the Go tests (apps/pocketbase) and the apps'
// (packages/app) after: each reader must keep every tree whole.

const recording = process.env.SONGSTRESS_UI_TREES_RECORD === '1'

describe('the trees every reader of declared interface is held to', () => {
  it(recording ? 'records ui-trees.json' : 'ui-trees.json is what this package writes today', () => {
    const now = uiTreesFixture()
    if (recording) writeFileSync(UI_TREES_FILE, now)
    const kept = existsSync(UI_TREES_FILE) ? readFileSync(UI_TREES_FILE, 'utf8') : ''
    expect(kept === now, 'testdata/ui-trees.json is stale: run "pnpm --dir packages/extensions ui-trees:record", then the Go and app tests.').toBe(true)
  })

  it('names one screen of each kind, a panel and a status item', () => {
    const { screens, panel, status } = JSON.parse(uiTreesFixture()) as {
      screens: Record<string, { type: string }>
      panel: { children: unknown[] }
      status: { text: string }
    }
    expect(Object.values(screens).map((screen) => screen.type)).toEqual(['list', 'grid', 'detail', 'form', 'tree'])
    expect(panel.children.length).toBeGreaterThan(0)
    expect(status.text).toBeTruthy()
  })
})
