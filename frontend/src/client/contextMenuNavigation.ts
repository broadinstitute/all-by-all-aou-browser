import type { ResultIndex } from './sharedState'

export type EntityType = 'locus' | 'gene' | 'phenotype' | 'variant'

export const FOCUS_LOCUS = '__FOCUS_LOCUS__' as const
export const FOCUS_REGION = '__FOCUS_REGION__' as const

export type ContextMenuTarget =
  | ResultIndex
  | typeof FOCUS_LOCUS
  | typeof FOCUS_REGION

type EntityContext = {
  geneId?: string | null
  regionId?: string | null
  variantId?: string | null
  analysisId?: string | null
}

export type ContextMenuNavigation = {
  stateUpdates: EntityContext & { resultIndex?: ResultIndex }
  destination: 'results' | 'details'
}

/**
 * Build the complete entity state for a context-menu destination.
 *
 * Returning explicit nulls is intentional: current-tab Recoil transactions and
 * canonical new-tab URLs must clear the same stale context. Focus Region is the
 * exception because that action means "show the current details context".
 */
export const getContextMenuNavigation = (
  entityType: EntityType,
  id: string,
  targetIndex: ContextMenuTarget,
  currentContext: EntityContext,
  preserveAnalysisId = false
): ContextMenuNavigation => {
  if (targetIndex === FOCUS_REGION) {
    return {
      stateUpdates: {
        geneId: currentContext.geneId ?? null,
        regionId: currentContext.regionId ?? null,
        variantId: currentContext.variantId ?? null,
        analysisId: currentContext.analysisId ?? null,
      },
      destination: 'details',
    }
  }

  const stateUpdates: ContextMenuNavigation['stateUpdates'] = {
    geneId: null,
    regionId: null,
    variantId: null,
    analysisId: null,
  }

  if (entityType === 'gene') stateUpdates.geneId = id
  if (entityType === 'locus') stateUpdates.regionId = id
  if (entityType === 'phenotype') stateUpdates.analysisId = id
  if (entityType === 'variant') stateUpdates.variantId = id

  if (targetIndex !== FOCUS_LOCUS) stateUpdates.resultIndex = targetIndex
  if (preserveAnalysisId) {
    stateUpdates.analysisId = currentContext.analysisId ?? null
  }

  return {
    stateUpdates,
    destination: targetIndex === FOCUS_LOCUS ? 'details' : 'results',
  }
}
