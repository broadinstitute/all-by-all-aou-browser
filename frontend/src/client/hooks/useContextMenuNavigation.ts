import { useCallback } from 'react';
import { useRecoilValue } from 'recoil';
import {
  analysisIdAtom,
  geneIdAtom,
  regionIdAtom,
  ResultIndex,
} from '../sharedState';
import { useAppNavigation } from './useAppNavigation';

export type EntityType = 'locus' | 'gene' | 'phenotype' | 'variant';
export type NavMode = 'split' | 'full' | 'newTab';

// Special sentinel value to indicate we want to focus the gene page (clear regionId)
export const FOCUS_LOCUS = '__FOCUS_LOCUS__' as const;

// Special sentinel value to indicate we want to focus the region browser pane (keep current state)
export const FOCUS_REGION = '__FOCUS_REGION__' as const;

/**
 * Compatibility adapter for existing context-menu descriptions. Presentation
 * and URL rules are delegated to the same semantic navigation helper as row
 * clicks and search.
 */
export function useContextMenuNavigation() {
  const currentAnalysisId = useRecoilValue(analysisIdAtom);
  const currentRegionId = useRecoilValue(regionIdAtom);
  const currentGeneId = useRecoilValue(geneIdAtom);
  const { navigateToState, openInNewTab } = useAppNavigation();

  return useCallback(
    (
      entityType: EntityType,
      id: string,
      mode: NavMode,
      targetIndex: ResultIndex | typeof FOCUS_LOCUS | typeof FOCUS_REGION,
      preserveAnalysisId = false
    ) => {
      const focusLocusMode = targetIndex === FOCUS_LOCUS;
      const focusRegionMode = targetIndex === FOCUS_REGION;
      const isDetailsDestination = focusLocusMode || focusRegionMode;
      const stateUpdates: Record<string, any> = {};

      if (!isDetailsDestination) stateUpdates.resultIndex = targetIndex;

      if (focusRegionMode) {
        stateUpdates.geneId = currentGeneId ?? null;
        stateUpdates.regionId = currentRegionId ?? null;
      } else if (entityType === 'gene') {
        stateUpdates.geneId = id;
        stateUpdates.regionId = null;
        stateUpdates.variantId = null;
      } else if (entityType === 'locus') {
        stateUpdates.regionId = id;
        stateUpdates.geneId = null;
        stateUpdates.variantId = null;
      } else if (entityType === 'phenotype') {
        stateUpdates.analysisId = id;
      } else if (entityType === 'variant') {
        stateUpdates.variantId = id;
      }

      if (preserveAnalysisId && currentAnalysisId) {
        stateUpdates.analysisId = currentAnalysisId;
      }

      const presentation = {
        destination: isDetailsDestination ? ('details' as const) : ('results' as const),
        resultsOnly: mode === 'full',
      };

      if (mode === 'newTab') {
        openInNewTab(stateUpdates, presentation);
      } else {
        navigateToState(stateUpdates, presentation);
      }
    },
    [
      currentAnalysisId,
      currentRegionId,
      currentGeneId,
      navigateToState,
      openInNewTab,
    ]
  );
}
