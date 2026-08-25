import assert from 'node:assert/strict'
import test from 'node:test'

import {
  GENE_DETAIL_INLINE_GUTTER_PX,
  geneDetailGridContract,
  normalizeRegionViewerWidth,
} from './geneDetailLayout'

test('gene details give every generated grid row an intrinsic max-content track', () => {
  assert.equal(geneDetailGridContract.intrinsicRowSizing, 'max-content')
})

test('gene detail scrolling content owns a symmetric inline gutter', () => {
  assert.equal(GENE_DETAIL_INLINE_GUTTER_PX, 16)
  assert.equal(geneDetailGridContract.inlineGutterPx, GENE_DETAIL_INLINE_GUTTER_PX)
})

test('gene details without variant details give the region viewer the entire row', () => {
  assert.equal(
    geneDetailGridContract.regionRowWithoutVariantDetails,
    'region-viewer region-viewer region-viewer'
  )
})

test('region viewer geometry uses a stable measured slot width', () => {
  assert.equal(normalizeRegionViewerWidth(undefined), 0)
  assert.equal(normalizeRegionViewerWidth(90), 0)
  assert.equal(normalizeRegionViewerWidth(612.8), 612)
  assert.equal(normalizeRegionViewerWidth(Number.NaN), 0)
})
