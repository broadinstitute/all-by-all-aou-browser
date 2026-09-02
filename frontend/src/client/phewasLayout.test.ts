import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

import {
  DOCUMENT_PHEWAS_EMPTY_STATE_HEIGHT,
  DOCUMENT_PHEWAS_ROW_CAP,
  getPhewasTableLayoutPolicy,
  getVariantPhewasLayoutMode,
  PANE_PHEWAS_EMPTY_STATE_HEIGHT,
} from './PhenotypeList/phewasLayout'

const documentPolicy = (rowCount: number) =>
  getPhewasTableLayoutPolicy({
    layoutMode: 'document',
    rowCount,
    windowHeight: 1000,
    plotHeight: 450,
  })

test('document PheWAS tables follow sparse row counts and use a compact empty state', () => {
  assert.deepEqual(documentPolicy(0), {
    numRowsRendered: 0,
    emptyStateHeight: DOCUMENT_PHEWAS_EMPTY_STATE_HEIGHT,
  })
  assert.equal(documentPolicy(1).numRowsRendered, 1)
  assert.equal(documentPolicy(2).numRowsRendered, 2)
  assert.equal(documentPolicy(DOCUMENT_PHEWAS_ROW_CAP - 1).numRowsRendered, 15)
})

test('document PheWAS tables cap larger result sets for internal scrolling', () => {
  assert.equal(documentPolicy(DOCUMENT_PHEWAS_ROW_CAP + 20).numRowsRendered, 16)
})

test('pane PheWAS table sizing retains its viewport-based minimum', () => {
  assert.deepEqual(
    getPhewasTableLayoutPolicy({
      layoutMode: 'pane',
      rowCount: 1,
      windowHeight: undefined,
      plotHeight: 450,
    }),
    { numRowsRendered: 20, emptyStateHeight: PANE_PHEWAS_EMPTY_STATE_HEIGHT }
  )
  assert.equal(
    getPhewasTableLayoutPolicy({
      layoutMode: 'pane',
      rowCount: 1,
      windowHeight: 700,
      plotHeight: 450,
    }).numRowsRendered,
    10
  )
})

test('composed VariantPhewas forwards document flow while standalone retains pane flow', () => {
  assert.equal(getVariantPhewasLayoutMode('composed'), 'document')
  assert.equal(getVariantPhewasLayoutMode('standalone'), 'pane')

  const source = readFileSync(join(__dirname, 'VariantPage/VariantPhewas.tsx'), 'utf8')
  assert.match(source, /layoutMode=\{getVariantPhewasLayoutMode\(layout\)\}/)
})
