import { useCallback } from 'react';
import { useSetRecoilState } from 'recoil';
import {
  geneIdAtom,
  regionIdAtom,
  variantIdAtom,
  analysisIdAtom,
  resultIndexAtom,
  resultLayoutAtom,
  ResultIndex,
} from '../sharedState';
import { buildCanonicalNavigationUrl, buildStateUrl } from '../navigationUrl';
import { revealDetailsPane, revealResultsPane } from '../paneLayout';

export { buildStateUrl };

export type NavMode = 'split' | 'full' | 'newTab';

export function useAppNavigation() {
  const setGeneId = useSetRecoilState(geneIdAtom);
  const setRegionId = useSetRecoilState(regionIdAtom);
  const setVariantId = useSetRecoilState(variantIdAtom);
  const setAnalysisId = useSetRecoilState(analysisIdAtom);
  const setResultIndex = useSetRecoilState(resultIndexAtom);
  const setResultLayout = useSetRecoilState(resultLayoutAtom);

  const openDetailPane = useCallback(() => {
    setResultLayout(revealDetailsPane);
  }, [setResultLayout]);

  const openResultsPane = useCallback(() => {
    setResultLayout(revealResultsPane);
  }, [setResultLayout]);

  const goToGene = useCallback((geneId: string, options?: { fromPhenotype?: boolean; keepVariant?: boolean; resultIndex?: ResultIndex }) => {
    setGeneId(geneId);
    setRegionId(null);
    if (!options?.keepVariant) setVariantId(null);
    if (!options?.fromPhenotype) setAnalysisId(null);
    if (options?.resultIndex) {
      setResultIndex(options.resultIndex);
      openResultsPane();
    } else {
      openDetailPane();
    }
  }, [setGeneId, setRegionId, setVariantId, setAnalysisId, setResultIndex, openDetailPane, openResultsPane]);

  const goToRegion = useCallback((regionId: string, options?: { fromPhenotype?: boolean; resultIndex?: ResultIndex }) => {
    setRegionId(regionId);
    setGeneId(null);
    setVariantId(null);
    if (!options?.fromPhenotype) setAnalysisId(null);
    if (options?.resultIndex) {
      setResultIndex(options.resultIndex);
      openResultsPane();
    } else {
      openDetailPane();
    }
  }, [setRegionId, setGeneId, setVariantId, setAnalysisId, setResultIndex, openDetailPane, openResultsPane]);

  const goToVariant = useCallback((variantId: string, options?: { geneId?: string | null; regionId?: string | null; resultIndex?: ResultIndex }) => {
    setVariantId(variantId);
    if (options?.geneId !== undefined) setGeneId(options.geneId);
    if (options?.regionId !== undefined) setRegionId(options.regionId);
    if (options?.resultIndex) {
      setResultIndex(options.resultIndex);
      openResultsPane();
    } else {
      openDetailPane();
    }
  }, [setVariantId, setGeneId, setRegionId, setResultIndex, openDetailPane, openResultsPane]);

  const goToPhenotype = useCallback((analysisId: string, options?: { keepContext?: boolean; resultIndex?: ResultIndex }) => {
    setAnalysisId(analysisId);
    if (!options?.keepContext) {
      setGeneId(null);
      setRegionId(null);
      setVariantId(null);
    }
    if (options?.resultIndex) {
      setResultIndex(options.resultIndex);
      openResultsPane();
    }
  }, [setAnalysisId, setGeneId, setRegionId, setVariantId, setResultIndex, openResultsPane]);

  const goToLocus = useCallback((regionId: string, options?: { geneId?: string; fromPhenotype?: boolean; resultIndex?: ResultIndex }) => {
    setRegionId(regionId);
    setVariantId(null);
    if (options?.geneId !== undefined) setGeneId(options.geneId);
    if (!options?.fromPhenotype) setAnalysisId(null);
    if (options?.resultIndex) {
      setResultIndex(options.resultIndex);
      openResultsPane();
    } else {
      openDetailPane();
    }
  }, [setRegionId, setVariantId, setGeneId, setAnalysisId, setResultIndex, openDetailPane, openResultsPane]);

  const switchAnalysis = useCallback((analysisId: string | null) => {
    setAnalysisId(analysisId);
  }, [setAnalysisId]);

  const clearVariant = useCallback(() => {
    setVariantId(null);
  }, [setVariantId]);

  const clearAll = useCallback(() => {
    setGeneId(null);
    setRegionId(null);
    setVariantId(null);
  }, [setGeneId, setRegionId, setVariantId]);

  const openInNewTab = useCallback((stateUpdates: Record<string, string | null>) => {
    window.open(
      buildCanonicalNavigationUrl(window.location.href, stateUpdates),
      '_blank'
    );
  }, []);

  return {
    goToGene,
    goToRegion,
    goToVariant,
    goToPhenotype,
    goToLocus,
    switchAnalysis,
    clearVariant,
    clearAll,
    openInNewTab,
    openDetailPane,
    openResultsPane,
  };
}
