import { useCallback } from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import {
  geneIdAtom,
  regionIdAtom,
  analysisIdAtom,
  variantIdAtom,
  resultIndexAtom,
  resultLayoutAtom,
  ResultIndex,
} from '../sharedState';
import { buildCanonicalNavigationUrl } from '../navigationUrl';

export type EntityType = 'locus' | 'gene' | 'phenotype' | 'variant';
export type NavMode = 'split' | 'full' | 'newTab';

// Special sentinel value to indicate we want to focus the gene page (clear regionId)
export const FOCUS_LOCUS = '__FOCUS_LOCUS__' as any;

// Special sentinel value to indicate we want to focus the region browser pane (keep current state)
export const FOCUS_REGION = '__FOCUS_REGION__' as any;

/**
 * @deprecated Use useAppNavigation instead
 */
export function useContextMenuNavigation() {
  const setGeneId = useSetRecoilState(geneIdAtom);
  const setRegionId = useSetRecoilState(regionIdAtom);
  const setAnalysisId = useSetRecoilState(analysisIdAtom);
  const setVariantId = useSetRecoilState(variantIdAtom);
  const setResultIndex = useSetRecoilState(resultIndexAtom);
  const setResultLayout = useSetRecoilState(resultLayoutAtom);
  const currentAnalysisId = useRecoilValue(analysisIdAtom);
  const currentRegionId = useRecoilValue(regionIdAtom);
  const currentGeneId = useRecoilValue(geneIdAtom);

  return useCallback((entityType: EntityType, id: string, mode: NavMode, targetIndex: ResultIndex | typeof FOCUS_LOCUS | typeof FOCUS_REGION, preserveAnalysisId: boolean = false) => {
    const focusLocusMode = targetIndex === FOCUS_LOCUS;
    const focusRegionMode = targetIndex === FOCUS_REGION;
    const isFocusMode = focusLocusMode || focusRegionMode;

    const stateUpdates: any = {
      resultLayout: isFocusMode
        ? (mode === 'split' ? 'split' : 'detail')
        : (mode === 'split' ? 'split' : 'full')
    };

    if (!isFocusMode) {
      stateUpdates.resultIndex = targetIndex;
    }

    if (!focusRegionMode) {
      if (entityType === 'gene') {
        stateUpdates.geneId = id;
        stateUpdates.regionId = null;
      }
      if (entityType === 'locus') {
        stateUpdates.regionId = id;
        stateUpdates.geneId = null;
      }
      if (entityType === 'phenotype') stateUpdates.analysisId = id;
      if (entityType === 'variant') stateUpdates.variantId = id;
    }

    if (preserveAnalysisId && currentAnalysisId && (targetIndex === 'pheno-info' || targetIndex === 'variant-manhattan')) {
      stateUpdates.analysisId = currentAnalysisId;
    }

    if (mode === 'newTab') {
      if (focusRegionMode) {
        if (currentGeneId) stateUpdates.geneId = currentGeneId;
        if (currentRegionId) stateUpdates.regionId = currentRegionId;
      }

      window.open(
        buildCanonicalNavigationUrl(window.location.href, stateUpdates, {
          preserveKeys: preserveAnalysisId ? ['analysisId'] : [],
        }),
        '_blank'
      );
    } else {
      if (stateUpdates.geneId) setGeneId(stateUpdates.geneId);
      if ('regionId' in stateUpdates) setRegionId(stateUpdates.regionId);
      if (stateUpdates.analysisId) setAnalysisId(stateUpdates.analysisId);
      if (stateUpdates.variantId) setVariantId(stateUpdates.variantId);

      if (stateUpdates.resultIndex) setResultIndex(stateUpdates.resultIndex);
      setResultLayout(stateUpdates.resultLayout);
    }
  }, [setGeneId, setRegionId, setAnalysisId, setVariantId, setResultIndex, setResultLayout, currentAnalysisId, currentRegionId, currentGeneId]);
}
