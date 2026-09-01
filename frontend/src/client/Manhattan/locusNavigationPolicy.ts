import type { UnifiedGene, UnifiedLocus } from './types'

export const PHENOTYPE_BURDEN_SIGNIFICANCE_THRESHOLD = 2.5e-6

export type GeneEvidenceClass =
  | 'none'
  | 'coding'
  | 'burden'
  | 'coding-and-burden'

export interface PhenotypeLocusDestinationState {
  analysisId: string
  geneId: string | null
  regionId: string | null
  variantId: null
}

export interface PhenotypeLocusNavigationDecision {
  destination: 'details'
  kind: 'gene' | 'locus'
  evidenceClass: GeneEvidenceClass | 'multiple-implicated'
  state: PhenotypeLocusDestinationState
  /** Concise accessible wording suitable for aria-label. */
  destinationLabel: string
  /** Scientifically explicit wording suitable for a title/tooltip. */
  tooltip: string
}

export type PhenotypeLocusInteraction =
  | { kind: 'gene'; geneId: string }
  | { kind: 'locus' }
  | { kind: 'peak' }

const significantBurdenPvalues = (gene: UnifiedGene): number[] =>
  (gene.burden_results ?? []).flatMap((result) => [
    result.pvalue ?? Infinity,
    result.pvalue_burden ?? Infinity,
    result.pvalue_skat ?? Infinity,
  ])

export const getSignificantBurdenTypes = (gene: UnifiedGene): string[] => {
  const types = new Set<string>()
  for (const result of gene.burden_results ?? []) {
    if (
      Math.min(
        result.pvalue ?? Infinity,
        result.pvalue_burden ?? Infinity,
        result.pvalue_skat ?? Infinity
      ) < PHENOTYPE_BURDEN_SIGNIFICANCE_THRESHOLD
    ) {
      types.add(result.annotation)
    }
  }
  return [...types]
}

export const getGeneCodingEvidenceCount = (gene: UnifiedGene): number =>
  (gene.genome_coding_hits?.lof ?? 0) +
  (gene.genome_coding_hits?.missense ?? 0) +
  (gene.exome_coding_hits?.lof ?? 0) +
  (gene.exome_coding_hits?.missense ?? 0)

export const getGeneEvidenceClass = (
  gene: UnifiedGene
): GeneEvidenceClass => {
  const hasBurden = significantBurdenPvalues(gene).some(
    (pvalue) => pvalue < PHENOTYPE_BURDEN_SIGNIFICANCE_THRESHOLD
  )
  const hasCoding = getGeneCodingEvidenceCount(gene) > 0
  if (hasBurden && hasCoding) return 'coding-and-burden'
  if (hasBurden) return 'burden'
  if (hasCoding) return 'coding'
  return 'none'
}

export const geneHasDisplayedPhenotypeEvidence = (
  gene: UnifiedGene
): boolean => getGeneEvidenceClass(gene) !== 'none'

export const isBurdenOnlyLocus = (locus: UnifiedLocus): boolean =>
  locus.pvalue_genome == null && locus.pvalue_exome == null

export const getPhenotypeLocusRegionId = (
  locus: Pick<UnifiedLocus, 'contig' | 'start' | 'stop'>
): string => `${locus.contig}-${locus.start}-${locus.stop}`

const geneEvidenceWording = (evidenceClass: GeneEvidenceClass): string => {
  if (evidenceClass === 'coding') return 'coding single-variant evidence'
  if (evidenceClass === 'burden') return 'significant burden evidence'
  if (evidenceClass === 'coding-and-burden') {
    return 'coding single-variant and significant burden evidence'
  }
  return 'no displayed burden or coding evidence'
}

const geneDecision = (
  analysisId: string,
  gene: UnifiedGene,
  evidenceClass: Exclude<GeneEvidenceClass, 'none'>,
  burdenOnly: boolean
): PhenotypeLocusNavigationDecision => {
  const evidence = geneEvidenceWording(evidenceClass)
  const prefix = burdenOnly ? 'Burden-only gene result; ' : ''
  return {
    destination: 'details',
    kind: 'gene',
    evidenceClass,
    state: {
      analysisId,
      geneId: gene.gene_id,
      regionId: null,
      variantId: null,
    },
    destinationLabel: `${prefix}open ${gene.gene_symbol} gene details — ${evidence}`,
    tooltip: `${gene.gene_symbol} has displayed ${evidence} for this phenotype; open gene details. Association evidence does not establish causality.`,
  }
}

const locusDecision = (
  analysisId: string,
  locus: UnifiedLocus,
  evidenceClass: GeneEvidenceClass | 'multiple-implicated',
  destinationLabel: string,
  tooltip: string
): PhenotypeLocusNavigationDecision => {
  const regionId = getPhenotypeLocusRegionId(locus)
  return {
    destination: 'details',
    kind: 'locus',
    evidenceClass,
    state: {
      analysisId,
      geneId: null,
      regionId,
      variantId: null,
    },
    destinationLabel,
    tooltip,
  }
}

/**
 * Decide where a phenotype Manhattan/locus click may navigate without turning
 * proximity into gene-level evidence. This is the single policy used by both
 * the overview peak labels and the unified locus table.
 */
export const getPhenotypeLocusNavigationDecision = ({
  analysisId,
  locus,
  interaction,
}: {
  analysisId: string
  locus: UnifiedLocus
  interaction: PhenotypeLocusInteraction
}): PhenotypeLocusNavigationDecision => {
  const implicatedGenes = locus.genes.filter(geneHasDisplayedPhenotypeEvidence)
  const burdenOnly = isBurdenOnlyLocus(locus)
  const regionId = getPhenotypeLocusRegionId(locus)

  if (interaction.kind === 'gene') {
    const gene = locus.genes.find(({ gene_id }) => gene_id === interaction.geneId)
    if (!gene) {
      return locusDecision(
        analysisId,
        locus,
        'none',
        `Open containing locus ${regionId}`,
        `The selected gene is not present in this locus payload; open containing locus ${regionId}.`
      )
    }
    const evidenceClass = getGeneEvidenceClass(gene)
    if (evidenceClass !== 'none') {
      return geneDecision(analysisId, gene, evidenceClass, burdenOnly)
    }
    return locusDecision(
      analysisId,
      locus,
      'none',
      `Nearby gene ${gene.gene_symbol}; open containing locus ${regionId}`,
      `${gene.gene_symbol} is nearby and has no displayed burden or coding evidence for this signal; open containing locus ${regionId}.`
    )
  }

  if (burdenOnly && implicatedGenes.length === 1) {
    const gene = implicatedGenes[0]
    return geneDecision(
      analysisId,
      gene,
      getGeneEvidenceClass(gene) as Exclude<GeneEvidenceClass, 'none'>,
      true
    )
  }

  if (interaction.kind === 'peak') {
    if (implicatedGenes.length === 1) {
      const gene = implicatedGenes[0]
      return geneDecision(
        analysisId,
        gene,
        getGeneEvidenceClass(gene) as Exclude<GeneEvidenceClass, 'none'>,
        false
      )
    }
    if (implicatedGenes.length > 1) {
      return locusDecision(
        analysisId,
        locus,
        'multiple-implicated',
        `${implicatedGenes.length} implicated genes; open containing locus ${regionId}`,
        `${implicatedGenes.length} genes have displayed evidence; open locus ${regionId}. Right-click to choose a named gene. No single gene is implied by this label.`
      )
    }
    const nearest = locus.genes[0]
    return locusDecision(
      analysisId,
      locus,
      'none',
      `Nearest gene label${nearest ? ` ${nearest.gene_symbol}` : ''}; open containing locus ${regionId}`,
      `Nearest-gene labeling is positional only and does not imply association; open containing locus ${regionId}.`
    )
  }

  return locusDecision(
    analysisId,
    locus,
    implicatedGenes.length > 1 ? 'multiple-implicated' : 'none',
    `Open locus details ${regionId} for this phenotype`,
    `Open the exact containing locus ${regionId}; phenotype context is preserved.`
  )
}
