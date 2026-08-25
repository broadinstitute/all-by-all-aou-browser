import assert from 'node:assert/strict'
import test from 'node:test'

import {
  FOCUS_LOCUS,
  FOCUS_REGION,
  getContextMenuNavigation,
} from './contextMenuNavigation'

const currentContext = {
  geneId: 'old-gene',
  regionId: '1-10-20',
  variantId: '1-15-A-G',
  analysisId: 'pheno-1',
}

test('entity context-menu actions return complete cleanup state for either tab mode', () => {
  const cases = [
    {
      entityType: 'gene' as const,
      id: 'new-gene',
      target: 'gene-phewas' as const,
      expected: {
        geneId: 'new-gene',
        regionId: null,
        variantId: null,
        analysisId: null,
        resultIndex: 'gene-phewas',
      },
    },
    {
      entityType: 'locus' as const,
      id: '2-30-40',
      target: 'locus-phewas' as const,
      expected: {
        geneId: null,
        regionId: '2-30-40',
        variantId: null,
        analysisId: null,
        resultIndex: 'locus-phewas',
      },
    },
    {
      entityType: 'phenotype' as const,
      id: 'pheno-2',
      target: 'pheno-info' as const,
      expected: {
        geneId: null,
        regionId: null,
        variantId: null,
        analysisId: 'pheno-2',
        resultIndex: 'pheno-info',
      },
    },
    {
      entityType: 'variant' as const,
      id: '2-35-C-T',
      target: 'variant-phewas' as const,
      expected: {
        geneId: null,
        regionId: null,
        variantId: '2-35-C-T',
        analysisId: null,
        resultIndex: 'variant-phewas',
      },
    },
  ]

  for (const { entityType, id, target, expected } of cases) {
    const navigation = getContextMenuNavigation(
      entityType,
      id,
      target,
      currentContext
    )
    assert.equal(navigation.destination, 'results')
    assert.deepEqual(navigation.stateUpdates, expected)
  }
})

test('preserve-analysis has the same explicit state semantics for either tab mode', () => {
  assert.deepEqual(
    getContextMenuNavigation(
      'gene',
      'new-gene',
      'gene-manhattan',
      currentContext,
      true
    ).stateUpdates,
    {
      geneId: 'new-gene',
      regionId: null,
      variantId: null,
      analysisId: 'pheno-1',
      resultIndex: 'gene-manhattan',
    }
  )
})

test('focus actions either isolate the gene or retain the complete current context', () => {
  assert.deepEqual(
    getContextMenuNavigation(
      'gene',
      'new-gene',
      FOCUS_LOCUS,
      currentContext
    ),
    {
      stateUpdates: {
        geneId: 'new-gene',
        regionId: null,
        variantId: null,
        analysisId: null,
      },
      destination: 'details',
    }
  )

  assert.deepEqual(
    getContextMenuNavigation('gene', '', FOCUS_REGION, currentContext),
    {
      stateUpdates: currentContext,
      destination: 'details',
    }
  )
})
