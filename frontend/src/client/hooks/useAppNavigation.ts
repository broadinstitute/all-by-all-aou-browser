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

export type NavMode = 'split' | 'full' | 'newTab';

/**
 * Build a location descriptor for use in <Link to={...}> components.
 * Returns {pathname, search} so React Router handles encoding correctly.
 */
export function buildStateUrl(stateUpdates: Record<string, string | null>): { pathname: string; search: string } {
  return {
    pathname: '/app',
    search: `?state=${encodeURIComponent(JSON.stringify(stateUpdates))}`,
  };
}

export function useAppNavigation() {
  const setGeneId = useSetRecoilState(geneIdAtom);
  const setRegionId = useSetRecoilState(regionIdAtom);
  const setVariantId = useSetRecoilState(variantIdAtom);
  const setAnalysisId = useSetRecoilState(analysisIdAtom);
  const setResultIndex = useSetRecoilState(resultIndexAtom);
  const setResultLayout = useSetRecoilState(resultLayoutAtom);

  const openDetailPane = useCallback(() => {
    setResultLayout((prev) => (prev === 'full' ? 'split' : prev));
  }, [setResultLayout]);

  const goToGene = useCallback((geneId: string, options?: { fromPhenotype?: boolean; keepVariant?: boolean; resultIndex?: ResultIndex }) => {
    setGeneId(geneId);
    setRegionId(null);
    if (!options?.keepVariant) setVariantId(null);
    if (!options?.fromPhenotype) setAnalysisId(null);
    if (options?.resultIndex) setResultIndex(options.resultIndex);
    openDetailPane();
  }, [setGeneId, setRegionId, setVariantId, setAnalysisId, setResultIndex, openDetailPane]);

  const goToRegion = useCallback((regionId: string, options?: { fromPhenotype?: boolean; resultIndex?: ResultIndex }) => {
    setRegionId(regionId);
    setGeneId(null);
    setVariantId(null);
    if (!options?.fromPhenotype) setAnalysisId(null);
    if (options?.resultIndex) setResultIndex(options.resultIndex);
    openDetailPane();
  }, [setRegionId, setGeneId, setVariantId, setAnalysisId, setResultIndex, openDetailPane]);

  const goToVariant = useCallback((variantId: string, options?: { geneId?: string | null; regionId?: string | null; resultIndex?: ResultIndex }) => {
    setVariantId(variantId);
    if (options?.geneId !== undefined) setGeneId(options.geneId);
    if (options?.regionId !== undefined) setRegionId(options.regionId);
    if (options?.resultIndex) setResultIndex(options.resultIndex);
    openDetailPane();
  }, [setVariantId, setGeneId, setRegionId, setResultIndex, openDetailPane]);

  const goToPhenotype = useCallback((analysisId: string, options?: { keepContext?: boolean; resultIndex?: ResultIndex }) => {
    setAnalysisId(analysisId);
    if (!options?.keepContext) {
      setGeneId(null);
      setRegionId(null);
      setVariantId(null);
    }
    if (options?.resultIndex) setResultIndex(options.resultIndex);
  }, [setAnalysisId, setGeneId, setRegionId, setVariantId, setResultIndex]);

  const goToLocus = useCallback((regionId: string, options?: { geneId?: string; fromPhenotype?: boolean; resultIndex?: ResultIndex }) => {
    setRegionId(regionId);
    setVariantId(null);
    if (options?.geneId !== undefined) setGeneId(options.geneId);
    if (!options?.fromPhenotype) setAnalysisId(null);
    if (options?.resultIndex) setResultIndex(options.resultIndex);
    openDetailPane();
  }, [setRegionId, setVariantId, setGeneId, setAnalysisId, setResultIndex, openDetailPane]);

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
    const url = new URL(window.location.href);
    const stateStr = url.searchParams.get('state');
    let stateObj: Record<string, any> = {};
    try {
      if (stateStr) stateObj = JSON.parse(decodeURIComponent(stateStr));
    } catch (e) {}

    // Clean stale entity ids
    delete stateObj.geneId;
    delete stateObj.regionId;
    delete stateObj.variantId;
    delete stateObj.analysisId;

    Object.assign(stateObj, stateUpdates);
    url.searchParams.set('state', JSON.stringify(stateObj));

    // Clean top-level query params
    url.searchParams.delete('regionId');
    url.searchParams.delete('resultLayout');
    url.searchParams.delete('geneId');

    window.open(url.toString(), '_blank');
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
  };
}
