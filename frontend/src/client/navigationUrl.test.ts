import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildCanonicalNavigationUrl,
  parseNavigationState,
} from './navigationUrl'

const stateFrom = (href: string) => parseNavigationState(new URL(href))

test('canonical new-tab URLs remove stale entity and legacy query state', () => {
  const currentState = encodeURIComponent(JSON.stringify({
    geneId: 'old-gene',
    regionId: 'old-region',
    variantId: 'old-variant',
    analysisId: 'old-analysis',
    resultIndex: 'gene-phewas',
  }))
  const href = `https://example.org/other?state=${currentState}&geneId=legacy&resultLayout=detail#old`
  const result = buildCanonicalNavigationUrl(href, {
    geneId: 'new-gene',
    resultIndex: 'gene-phewas',
    resultLayout: 'full',
  })
  const url = new URL(result)

  assert.equal(url.pathname, '/app')
  assert.equal(url.hash, '')
  assert.equal(url.searchParams.has('geneId'), false)
  assert.equal(url.searchParams.has('resultLayout'), false)
  assert.deepEqual(stateFrom(result), {
    geneId: 'new-gene',
    resultIndex: 'gene-phewas',
    resultLayout: 'full',
  })
})

test('gene, phenotype, variant, and locus-PheWAS destinations survive URL refresh', () => {
  const cases = [
    { geneId: 'ENSG1', resultIndex: 'gene-phewas' },
    { analysisId: 'pheno-1', resultIndex: 'pheno-info' },
    { variantId: '1-10-A-G', resultIndex: 'variant-phewas' },
    { regionId: '1-1-20', resultIndex: 'locus-phewas' },
  ]

  for (const destination of cases) {
    const result = buildCanonicalNavigationUrl(
      'https://example.org/app?state=%7B%7D',
      { ...destination, resultLayout: 'full' }
    )
    assert.deepEqual(stateFrom(result), { ...destination, resultLayout: 'full' })
  }
})

test('detail links preserve analysis context only when explicitly requested', () => {
  const current = buildCanonicalNavigationUrl('https://example.org/app', {
    analysisId: 'pheno-1',
    geneId: 'old-gene',
  })
  const result = buildCanonicalNavigationUrl(
    current,
    { regionId: '2-10-20', resultLayout: 'detail' },
    { preserveKeys: ['analysisId'] }
  )

  assert.deepEqual(stateFrom(result), {
    analysisId: 'pheno-1',
    regionId: '2-10-20',
    resultLayout: 'detail',
  })
})
