export interface ContainingLocus {
  contig: string
  start: number
  stop: number
}

export const getContainingLocusRegionId = (
  locus: ContainingLocus
): string => `${locus.contig}-${locus.start}-${locus.stop}`

/** Complete semantic context for a coding variant selected from a phenotype locus. */
export const getOverviewVariantNavigationState = ({
  variantId,
  geneId,
  analysisId,
  locus,
}: {
  variantId: string
  geneId: string
  analysisId: string
  locus: ContainingLocus
}) => ({
  variantId,
  geneId,
  analysisId,
  regionId: getContainingLocusRegionId(locus),
  resultIndex: 'variant-phewas' as const,
})
