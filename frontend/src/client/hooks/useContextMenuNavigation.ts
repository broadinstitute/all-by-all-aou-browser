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
  ResultLayout
} from '../sharedState';

export type EntityType = 'locus' | 'gene' | 'phenotype' | 'variant';
export type NavMode = 'split' | 'full' | 'newTab';

// Special sentinel value to indicate we want to focus the gene page (clear regionId)
export const FOCUS_LOCUS = '__FOCUS_LOCUS__' as any;

// Special sentinel value to indicate we want to focus the region browser pane (keep current state)
export const FOCUS_REGION = '__FOCUS_REGION__' as any;

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
        ? (mode === 'split' ? 'half' : 'hidden')  // For focus modes: half=split, hidden=full (focus gene/locus pane)
        : (mode === 'split' ? 'half' : 'full')  // For results: half=split view, full=full screen results (including newTab)
    };

    // Only set resultIndex if we're not in a focus mode
    if (!isFocusMode) {
      stateUpdates.resultIndex = targetIndex;
    }

    // For FOCUS_REGION, don't change any entity IDs, just adjust layout
    if (!focusRegionMode) {
      if (entityType === 'gene') {
        stateUpdates.geneId = id;
        // When focusing on gene page (FOCUS_LOCUS), clear regionId to show gene-centric view
        if (focusLocusMode) {
          stateUpdates.regionId = null;
        }
      }
      if (entityType === 'locus') stateUpdates.regionId = id;
      if (entityType === 'phenotype') stateUpdates.analysisId = id;
      if (entityType === 'variant') stateUpdates.variantId = id;
    }

    // For pheno-info and variant-manhattan, preserve the current analysisId if requested
    if (preserveAnalysisId && currentAnalysisId && (targetIndex === 'pheno-info' || targetIndex === 'variant-manhattan')) {
      stateUpdates.analysisId = currentAnalysisId;
    }

    if (mode === 'newTab') {
      const url = new URL(window.location.href);
      const stateStr = url.searchParams.get('state');
      let stateObj: any = {};
      try {
        if (stateStr) stateObj = JSON.parse(decodeURIComponent(stateStr));
      } catch (e) {}

      // For FOCUS_REGION, preserve current state
      if (focusRegionMode) {
        // Keep current geneId and regionId for FOCUS_REGION
        if (currentGeneId) stateObj.geneId = currentGeneId;
        if (currentRegionId) stateObj.regionId = currentRegionId;
      } else {
        // Clean stale entity ids to prevent state conflicts
        delete stateObj.geneId;
        delete stateObj.regionId;
        delete stateObj.variantId;
      }

      // Only clean analysisId if we're not preserving it
      if (!preserveAnalysisId) {
        delete stateObj.analysisId;
      }

      Object.assign(stateObj, stateUpdates);
      url.searchParams.set('state', JSON.stringify(stateObj));

      // Clean top-level query params just in case
      url.searchParams.delete('regionId');
      url.searchParams.delete('resultLayout');
      url.searchParams.delete('geneId');

      window.open(url.toString(), '_blank');
    } else {
      if (stateUpdates.geneId) setGeneId(stateUpdates.geneId);
      if ('regionId' in stateUpdates) setRegionId(stateUpdates.regionId);  // Allow setting to null
      if (stateUpdates.analysisId) setAnalysisId(stateUpdates.analysisId);
      if (stateUpdates.variantId) setVariantId(stateUpdates.variantId);

      if (stateUpdates.resultIndex) setResultIndex(stateUpdates.resultIndex);
      setResultLayout(stateUpdates.resultLayout);
    }
  }, [setGeneId, setRegionId, setAnalysisId, setVariantId, setResultIndex, setResultLayout, currentAnalysisId, currentRegionId, currentGeneId]);
}
