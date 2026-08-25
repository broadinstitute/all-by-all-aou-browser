import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildCanonicalNavigationUrl,
  getInitialActiveSurface,
  parseNavigationState,
} from './navigationUrl'

const stateFrom = (href: string) => parseNavigationState(new URL(href))

test('legacy URL layout initializes active surface unless the URL specifies one', () => {
  const urlFor = (state: Record<string, unknown>) =>
    new URL(`https://example.org/app?state=${encodeURIComponent(JSON.stringify(state))}`)

  assert.equal(getInitialActiveSurface(urlFor({ resultLayout: 'detail' })), 'details')
  assert.equal(getInitialActiveSurface(urlFor({ resultLayout: 'full' })), 'results')
  assert.equal(getInitialActiveSurface(urlFor({ resultLayout: 'split' })), 'results')
  assert.equal(
    getInitialActiveSurface(
      urlFor({ resultLayout: 'detail', activeSurface: 'results' })
    ),
    'results'
  )
})

test('canonical new-tab URLs remove stale entity and legacy query state', () => {
  const currentState = encodeURIComponent(JSON.stringify({
    geneId: 'old-gene',
    regionId: 'old-region',
    variantId: 'old-variant',
    analysisId: 'old-analysis',
    resultIndex: 'gene-phewas',
  }))
  const href = `https://example.org/other?state=${currentState}&geneId=legacy&resultLayout=detail&experienceMode=focused&activeSurface=details#old`
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
  assert.equal(url.searchParams.has('experienceMode'), false)
  assert.equal(url.searchParams.has('activeSurface'), false)
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

test('canonical URLs preserve an explicit experience mode and active surface', () => {
  const result = buildCanonicalNavigationUrl(
    'https://example.org/app?state=%7B%22experienceMode%22%3A%22sideBySide%22%7D',
    {
      geneId: 'ENSG1',
      experienceMode: 'focused',
      activeSurface: 'details',
      resultLayout: 'detail',
    }
  )

  assert.deepEqual(stateFrom(result), {
    geneId: 'ENSG1',
    experienceMode: 'focused',
    activeSurface: 'details',
    resultLayout: 'detail',
  })
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
