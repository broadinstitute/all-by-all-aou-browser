import assert from 'node:assert/strict'
import test from 'node:test'

import {
  clampSplitPaneWidth,
  getPaneRenderMode,
  revealDetailsPane,
  revealResultsPane,
} from './paneLayout'

test('details-only uses a structural single-pane render mode (Gene empty-half regression)', () => {
  assert.equal(getPaneRenderMode('detail'), 'details-only')
  assert.equal(getPaneRenderMode('full'), 'results-only')
  assert.equal(getPaneRenderMode('split'), 'split')
})

test('navigation reveals a requested surface from a single-pane layout', () => {
  assert.equal(revealResultsPane('detail'), 'split')
  assert.equal(revealResultsPane('full'), 'full')
  assert.equal(revealDetailsPane('full'), 'split')
  assert.equal(revealDetailsPane('detail'), 'detail')
})

test('remembered split widths are clamped when the container changes', () => {
  assert.equal(clampSplitPaneWidth(1200, null), 600)
  assert.equal(clampSplitPaneWidth(1200, 1100), 880)
  assert.equal(clampSplitPaneWidth(1200, 10), 240)
  assert.equal(clampSplitPaneWidth(500, 900), 240)
  assert.equal(clampSplitPaneWidth(0, 100), 0)
})
