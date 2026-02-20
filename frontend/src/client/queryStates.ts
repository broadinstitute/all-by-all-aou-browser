import PouchDB from 'pouchdb';
import { analysisIdAtom, ancestryGroupAtom, geneIdAtom, regionIdAtom, sequencingTypeAtom } from './sharedState';

import axios from 'axios';
import {
  selector,
  selectorFamily
} from 'recoil';
import { axaouDevUrl, pouchDbName } from './Query';
import { AnalysisMetadata, AxaouConfig, GeneSymbol, LoadedAnalysis, VariantAssociations } from './types';
import { filterValidAnalyses, getAvailableAnalysisIds } from './utils';

/**
 * Convert regionId format from "19-32216732-34497056" to "19:32216732-34497056"
 * for API interval endpoints which expect "chr:start-end" format.
 */
const formatRegionIdForApi = (regionId: string): string => {
  const parts = regionId.split('-')
  if (parts.length >= 3) {
    // Format: "19-32216732-34497056" -> "19:32216732-34497056"
    return `${parts[0]}:${parts.slice(1).join('-')}`
  }
  return regionId
}

async function fetchFromUrlWithCache<T>(base_url: string, params: Record<string, string> = {}): Promise<{
  data?: T;
  error?: string;
  isLoading: boolean;
}> {
  const db = new PouchDB(pouchDbName);
  const queryString = Object.entries(params)
    .map(([key, value]) => `${key}=${value}`)
    .join('&');
  const url = queryString ? `${base_url}?${queryString}` : base_url;
  let isLoading = true;

  try {
    const cached = await db.get<{ data: T }>(url);
    return { data: cached.data, isLoading: false };
  } catch {
    try {
      const { data } = await axios.get<T>(url);
      if (data) {
        try {
          await db.put({ _id: url, data });
        } catch {
        }
      }
      return { data, isLoading: false };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'An unknown error occurred', isLoading: false };
    }
  } finally {
    isLoading = false;
  }
}

export const geneSymbolsQuery = selector({
  key: 'allGeneSymbols',
  get: async () => {
    const url = `${axaouDevUrl}/genes/all-symbols`;
    return fetchFromUrlWithCache<GeneSymbol[]>(url);
  }
});

export const configQuery = selector({
  key: 'axaouConfig',
  get: async () => {
    const url = `${axaouDevUrl}/config`;
    return fetchFromUrlWithCache<AxaouConfig>(url, { ancestry_group: "meta" });
  }
});


export const loadedAnalysesQuery = selector({
  key: 'loadedAnalyses',
  get: async () => {
    const url = `${axaouDevUrl}/analyses-loaded`;
    const result = await fetchFromUrlWithCache<LoadedAnalysis[]>(url);

    if (result.data) {
      return getAvailableAnalysisIds(result.data);
    }
    return [];
  }
});

export const analysisMetadataQuery = selector({
  key: 'allAnalysisMetadata',
  get: async () => {
    const url = `${axaouDevUrl}/analyses`;
    return fetchFromUrlWithCache<AnalysisMetadata[]>(url, { ancestry_group: "meta" });
  }
});

export const filteredAnalysesQuery = selector({
  key: 'filteredAnalyses',
  get: async ({ get }) => {
    const availableAnalysisIds = get(loadedAnalysesQuery);
    const analysisMetadata = get(analysisMetadataQuery);

    if (!analysisMetadata.data) {
      return [];
    }

    return filterValidAnalyses(analysisMetadata.data, availableAnalysisIds);
  }
});

export const variantAssociationsGeneQuerySelector = selector({
  key: 'variantAssociationsGeneQuery',
  get: async ({ get }) => {
    const geneId = get(geneIdAtom);
    const ancestryGroup = get(ancestryGroupAtom);
    const analysisId = get(analysisIdAtom);
    const sequencingType = get(sequencingTypeAtom);

    if (!geneId) {
      throw new Error('geneId must be specified and non-null.');
    }
    const queryParams: Record<string, string> = {};

    if (ancestryGroup) queryParams["ancestry_group"] = ancestryGroup.toString();
    if (analysisId) queryParams["analysis_id"] = analysisId;
    if (sequencingType) queryParams["sequencing_type"] = sequencingType.toString();
    if (sequencingType) queryParams["sequencing_type"] = sequencingType.toString();

    const base_url = `${axaouDevUrl}/variants/associations/gene/${geneId}`;
    return fetchFromUrlWithCache<VariantAssociations[]>(base_url, queryParams);
  }
});

type VariantAssociationsRegionQueryParams = {
  sequencingType: string,
  queryMode: "slow" | "fast"
}

export const variantAssociationsRegionQuerySelector = selectorFamily({
  key: 'variantAssociationsRegionQuery',
  get: ({ sequencingType, queryMode }: VariantAssociationsRegionQueryParams) => async ({ get }) => {
    const regionId = get(regionIdAtom);
    const ancestryGroup = get(ancestryGroupAtom);
    const analysisId = get(analysisIdAtom);

    if (!regionId) {
      throw new Error('regionId must be specified and non-null.');
    }
    const queryParams: Record<string, string> = {};

    if (ancestryGroup) queryParams["ancestry_group"] = ancestryGroup.toString();
    if (analysisId) queryParams["analysis_id"] = analysisId;
    if (sequencingType) queryParams["sequencing_type"] = sequencingType;
    if (queryMode) queryParams["query_mode"] = queryMode;

    // Format regionId for API: "19-32216732-34497056" -> "19:32216732-34497056"
    const apiRegionId = formatRegionIdForApi(regionId);
    const base_url = `${axaouDevUrl}/variants/associations/interval/chr${apiRegionId}`;
    return fetchFromUrlWithCache<VariantAssociations[]>(base_url, queryParams);
  }
});

export const VariantAssociationsInRegionSelector = selector({
  key: 'VariantAssociationsInRegion',
  get: async ({ get }) => {
    const exomeVariantAssociationsFast = get(variantAssociationsRegionQuerySelector({ sequencingType: 'exomes', queryMode: 'fast' }));
    const genomeVariantAssociationsFast = get(variantAssociationsRegionQuerySelector({ sequencingType: 'genomes', queryMode: 'fast' }));
    const exomeVariantAssociationsSlow = get(variantAssociationsRegionQuerySelector({ sequencingType: 'exomes', queryMode: 'slow' }));
    const genomeVariantAssociationsSlow = get(variantAssociationsRegionQuerySelector({ sequencingType: 'genomes', queryMode: 'slow' }));

    const exomeVariantAssociations = [...(exomeVariantAssociationsFast.data || []), ...(exomeVariantAssociationsSlow.data || [])];
    const genomeVariantAssociations = [...(genomeVariantAssociationsFast.data || []), ...(genomeVariantAssociationsSlow.data || [])];

    return {
      genomeVariantAssociations,
      exomeVariantAssociations
    };
  }
});
