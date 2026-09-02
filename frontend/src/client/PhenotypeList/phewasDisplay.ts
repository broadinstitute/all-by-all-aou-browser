export type PhewasType = 'gene' | 'variant' | 'topHit' | 'locus'

/**
 * The significant-variant cutoff is runtime pipeline configuration and is not
 * exposed by the variant PheWAS endpoint. Do not duplicate the checked-in
 * config's 5e-8 setting here: other ingests can use a different strict cutoff.
 *
 * Sources: genohype/cli/src/manhattan/config.rs (configurable threshold),
 * genohype/cli/src/distributed/worker/handlers/manhattan.rs (strict `<`), and
 * axaou-server/src/variants/phewas.rs (row-only API response).
 */
export const VARIANT_ASSOCIATION_THRESHOLD_SOURCE =
  'dataset-configured-strict-cutoff-not-exposed-by-api' as const

export const VARIANT_ASSOCIATION_EMPTY_MESSAGE =
  'No variant associations were found below the data pipeline’s configured inclusion p-value threshold. This absence of loaded associations does not establish that the variant has no effect.'

/** Collapse Variant PheWAS only when the unfiltered API result itself is empty. */
export const shouldRenderVariantPhewas = (unfilteredAssociationCount: number): boolean =>
  unfilteredAssociationCount > 0

/** Explain a filter-created empty view without misrepresenting it as empty source data. */
export const getPhewasEmptyStateMessage = ({
  unfilteredAssociationCount,
  displayedAssociationCount,
  fallbackMessage,
}: {
  unfilteredAssociationCount: number
  displayedAssociationCount: number
  fallbackMessage: string
}): string => {
  if (unfilteredAssociationCount > 0 && displayedAssociationCount === 0) {
    const associationLabel = unfilteredAssociationCount === 1 ? 'association' : 'associations'
    return `Filters hid all ${unfilteredAssociationCount} ${associationLabel}. Adjust or clear filters to show them.`
  }
  return fallbackMessage
}

interface AnalysisRow {
  analysis_id: string
}

/** Keep the transient mobile drawer independent from the saved desktop panel state. */
export const resolvePhewasControlsOpen = (
  isMobile: boolean,
  mobileDrawerOpen: boolean,
  desktopPanelOpen: boolean
): boolean => (isMobile ? mobileDrawerOpen : desktopPanelOpen)

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
