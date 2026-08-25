import assert from 'node:assert/strict'
import test from 'node:test'

import {
  filterToComparedPhenotypes,
  getAssociationDetailsAriaLabel,
  getAssociationDetailsNavigation,
  shouldShowComparedOnly,
  updateTopHitDetailLabel,
} from './PhenotypeList/phewasDisplay'

const plotPhenotypes = [
  { analysis_id: 'c', source: 'plot' },
  { analysis_id: 'a', source: 'plot' },
  { analysis_id: 'b', source: 'plot' },
]
const tablePhenotypes = [
  { analysis_id: 'b', source: 'table' },
  { analysis_id: 'c', source: 'table' },
  { analysis_id: 'a', source: 'table' },
]

test('Show compared only filters every plot mode and the table to the same IDs', () => {
  const comparedIds = ['a', 'c']

  for (const plotMode of ['P-value', 'Beta', 'Both']) {
    const enabled = shouldShowComparedOnly(true, 'gene', comparedIds)
    const displayedPlot = filterToComparedPhenotypes(plotPhenotypes, comparedIds, enabled)
    const displayedTable = filterToComparedPhenotypes(tablePhenotypes, comparedIds, enabled)

    assert.deepEqual(
      displayedPlot.map(({ analysis_id }) => analysis_id),
      ['c', 'a'],
      `${plotMode} plot keeps plot order`
    )
    assert.deepEqual(
      displayedTable.map(({ analysis_id }) => analysis_id),
      ['c', 'a'],
      `${plotMode} table keeps table order`
    )
  }
})

test('top-hit PheWAS ignores leaked Show compared only state', () => {
  const enabled = shouldShowComparedOnly(true, 'topHit', ['a'])

  assert.equal(enabled, false)
  assert.equal(filterToComparedPhenotypes(plotPhenotypes, ['a'], enabled), plotPhenotypes)
  assert.equal(filterToComparedPhenotypes(tablePhenotypes, ['a'], enabled), tablePhenotypes)
})

test('an empty comparison cannot produce an empty Show compared only view', () => {
  const enabled = shouldShowComparedOnly(true, 'variant', [])

  assert.equal(enabled, false)
  assert.equal(filterToComparedPhenotypes(plotPhenotypes, [], enabled), plotPhenotypes)
  assert.equal(filterToComparedPhenotypes(tablePhenotypes, [], enabled), tablePhenotypes)
})

test('changing and clearing detail context replaces the transient top-hit label only', () => {
  const initialLabels = new Set(['custom-label', 'GENE1:analysis-1'])
  const changed = updateTopHitDetailLabel(
    initialLabels,
    'GENE1:analysis-1',
    'GENE2',
    'analysis-2'
  )

  assert.deepEqual([...changed.labeledIds].sort(), ['GENE2:analysis-2', 'custom-label'])
  assert.equal(changed.activeTopHitId, 'GENE2:analysis-2')

  const cleared = updateTopHitDetailLabel(
    changed.labeledIds,
    changed.activeTopHitId,
    null,
    'analysis-2'
  )
  assert.deepEqual([...cleared.labeledIds], ['custom-label'])
  assert.equal(cleared.activeTopHitId, null)
})

test('association detail navigation changes the primary row without rewriting comparison state', () => {
  const comparedIds = ['analysis-2', 'analysis-3']
  const regularTarget = getAssociationDetailsNavigation({ analysis_id: 'analysis-1' })
  const topHitTarget = getAssociationDetailsNavigation(
    { analysis_id: 'analysis-1', gene_id: 'ENSG1' },
    'topHit'
  )

  assert.deepEqual(regularTarget, { analysisId: 'analysis-1', context: {} })
  assert.deepEqual(topHitTarget, {
    analysisId: 'analysis-1',
    context: { geneId: 'ENSG1' },
  })
  assert.deepEqual(comparedIds, ['analysis-2', 'analysis-3'])
})

test('association-detail arrow labels identify their row and context', () => {
  const row = {
    analysis_id: 'analysis-1',
    description: 'Asthma',
    gene_id: 'ENSG1',
    gene_symbol: 'GENE1',
  }

  assert.equal(getAssociationDetailsAriaLabel(row), 'Open association details for Asthma')
  assert.equal(
    getAssociationDetailsAriaLabel(row, 'variant'),
    'Open variant association details for Asthma'
  )
  assert.equal(
    getAssociationDetailsAriaLabel(row, 'locus'),
    'Open locus association details for Asthma'
  )
  assert.equal(
    getAssociationDetailsAriaLabel(row, 'topHit'),
    'Open association details for Asthma and GENE1'
  )
})
