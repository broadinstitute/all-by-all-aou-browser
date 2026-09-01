import assert from 'node:assert/strict'
import test from 'node:test'

import {
  GENE_NAME_COLUMN_MIN_WIDTH_PX,
  geneNameForResult,
  geneNameTextStyle,
} from './GeneResults/geneResultColumnLayout'

test('gene name column contains long identifiers without covering its neighbor', () => {
  assert.equal(GENE_NAME_COLUMN_MIN_WIDTH_PX, 140)
  assert.equal(geneNameTextStyle.minWidth, 0)
  assert.equal(geneNameTextStyle.maxWidth, '100%')
  assert.equal(geneNameTextStyle.overflow, 'hidden')
  assert.equal(geneNameTextStyle.textOverflow, 'ellipsis')
  assert.equal(geneNameTextStyle.whiteSpace, 'nowrap')
})

test('gene name display and CSV fallback retain complete symbols and Ensembl IDs', () => {
  assert.equal(
    geneNameForResult({ gene_symbol: 'BRCA1', gene_id: 'ENSG00000012048' }),
    'BRCA1'
  )
  assert.equal(
    geneNameForResult({ gene_symbol: null, gene_id: 'ENSG00000198786' }),
    'ENSG00000198786'
  )
  assert.equal(
    geneNameForResult({ gene_symbol: 'ENSG00000299999', gene_id: 'ENSG00000299999' }),
    'ENSG00000299999'
  )
})
