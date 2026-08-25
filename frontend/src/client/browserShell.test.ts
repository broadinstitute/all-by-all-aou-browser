import assert from 'node:assert/strict'
import test from 'node:test'

import {
  canCompareSideBySide,
  getBackToResultsLabel,
  getBrowserShellRenderMode,
  getDetailsContextLabel,
} from './browserShell'

test('Focused mounts exactly its active surface while Side by side honors its layout', () => {
  assert.equal(getBrowserShellRenderMode('focused', 'results', 'split'), 'results-only')
  assert.equal(getBrowserShellRenderMode('focused', 'details', 'full'), 'details-only')
  assert.equal(getBrowserShellRenderMode('sideBySide', 'details', 'full'), 'results-only')
  assert.equal(getBrowserShellRenderMode('sideBySide', 'results', 'detail'), 'details-only')
  assert.equal(getBrowserShellRenderMode('sideBySide', 'results', 'split'), 'split')
})

test('Focused details provides a context-aware return label', () => {
  assert.equal(getBackToResultsLabel('gene-phewas'), 'Back to gene results')
  assert.equal(getBackToResultsLabel('variant-phewas'), 'Back to variant results')
  assert.equal(getBackToResultsLabel('gene-manhattan'), 'Back to phenotype results')
  assert.equal(getBackToResultsLabel('top-associations'), 'Back to results')
  assert.equal(
    getDetailsContextLabel({ analysisId: 'pheno-1', geneId: 'ENSG1' }),
    'Details for phenotype pheno-1 · gene ENSG1'
  )
})

test('comparison is offered only when both valid surfaces fit', () => {
  assert.equal(
    canCompareSideBySide({ width: 1200, analysisId: 'p1', variantId: '1-10-A-G' }),
    true
  )
  assert.equal(
    canCompareSideBySide({ width: 900, analysisId: 'p1', variantId: '1-10-A-G' }),
    false
  )
  assert.equal(canCompareSideBySide({ width: 1200, analysisId: 'p1' }), false)
})
