import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

import {
  getPhewasEmptyStateMessage,
  shouldRenderVariantPhewas,
  VARIANT_ASSOCIATION_EMPTY_MESSAGE,
  VARIANT_ASSOCIATION_INCLUSION_PVALUE,
  VARIANT_ASSOCIATION_THRESHOLD_SOURCE,
} from './PhenotypeList/phewasDisplay'

const variantPhewasSource = readFileSync(
  join(__dirname, 'VariantPage/VariantPhewas.tsx'),
  'utf8'
)
const locusPagePlotsSource = readFileSync(
  join(__dirname, 'GenePage/LocusPagePlots.tsx'),
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

test('empty state reports the exact strict cutoff from the AoU pipeline config', () => {
  assert.equal(
    VARIANT_ASSOCIATION_THRESHOLD_SOURCE,
    'axaou-server/phenotype-data.toml:threshold=5e-8'
  )
  assert.equal(VARIANT_ASSOCIATION_INCLUSION_PVALUE, 5e-8)
  assert.equal(
    VARIANT_ASSOCIATION_EMPTY_MESSAGE,
    'No variant associations were found with p < 5 × 10⁻⁸.'
  )
})

test('interactive region plot uses the loaded-association inclusion threshold', () => {
  assert.match(
    locusPagePlotsSource,
    /thresholds=\{\[\{ color: 'gainsboro', value: VARIANT_ASSOCIATION_INCLUSION_PVALUE, label: '' \}\]\}/
  )
})

test('compact empty callout remains accessible', () => {
  assert.match(variantPhewasSource, /const EmptyAssociationsCallout = styled\.p/)
  assert.match(variantPhewasSource, /margin: 4px 0 12px;/)
  assert.match(variantPhewasSource, /padding: 10px 12px;/)
  assert.match(variantPhewasSource, /<EmptyAssociationsCallout role="status">/)
})

test('nonempty variant associations retain the existing PheWAS behavior', () => {
  assert.equal(shouldRenderVariantPhewas(1), true)
  assert.equal(shouldRenderVariantPhewas(25), true)
  assert.match(variantPhewasSource, /exportFileName=\{`variant-phewas-exomes_\$\{variantId\}`\}/)
  assert.match(variantPhewasSource, /layoutMode=\{getVariantPhewasLayoutMode\(layout\)\}/)
  assert.match(variantPhewasSource, /phewasType="variant"/)
})
