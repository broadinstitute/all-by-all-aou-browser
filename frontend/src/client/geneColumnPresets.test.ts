import assert from 'node:assert/strict'
import test from 'node:test'

import {
  initialAutomaticGeneColumnPresetState,
  resolveAutomaticGeneColumnPreset,
  selectedVariantFieldsForPreset,
  variantFieldGroupForTraitType,
  VariantFieldType,
} from './geneColumnPresets'

test('trait metadata maps recognized values case-insensitively and rejects unknown values', () => {
  assert.equal(variantFieldGroupForTraitType(' continuous '), 'continuous_default')
  assert.equal(variantFieldGroupForTraitType('CONTINUOUS'), 'continuous_default')
  assert.equal(variantFieldGroupForTraitType('categorical'), 'categorical_default')
  assert.equal(variantFieldGroupForTraitType('Binary'), 'categorical_default')
  assert.equal(variantFieldGroupForTraitType('quantitative'), null)
  assert.equal(variantFieldGroupForTraitType(''), null)
  assert.equal(variantFieldGroupForTraitType(undefined), null)
})

test('continuous preset removes categorical columns and deduplicates retained fields', () => {
  const categoricalFields = selectedVariantFieldsForPreset(
    ['consequence', 'pvalue', 'pvalue', 'ac_cases'],
    'categorical_default'
  )
  const continuousFields = selectedVariantFieldsForPreset(
    [...categoricalFields, 'association_af', 'association_af'],
    'continuous_default'
  )

  assert.ok(categoricalFields.includes('ac_cases'))
  assert.ok(categoricalFields.includes('af_controls'))
  assert.ok(!continuousFields.includes('ac_cases'))
  assert.ok(!continuousFields.includes('an_cases'))
  assert.ok(!continuousFields.includes('ac_controls'))
  assert.ok(!continuousFields.includes('an_controls'))
  assert.ok(!continuousFields.includes('af_cases'))
  assert.ok(!continuousFields.includes('af_controls'))
  assert.ok(continuousFields.includes('association_af'))
  assert.equal(new Set(continuousFields).size, continuousFields.length)
})

test('analysis transitions apply once while a manual override remains stable on rerender', () => {
  let automaticState = initialAutomaticGeneColumnPresetState
  let selectedFields: VariantFieldType[] = ['consequence', 'hgvs', 'pvalue', 'beta']

  const continuous = resolveAutomaticGeneColumnPreset(
    automaticState,
    'primary-continuous',
    'continuous'
  )
  automaticState = continuous.state
  assert.equal(continuous.presetToApply, 'continuous_default')
  selectedFields = selectedVariantFieldsForPreset(selectedFields, continuous.presetToApply!)

  // The user chooses Stat. Metadata/query rerenders for the same analysis must
  // not reapply the automatic Continuous choice.
  selectedFields = selectedVariantFieldsForPreset(selectedFields, 'stat')
  const sameAnalysis = resolveAutomaticGeneColumnPreset(
    automaticState,
    'primary-continuous',
    'CONTINUOUS'
  )
  automaticState = sameAnalysis.state
  assert.equal(sameAnalysis.presetToApply, null)
  assert.deepEqual(selectedFields, ['consequence', 'hgvsp', 'pvalue', 'beta'])

  const binary = resolveAutomaticGeneColumnPreset(automaticState, 'primary-binary', 'binary')
  automaticState = binary.state
  assert.equal(binary.presetToApply, 'categorical_default')
  selectedFields = selectedVariantFieldsForPreset(selectedFields, binary.presetToApply!)
  assert.ok(selectedFields.includes('ac_cases'))

  const unknown = resolveAutomaticGeneColumnPreset(automaticState, 'primary-unknown', 'other')
  automaticState = unknown.state
  assert.equal(unknown.presetToApply, null)

  const metadataArrives = resolveAutomaticGeneColumnPreset(
    automaticState,
    'primary-unknown',
    'Categorical'
  )
  assert.equal(metadataArrives.presetToApply, 'categorical_default')

  const revisit = resolveAutomaticGeneColumnPreset(
    metadataArrives.state,
    'primary-continuous',
    'continuous'
  )
  assert.equal(revisit.presetToApply, 'continuous_default')
})
