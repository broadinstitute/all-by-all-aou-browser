import { useCallback } from 'react';
import { useRecoilValue } from 'recoil';
import {
  analysisIdAtom,
  geneIdAtom,
  regionIdAtom,
  variantIdAtom,
} from '../sharedState';
import {
  ContextMenuTarget,
  EntityType,
  getContextMenuNavigation,
} from '../contextMenuNavigation';
import { NavMode, useAppNavigation } from './useAppNavigation';

export type { EntityType } from '../contextMenuNavigation';
export { FOCUS_LOCUS, FOCUS_REGION } from '../contextMenuNavigation';

/**
 * Compatibility adapter for existing context-menu descriptions. Presentation
 * and URL rules are delegated to the same semantic navigation helper as row
 * clicks and search.
 */
export function useContextMenuNavigation() {
  const currentAnalysisId = useRecoilValue(analysisIdAtom);
  const currentRegionId = useRecoilValue(regionIdAtom);
  const currentGeneId = useRecoilValue(geneIdAtom);
  const currentVariantId = useRecoilValue(variantIdAtom);
  const { navigateToState, openInNewTab } = useAppNavigation();

  return useCallback(
    (
      entityType: EntityType,
      id: string,
      mode: NavMode,
      targetIndex: ContextMenuTarget,
      preserveAnalysisId = false
    ) => {
      const navigation = getContextMenuNavigation(
        entityType,
        id,
        targetIndex,
        {
          analysisId: currentAnalysisId,
          regionId: currentRegionId,
          geneId: currentGeneId,
          variantId: currentVariantId,
        },
        preserveAnalysisId
      );
      const presentation = { destination: navigation.destination };

      if (mode === 'newTab') {
        openInNewTab(navigation.stateUpdates, presentation);
      } else {
        navigateToState(navigation.stateUpdates, presentation);
      }
    },
    [
      currentAnalysisId,
      currentRegionId,
      currentGeneId,
      currentVariantId,
      navigateToState,
      openInNewTab,
    ]
  );
}
