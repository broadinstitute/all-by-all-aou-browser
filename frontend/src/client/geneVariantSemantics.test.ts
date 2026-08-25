import assert from 'node:assert/strict'
import test from 'node:test'

import {
  associationNegLog10P,
  associationPointY,
  associationPvalueSortValue,
  hasAssociationPvalue,
  mergeGeneVariantResponses,
  MISSING_ASSOCIATION_RESULT_DESCRIPTION,
  MISSING_ASSOCIATION_RESULT_LABEL,
} from './GenePage/geneVariantSemantics'

test('gene variant merge retains matched, association-only, and no-pvalue annotation rows', () => {
  const annotations = [
    { variant_id: 'matched', consequence: 'missense_variant', af: 0.01 },
    { variant_id: 'no-pvalue', consequence: 'synonymous_variant', allele_frequency: 0.001 },
  ]
  const associations = [
    { variant_id: 'matched', pvalue: 1e-8, beta: 0.2, af: 0, consequence: 'unknown' },
    { variant_id: 'association-only', pvalue: 0.05, beta: -0.1 },
  ]

  const merged = mergeGeneVariantResponses(annotations, associations)
  const byId = new Map(merged.map((variant) => [variant.variant_id, variant]))

  assert.deepEqual([...byId.keys()].sort(), ['association-only', 'matched', 'no-pvalue'])
  assert.equal(byId.get('matched')?.pvalue, 1e-8)
  assert.equal(byId.get('matched')?.consequence, 'missense_variant')
  assert.equal(byId.get('matched')?.af, 0.01)
  assert.equal(byId.get('no-pvalue')?.pvalue, undefined)
  assert.equal(byId.get('association-only')?.pvalue, 0.05)
})

test('zero is an underflowed association p-value, not a missing p-value', () => {
  assert.equal(hasAssociationPvalue(undefined), false)
  assert.equal(hasAssociationPvalue(null), false)
  assert.equal(hasAssociationPvalue(0), true)
  assert.equal(associationNegLog10P(undefined), 0)
  assert.equal(associationNegLog10P(1e-8), 8)
  assert.equal(associationNegLog10P(0), Number.POSITIVE_INFINITY)
})

test('only missing association results use the bottom plot row', () => {
  assert.equal(associationPointY(undefined, 10, 250), 250)
  assert.equal(associationPointY(null, 10, 250), 250)
  assert.equal(associationPointY(0, -10, 250), -10)
  assert.equal(associationPointY(0.5, 100, 250), 100)
  assert.equal(MISSING_ASSOCIATION_RESULT_LABEL, 'No association result')
  assert.match(MISSING_ASSOCIATION_RESULT_DESCRIPTION, /filtering or incomplete coverage/)
})

test('underflowed zero p-values survive a capped significance ranking', () => {
  const pvalues = [
    undefined,
    0.9,
    0.8,
    0.7,
    0.6,
    0.5,
    0.4,
    0.3,
    0.2,
    0.1,
    0.09,
    0.08,
    0.07,
    0.06,
    0.05,
    0.04,
    0,
  ]

  const retained = pvalues
    .sort((a, b) => associationPvalueSortValue(a) - associationPvalueSortValue(b))
    .slice(0, 15)

  assert.equal(retained[0], 0)
  assert.equal(retained.includes(undefined), false)
})
