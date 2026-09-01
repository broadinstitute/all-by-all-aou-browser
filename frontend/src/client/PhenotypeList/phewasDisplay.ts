export type PhewasType = 'gene' | 'variant' | 'topHit' | 'locus'

interface AnalysisRow {
  analysis_id: string
}

/**
 * Whether the persistent comparison set should restrict a PheWAS dataset.
 * Top-hit PheWAS has no comparison controls, so it must ignore shared filter state.
 */
export const shouldShowComparedOnly = (
  showComparedOnly: boolean,
  phewasType: PhewasType,
  comparedAnalysisIds: string[]
): boolean =>
  showComparedOnly && phewasType !== 'topHit' && comparedAnalysisIds.length > 0

/** Filter one independently ordered dataset without adopting the comparison-set order. */
export const filterToComparedPhenotypes = <Row extends AnalysisRow>(
  phenotypes: Row[],
  comparedAnalysisIds: string[],
  enabled: boolean
): Row[] => {
  if (!enabled) return phenotypes

  const comparedIds = new Set(comparedAnalysisIds)
  return phenotypes.filter((phenotype) => comparedIds.has(phenotype.analysis_id))
}

/**
 * Export the table's displayed scientific rows. The caller supplies rows after all
 * table filters, including a plot brush and "Show compared only"; virtualization
 * does not participate because it only controls how many of these rows are mounted.
 */
export const selectPhewasExportRows = <Row>(displayedTableRows: Row[]): Row[] =>
  displayedTableRows

interface TopHitLabelUpdate {
  labeledIds: Set<string>
  activeTopHitId: string | null
}

/** Replace the transient top-hit detail label, including when detail context is cleared. */
export const updateTopHitDetailLabel = (
  labeledIds: Set<string>,
  previousTopHitId: string | null,
  geneId: string | null | undefined,
  analysisId: string | null | undefined
): TopHitLabelUpdate => {
  const nextLabeledIds = new Set(labeledIds)
  if (previousTopHitId) nextLabeledIds.delete(previousTopHitId)

  const activeTopHitId = geneId && analysisId ? `${geneId}:${analysisId}` : null
  if (activeTopHitId) nextLabeledIds.add(activeTopHitId)

  return { labeledIds: nextLabeledIds, activeTopHitId }
}

export type AssociationDetailKind = 'association' | 'variant' | 'locus' | 'topHit'

interface AssociationDetailsRow {
  analysis_id: string
  description?: string | null
  gene_id?: string | null
  gene_symbol?: string | null
}

/** Build detail navigation without coupling it to the persistent comparison state. */
export const getAssociationDetailsNavigation = (
  row: AssociationDetailsRow,
  kind: AssociationDetailKind = 'association'
): {
  analysisId: string
  context: { geneId?: string | null }
} => ({
  analysisId: row.analysis_id,
  context: kind === 'topHit' ? { geneId: row.gene_id } : {},
})

export const getAssociationDetailsAriaLabel = (
  row: Omit<AssociationDetailsRow, 'analysis_id'> & { analysis_id?: string },
  kind: AssociationDetailKind = 'association'
): string => {
  const phenotype = row.description || row.analysis_id || 'phenotype'
  if (kind === 'topHit') {
    const gene = row.gene_symbol || row.gene_id
    return gene
      ? `Open association details for ${phenotype} and ${gene}`
      : `Open association details for ${phenotype}`
  }
  if (kind === 'variant') return `Open variant association details for ${phenotype}`
  if (kind === 'locus') return `Open locus association details for ${phenotype}`
  return `Open association details for ${phenotype}`
}
