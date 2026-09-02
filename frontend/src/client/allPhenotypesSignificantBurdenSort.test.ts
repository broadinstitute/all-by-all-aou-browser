import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

import {
  ALL_PHENOTYPES_DEFAULT_SORT,
  initialAllPhenotypesSortState,
  nextAllPhenotypesSortState,
  sortAllPhenotypesRows,
} from './PhenotypeList/allPhenotypesSort'

type Row = {
  analysis_id: string
  description: string
  sig_genes_count: number
}

const rows: Row[] = [
  { analysis_id: 'low', description: 'Alpha', sig_genes_count: 1 },
  { analysis_id: 'high-first', description: 'Zulu', sig_genes_count: 8 },
  { analysis_id: 'high-second', description: 'Beta', sig_genes_count: 8 },
  { analysis_id: 'middle', description: 'Gamma', sig_genes_count: 4 },
]

test('fresh All Phenotypes sorts significant burden-gene counts descending', () => {
  const freshSort = initialAllPhenotypesSortState()

  assert.deepEqual(freshSort, {
    sortKey: 'sig_genes_count',
    sortOrder: 'descending',
  })
  assert.deepEqual(
    sortAllPhenotypesRows(rows, freshSort).map((row) => row.sig_genes_count),
    [8, 8, 4, 1]
  )
})

test('explicit and manual All Phenotypes sorts win for the mounted visit', () => {
  const explicit = initialAllPhenotypesSortState({
    sortKey: 'description',
    sortOrder: 'ascending',
  })
  assert.deepEqual(explicit, { sortKey: 'description', sortOrder: 'ascending' })

  const manual = nextAllPhenotypesSortState(ALL_PHENOTYPES_DEFAULT_SORT, 'description')
  assert.deepEqual(manual, { sortKey: 'description', sortOrder: 'descending' })
  assert.deepEqual(
    sortAllPhenotypesRows(rows, manual).map((row) => row.description),
    ['Zulu', 'Gamma', 'Beta', 'Alpha']
  )

  const toggled = nextAllPhenotypesSortState(manual, 'description')
  assert.deepEqual(toggled, { sortKey: 'description', sortOrder: 'ascending' })
})

test('a fresh revisit resets All Phenotypes to its significant burden-gene default', () => {
  const manual = nextAllPhenotypesSortState(ALL_PHENOTYPES_DEFAULT_SORT, 'analysis_id')
  assert.notDeepEqual(manual, ALL_PHENOTYPES_DEFAULT_SORT)
  assert.deepEqual(initialAllPhenotypesSortState(), ALL_PHENOTYPES_DEFAULT_SORT)
})

test('equal All Phenotypes values retain deterministic source order', () => {
  const sorted = sortAllPhenotypesRows(rows, ALL_PHENOTYPES_DEFAULT_SORT)
  assert.deepEqual(
    sorted.filter((row) => row.sig_genes_count === 8).map((row) => row.analysis_id),
    ['high-first', 'high-second']
  )
})

test('other top-result tabs retain their existing sort defaults', () => {
  const allGenesSource = readFileSync(join(__dirname, 'GeneResults/AllGenesTab.tsx'), 'utf8')
  const topGeneBurdenSource = readFileSync(join(__dirname, 'PhenotypeList/Phewas.tsx'), 'utf8')
  const topVariantsSource = readFileSync(
    join(__dirname, 'VariantResults/TopVariantsTable.tsx'),
    'utf8'
  )

  assert.match(allGenesSource, /useState\('sig_phenos_burden_plof'\)/)
  assert.match(allGenesSource, /useState<'ascending' \| 'descending'>\('descending'\)/)
  assert.match(topGeneBurdenSource, /useState\('pvalue'\)/)
  assert.match(topGeneBurdenSource, /useState\('ascending'\)/)
  assert.match(topVariantsSource, /useState\('num_associations'\)/)
  assert.match(topVariantsSource, /useState<'ascending' \| 'descending'>\('descending'\)/)
})
