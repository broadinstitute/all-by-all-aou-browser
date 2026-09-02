import assert from 'node:assert/strict'
import test from 'node:test'

import {
  isBurdenAnnotationSelected,
  setBurdenAnnotationSelected,
} from './GenePage/burdenMembershipFilters'
import filterVariants from './VariantList/filterVariants'
import type { VariantJoined } from './types'
import type { MembershipFilterOptions } from './variantState'

const emptyFilters = (): MembershipFilterOptions => ({
  pLoF: false,
  missense: false,
  synonymous: false,
  'non-coding': false,
})

const variants = [
  { variant_id: 'lof', consequence: 'stop_gained' },
  { variant_id: 'missense', consequence: 'missense_variant' },
  { variant_id: 'synonymous', consequence: 'synonymous_variant' },
] as VariantJoined[]

const variantFilter = {
  includeCategories: {
    lof: true,
    missense: true,
    synonymous: true,
    other: true,
  },
  searchText: '',
}

const filteredIds = (filters: MembershipFilterOptions) =>
  filterVariants(variants, variantFilter, filters).map((variant) => variant.variant_id)

test('missenseLC burden checkbox selects the variant filter missense key', () => {
  const filters = setBurdenAnnotationSelected('missenseLC', true, emptyFilters())

  assert.deepEqual(filters, { ...emptyFilters(), missense: true })
  assert.equal(isBurdenAnnotationSelected('missenseLC', filters), true)
  assert.deepEqual(filteredIds(filters), ['missense'])
})

test('combined pLoF and missenseLC checkbox selects both variant categories', () => {
  const filters = setBurdenAnnotationSelected('pLoF;missenseLC', true, emptyFilters())

  assert.deepEqual(filters, { ...emptyFilters(), pLoF: true, missense: true })
  assert.equal(isBurdenAnnotationSelected('pLoF;missenseLC', filters), true)
  assert.deepEqual(filteredIds(filters), ['lof', 'missense'])
})

test('combined checkbox is selected only when both categories are selected', () => {
  const onlyPlof = setBurdenAnnotationSelected('pLoF', true, emptyFilters())
  assert.equal(isBurdenAnnotationSelected('pLoF;missenseLC', onlyPlof), false)

  const both = setBurdenAnnotationSelected('missenseLC', true, onlyPlof)
  assert.equal(isBurdenAnnotationSelected('pLoF;missenseLC', both), true)
})
