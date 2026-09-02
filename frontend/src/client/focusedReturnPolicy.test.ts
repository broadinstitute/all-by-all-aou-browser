import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getAppReturnOrigin,
  getFocusedReturnPolicy,
} from './focusedReturnPolicy'

test('phenotype-origin variant uses one true history Back with an accurate label', () => {
  const origin = getAppReturnOrigin({
    resultIndex: 'pheno-info',
    analysisId: 'height',
  })
  assert.deepEqual(getFocusedReturnPolicy({ origin, analysisId: 'height' }), {
    action: 'history-back',
    label: 'Back to phenotype results',
  })
})

test('direct variant with analysis uses deterministic phenotype fallback', () => {
  assert.deepEqual(
    getFocusedReturnPolicy({ origin: null, analysisId: 'height' }),
    {
      action: 'phenotype-fallback',
      label: 'Back to phenotype results',
      analysisId: 'height',
    }
  )
})

test('direct variant without analysis uses top-results fallback', () => {
  assert.deepEqual(getFocusedReturnPolicy({}), {
    action: 'top-results-fallback',
    label: 'Back to results',
  })
})

test('existing gene result origin retains gene return semantics', () => {
  const origin = getAppReturnOrigin({ resultIndex: 'gene-phewas' })
  assert.deepEqual(getFocusedReturnPolicy({ origin }), {
    action: 'history-back',
    label: 'Back to gene results',
  })
})
