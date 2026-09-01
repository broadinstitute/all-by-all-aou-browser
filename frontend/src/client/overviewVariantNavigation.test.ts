import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getContainingLocusRegionId,
  getOverviewVariantNavigationState,
} from './Manhattan/overviewVariantNavigation'

const locus = {
  contig: 'chr12',
  start: 114300000,
  stop: 114500000,
}

test('coding variant navigation retains the authoritative containing locus', () => {
  assert.equal(
    getContainingLocusRegionId(locus),
    'chr12-114300000-114500000'
  )
  assert.deepEqual(
    getOverviewVariantNavigationState({
      variantId: 'chr12-114399544-C-A',
      geneId: 'ENSG00000089225',
      analysisId: 'heart-rate-mean',
      locus,
    }),
    {
      variantId: 'chr12-114399544-C-A',
      geneId: 'ENSG00000089225',
      analysisId: 'heart-rate-mean',
      regionId: 'chr12-114300000-114500000',
      resultIndex: 'variant-phewas',
    }
  )
})
