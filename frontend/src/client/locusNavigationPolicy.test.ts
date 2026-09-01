import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getPhenotypeLocusNavigationDecision,
  type PhenotypeLocusNavigationDecision,
} from './Manhattan/locusNavigationPolicy'
import type { UnifiedGene, UnifiedLocus } from './Manhattan/types'

const analysisId = 'heart-rate-mean'

const gene = (
  gene_id: string,
  gene_symbol: string,
  evidence: 'none' | 'coding' | 'burden' = 'none'
): UnifiedGene => ({
  gene_id,
  gene_symbol,
  distance_kb: 1,
  ...(evidence === 'coding'
    ? { exome_coding_hits: { lof: 0, missense: 1 } }
    : {}),
  ...(evidence === 'burden'
    ? {
        burden_results: [{
          annotation: 'pLoF',
          max_maf: 0.001,
          mac: 10,
          mac_case: 4,
          mac_control: 6,
          pvalue: 1e-8,
        }],
      }
    : {}),
})

const locus = (
  genes: UnifiedGene[],
  overrides: Partial<UnifiedLocus> = {}
): UnifiedLocus => ({
  locus_id: '1_100_200',
  variant_count: 20,
  sig_variant_count: 3,
  contig: 'chr1',
  start: 100,
  stop: 200,
  position: 150,
  pvalue_genome: 1e-9,
  genes,
  ...overrides,
})

const stateOf = (decision: PhenotypeLocusNavigationDecision) => decision.state

const expectedLocusState = (regionId: string) => ({
  analysisId,
  geneId: null,
  regionId,
  variantId: null,
})

const expectedGeneState = (geneId: string) => ({
  analysisId,
  geneId,
  regionId: null,
  variantId: null,
})

test('nearby gene click opens its exact containing locus, not a gene page', () => {
  const decision = getPhenotypeLocusNavigationDecision({
    analysisId,
    locus: locus([gene('ENSG_NEAR', 'NEARBY')]),
    interaction: { kind: 'gene', geneId: 'ENSG_NEAR' },
  })

  assert.equal(decision.kind, 'locus')
  assert.deepEqual(stateOf(decision), expectedLocusState('chr1-100-200'))
  assert.equal(
    decision.destinationLabel,
    'Nearby gene NEARBY; open containing locus chr1-100-200'
  )
})

test('evidence-free nearest peak label opens the containing locus', () => {
  const decision = getPhenotypeLocusNavigationDecision({
    analysisId,
    locus: locus([gene('ENSG_NEAREST', 'NEAREST')]),
    interaction: { kind: 'peak' },
  })

  assert.deepEqual(stateOf(decision), expectedLocusState('chr1-100-200'))
  assert.equal(
    decision.destinationLabel,
    'Nearest gene label NEAREST; open containing locus chr1-100-200'
  )
})

test('single coding-evidence peak opens the evidence-bearing gene without a causal claim', () => {
  const decision = getPhenotypeLocusNavigationDecision({
    analysisId,
    locus: locus([gene('ENSG00000156966', 'B3GNT7', 'coding')]),
    interaction: { kind: 'peak' },
  })

  assert.deepEqual(stateOf(decision), expectedGeneState('ENSG00000156966'))
  assert.equal(
    decision.destinationLabel,
    'open B3GNT7 gene details — coding single-variant evidence'
  )
  assert.match(decision.tooltip, /does not establish causality/)
})

test('single significant-burden peak opens the evidence-bearing gene', () => {
  const decision = getPhenotypeLocusNavigationDecision({
    analysisId,
    locus: locus([gene('ENSG_BURDEN', 'BURDEN', 'burden')]),
    interaction: { kind: 'peak' },
  })

  assert.deepEqual(stateOf(decision), expectedGeneState('ENSG_BURDEN'))
  assert.equal(
    decision.destinationLabel,
    'open BURDEN gene details — significant burden evidence'
  )
})

test('multi-implicated GENE +N primary peak click opens the locus', () => {
  const decision = getPhenotypeLocusNavigationDecision({
    analysisId,
    locus: locus([
      gene('ENSG_ONE', 'ONE', 'coding'),
      gene('ENSG_TWO', 'TWO', 'burden'),
    ]),
    interaction: { kind: 'peak' },
  })

  assert.deepEqual(stateOf(decision), expectedLocusState('chr1-100-200'))
  assert.equal(
    decision.destinationLabel,
    '2 implicated genes; open containing locus chr1-100-200'
  )
  assert.match(decision.tooltip, /Right-click to choose a named gene/)
})

test('burden-only synthetic row or diamond opens its implicated gene', () => {
  const burdenOnly = locus(
    [gene('ENSG_SYNTHETIC', 'SYNTHETIC', 'burden')],
    { pvalue_genome: undefined, pvalue_exome: undefined }
  )

  for (const interaction of [{ kind: 'locus' }, { kind: 'peak' }] as const) {
    const decision = getPhenotypeLocusNavigationDecision({
      analysisId,
      locus: burdenOnly,
      interaction,
    })
    assert.deepEqual(stateOf(decision), expectedGeneState('ENSG_SYNTHETIC'))
    assert.equal(
      decision.destinationLabel,
      'Burden-only gene result; open SYNTHETIC gene details — significant burden evidence'
    )
  }
})

test('reported ZBTB8OSP2 fixture preserves heart-rate locus and clears gene/variant', () => {
  const heartRateLocus = locus(
    [
      gene('ENSG00000156966', 'B3GNT7', 'coding'),
      gene('ENSG00000172799', 'ZBTB8OSP2'),
    ],
    {
      locus_id: '2_230399262_232399262',
      contig: 'chr2',
      start: 230399262,
      stop: 232399262,
      position: 231399262,
      pvalue_exome: 4.416479283310291e-10,
      pvalue_genome: undefined,
    }
  )

  const nearby = getPhenotypeLocusNavigationDecision({
    analysisId,
    locus: heartRateLocus,
    interaction: { kind: 'gene', geneId: 'ENSG00000172799' },
  })
  assert.deepEqual(
    nearby.state,
    expectedLocusState('chr2-230399262-232399262')
  )
  assert.equal(
    nearby.destinationLabel,
    'Nearby gene ZBTB8OSP2; open containing locus chr2-230399262-232399262'
  )

  const coding = getPhenotypeLocusNavigationDecision({
    analysisId,
    locus: heartRateLocus,
    interaction: { kind: 'gene', geneId: 'ENSG00000156966' },
  })
  assert.deepEqual(coding.state, expectedGeneState('ENSG00000156966'))
  assert.equal(coding.evidenceClass, 'coding')
  assert.match(coding.destinationLabel, /coding single-variant evidence/)
})
