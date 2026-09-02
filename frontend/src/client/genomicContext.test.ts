import assert from 'node:assert/strict'
import test from 'node:test'

import {
  includeSelectedVariant,
  parseVariantLocus,
  resolveGenomicContext,
  resolveSelectedVariantMarker,
  variantIdsEqual,
} from './GenePage/genomicContext'

test('explicit variant gene wins for rendering while the source region is preserved', () => {
  assert.deepEqual(
    resolveGenomicContext({
      variantId: 'chr4-1804392-C-T',
      geneId: 'FGFR3',
      regionId: 'chr4-1700000-2000000',
    }),
    {
      kind: 'gene',
      geneId: 'FGFR3',
      preservedRegionId: 'chr4-1700000-2000000',
    }
  )
})

test('variant without a source gene uses explicit or inferred locus context', () => {
  assert.deepEqual(
    resolveGenomicContext({
      variantId: 'chr2-1000000-A-G',
      regionId: 'chr2-900000-1100000',
    }),
    { kind: 'locus', regionId: 'chr2-900000-1100000', source: 'explicit' }
  )
  assert.deepEqual(
    resolveGenomicContext({ variantId: '2-1000000-A-G' }),
    { kind: 'locus', regionId: '2-500000-1500000', source: 'variant-window' }
  )
})

test('non-variant region precedence remains unchanged', () => {
  assert.deepEqual(
    resolveGenomicContext({ geneId: 'BRCA1', regionId: '17-1-2' }),
    { kind: 'locus', regionId: '17-1-2', source: 'explicit' }
  )
})

test('variant identity permits only an optional chr prefix difference', () => {
  assert.equal(variantIdsEqual('chr17-43057062-T-TG', '17-43057062-T-TG'), true)
  assert.equal(variantIdsEqual('17-43057062-T-TG', '17-43057062-T-C'), false)
  assert.equal(variantIdsEqual('17-43057062-T-TG', '17-43057063-T-TG'), false)
  assert.deepEqual(parseVariantLocus('chr17-43057062-T-TG'), {
    contig: '17',
    position: 43057062,
  })
})

test('gene canvas policy marks the exact selected row on top', () => {
  const selected = {
    variant_id: 'chr17-43057062-T-TG',
    locus: { position: 43057062 },
  }
  assert.deepEqual(
    resolveSelectedVariantMarker({
      variants: [selected],
      selectedVariantId: '17-43057062-T-TG',
      isLargeRegion: false,
    }),
    {
      kind: 'marker',
      renderPath: 'canvas',
      position: 43057062,
      variant: selected,
      source: 'exact-row',
    }
  )
})

test('large locus policy overlays a selected marker even when threshold data omitted it', () => {
  assert.deepEqual(
    resolveSelectedVariantMarker({
      variants: [],
      selectedVariantId: 'chr2-100000000-A-G',
      isLargeRegion: true,
    }),
    {
      kind: 'marker',
      renderPath: 'server-overlay',
      position: 100000000,
      variant: null,
      source: 'canonical-id',
    }
  )
  assert.deepEqual(
    resolveSelectedVariantMarker({
      variants: [],
      selectedVariantId: 'not-a-canonical-variant',
      isLargeRegion: true,
    }),
    { kind: 'unavailable', renderPath: 'server-overlay' }
  )
})

test('selected variant bypasses ordinary visible-row filtering with exact identity', () => {
  const source = [
    { variant_id: 'chr1-10-A-G', pvalue: 0.5 },
    { variant_id: 'chr1-20-C-T', pvalue: 0.1 },
  ]
  assert.deepEqual(
    includeSelectedVariant([], source, '1-20-C-T'),
    [{ variant_id: 'chr1-20-C-T', pvalue: 0.1 }]
  )
  assert.deepEqual(includeSelectedVariant([], source, '1-20-C-A'), [])
})
