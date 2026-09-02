import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

import {
  getPhewasEmptyStateMessage,
  shouldRenderVariantPhewas,
  VARIANT_ASSOCIATION_EMPTY_MESSAGE,
  VARIANT_ASSOCIATION_THRESHOLD_SOURCE,
} from './PhenotypeList/phewasDisplay'

const variantPhewasSource = readFileSync(
  join(__dirname, 'VariantPage/VariantPhewas.tsx'),
  'utf8'
)

test('true zero unfiltered variant associations collapse the PheWAS surface', () => {
  assert.equal(shouldRenderVariantPhewas(0), false)
  assert.match(
    variantPhewasSource,
    /hasUnfilteredAssociations \? \(\s*<Phewas[\s\S]*?\) : \(\s*<EmptyAssociationsCallout role="status">/
  )
  assert.match(
    variantPhewasSource,
    /shouldRenderVariantPhewas\(variantAssociations\.data\.length\)/
  )
})

test('filtered-to-zero remains distinct and tells the user filters hid API rows', () => {
  assert.equal(
    getPhewasEmptyStateMessage({
      unfilteredAssociationCount: 3,
      displayedAssociationCount: 0,
      fallbackMessage: 'No associations found',
    }),
    'Filters hid all 3 associations. Adjust or clear filters to show them.'
  )
  assert.equal(
    getPhewasEmptyStateMessage({
      unfilteredAssociationCount: 0,
      displayedAssociationCount: 0,
      fallbackMessage: 'No associations found',
    }),
    'No associations found'
  )
})

test('cutoff source contract is strict and does not fabricate unavailable API metadata', () => {
  assert.equal(
    VARIANT_ASSOCIATION_THRESHOLD_SOURCE,
    'dataset-configured-strict-cutoff-not-exposed-by-api'
  )
  assert.match(VARIANT_ASSOCIATION_EMPTY_MESSAGE, /below the data pipeline’s configured inclusion p-value threshold/)
  assert.doesNotMatch(VARIANT_ASSOCIATION_EMPTY_MESSAGE, /5\s*(?:e|×\s*10)[−-]?8/i)
})

test('compact empty callout is accessible and uses non-causal wording', () => {
  assert.match(variantPhewasSource, /const EmptyAssociationsCallout = styled\.p/)
  assert.match(variantPhewasSource, /margin: 4px 0 12px;/)
  assert.match(variantPhewasSource, /padding: 10px 12px;/)
  assert.match(variantPhewasSource, /<EmptyAssociationsCallout role="status">/)
  assert.match(VARIANT_ASSOCIATION_EMPTY_MESSAGE, /does not establish that the variant has no effect/)
})

test('nonempty variant associations retain the existing PheWAS behavior', () => {
  assert.equal(shouldRenderVariantPhewas(1), true)
  assert.equal(shouldRenderVariantPhewas(25), true)
  assert.match(variantPhewasSource, /exportFileName=\{`variant-phewas-exomes_\$\{variantId\}`\}/)
  assert.match(variantPhewasSource, /layoutMode=\{getVariantPhewasLayoutMode\(layout\)\}/)
  assert.match(variantPhewasSource, /phewasType="variant"/)
})
