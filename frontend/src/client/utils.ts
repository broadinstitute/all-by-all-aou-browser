import { mergeWith as lodashMergeWith } from 'lodash'
import {
  Locus,
  WorstCsqByGeneCanonical,
  AxaouConfig,
  GeneAssociations,
  VariantJoined,
  AnalysisMetadata,
  LoadedAnalysis,
} from './types'
import { consequenceCategoryColorsMap } from './GenePage/LocusPagePlots'
import { getCategoryFromConsequence } from './vepConsequences'

export const makeVariantId = (
  contig: string,
  pos: number,
  ref: string,
  alt: string,
  maxLength?: number
): string => {
  // Keep chr prefix to match API format (chr12-65805394-C-T)
  let varId = `${contig}-${pos}-${ref}-${alt}`
  if (maxLength !== undefined) {
    varId = varId.slice(0, maxLength)
  }
  return varId
}

export const addVariantId = (variant: {
  locus: { contig: string; position: number }
  ref: string
  alt: string
}): string => {
  return makeVariantId(variant.locus.contig, variant.locus.position, variant.ref, variant.alt)
}

interface VariantInput {
  locus: Locus
  ref: string
  alt: string
  [key: string]: any
}

export const addVariantIdsToList = <T extends VariantInput>(
  variants: T[]
): (T & { variant_id: string })[] => {
  return variants.map((v) => {
    if (v.locus && v.ref && v.alt) {
      return {
        ...v,
        variant_id: addVariantId(v),
      }
    }
    return v
  }) as (T & { variant_id: string })[]
}

type JoinType = 'inner' | 'left' | 'right' | 'outer'

interface MergeOptions<T1, T2> {
  keys: Array<keyof T1 & keyof T2>
  joinType: JoinType
}

export const genericMerge = <T1 extends object, T2 extends object>(
  data1: T1[],
  data2: T2[],
  options: MergeOptions<T1, T2>
): (T1 & T2)[] => {
  const { keys, joinType } = options;

  const keyFn = (item: T1 | T2) => keys.map((key) => item[key]).join('-');

  const data1Keyed = data1.reduce((acc, item) => {
    acc[keyFn(item)] = item;
    return acc;
  }, {} as Record<string, T1>);

  const data2Keyed = data2.reduce((acc, item) => {
    acc[keyFn(item)] = item;
    return acc;
  }, {} as Record<string, T2>);

  const mergedData: (T1 & T2)[] = [];

  // Fields where 0 is a dummy value from the API (associations don't have these)
  const dummyZeroFields = ['af', 'beta', 'se', 'ac', 'an', 'hom'];

  const customMerge = (objValue: any, srcValue: any, key: string) => {
    // Don't overwrite valid values with dummy 0s
    if (dummyZeroFields.includes(key) && srcValue === 0 && objValue !== undefined && objValue !== null && objValue !== 0) {
      return objValue;
    }
    if (srcValue !== null && srcValue !== undefined) {
      return srcValue;
    }
    return objValue;
  };

  if (joinType === 'inner' || joinType === 'outer') {
    for (const key of new Set([...Object.keys(data1Keyed), ...Object.keys(data2Keyed)])) {
      if (data1Keyed[key] && data2Keyed[key]) {
        mergedData.push(lodashMergeWith({}, data1Keyed[key], data2Keyed[key], customMerge));
      } else if (joinType === 'outer') {
        mergedData.push(
          lodashMergeWith({}, data1Keyed[key] || {}, data2Keyed[key] || {}, customMerge) as T1 & T2
        );
      }
    }
  }

  if (joinType === 'left') {
    for (const key of Object.keys(data1Keyed)) {
      mergedData.push(lodashMergeWith({}, data1Keyed[key], data2Keyed[key], customMerge));
    }
  }

  if (joinType === 'right') {
    for (const key of Object.keys(data2Keyed)) {
      mergedData.push(lodashMergeWith({}, data1Keyed[key], data2Keyed[key], customMerge));
    }
  }

  return mergedData;
};

export const annotateWorstConsequence = <
  T extends { worst_csq_by_gene_canonical?: WorstCsqByGeneCanonical[]; consequence?: string | null; hgvsc?: string | null; hgvsp?: string | null }
>(
  variant: T
): T & { hgvsp: string | null; hgvsc: string | null; consequence: string } => {
  // First try to get from worst_csq_by_gene_canonical (legacy VEP format)
  const vepAnnotation =
    variant.worst_csq_by_gene_canonical && variant.worst_csq_by_gene_canonical.length > 0
      ? variant.worst_csq_by_gene_canonical[0]
      : null

  // Use VEP annotation if available, otherwise fallback to top-level fields (new extended API format)
  const consequence = vepAnnotation?.most_severe_consequence || variant.consequence || 'unknown'
  const hgvsp = vepAnnotation?.hgvsp ?? variant.hgvsp ?? null
  const hgvsc = vepAnnotation?.hgvsc ?? variant.hgvsc ?? null

  return {
    ...variant,
    hgvsp,
    hgvsc,
    consequence,
  }
}

export const analysisInTestConfig = (analysis: AnalysisMetadata, config?: AxaouConfig): boolean => {
  if (config && config.test_analyses) {
    return config.test_analyses.includes(analysis.analysis_id)
  }
  return true
}
export const geneInTestConfig = (analysis: GeneAssociations, config?: AxaouConfig): boolean => {
  if (config && config.test_gene_symbols) {
    return config.test_gene_symbols.includes(analysis.gene_symbol)
  }
  return true
}


export const sortVariantsByConsequence = (a: VariantJoined, b: VariantJoined) => {
  const aIndex = Array.from(consequenceCategoryColorsMap.keys()).indexOf(getCategoryFromConsequence(a.consequence || 'unknown'));
  const bIndex = Array.from(consequenceCategoryColorsMap.keys()).indexOf(getCategoryFromConsequence(b.consequence || 'unknown'));
  return aIndex - bIndex;
};
export const sortVariantsByCorrelation = (a: VariantJoined, b: VariantJoined) => {
  const aCorrelation = a.correlation ?? Number.POSITIVE_INFINITY;
  const bCorrelation = b.correlation ?? Number.POSITIVE_INFINITY;
  const correlationComparison = aCorrelation - bCorrelation;

  if (correlationComparison !== 0) {
    return correlationComparison;
  }

  const sequencingTypeOrder: Record<string, number> = { "exome": 1, "genome": 0 };
  const aSequencingTypeRank = sequencingTypeOrder[a.sequencing_type as keyof typeof sequencingTypeOrder] ?? 2;
  const bSequencingTypeRank = sequencingTypeOrder[b.sequencing_type as keyof typeof sequencingTypeOrder] ?? 2;

  return aSequencingTypeRank - bSequencingTypeRank;
};


export const processGeneBurden = (geneAssociations: GeneAssociations[]): GeneAssociations[] => {
  if (!geneAssociations || !Array.isArray(geneAssociations)) {
    return [];
  }
  return geneAssociations
    .filter((r: GeneAssociations) => r && r.contig) // Filter out entries without contig
    .map((r: GeneAssociations) => ({
      ...r,
      chrom: r.contig?.replace('chr', '') || '',
      contig: r.contig || '',
      gene_start_position: r.gene_start_position,
      pos: r.gene_start_position || 0,
      beta_burden: r.beta_burden,
      // pval: r.pvalue,
    }));
};


export const getAnalysisDisplayTitle = (analysis: AnalysisMetadata): string => {
  const description = analysis.description
    ? analysis.description.charAt(0).toUpperCase() + analysis.description.slice(1)
    : '';
  const text = description ||
    (analysis.analysis_id.charAt(0).toUpperCase() + analysis.analysis_id.slice(1));
  return text.length > 30 ? text.slice(0, 30) + '…' : text;
};



export function getAvailableAnalysisIds(data: LoadedAnalysis[]): string[] {
  return data
    .filter((analysis) => {
      const hasMetaExomes = analysis.details.some(
        (detail) =>
          detail.ancestry_group === 'meta' &&
          detail.sequencing_type === 'exomes'
      );
      const hasMetaGenomes = analysis.details.some(
        (detail) =>
          detail.ancestry_group === 'meta' &&
          detail.sequencing_type === 'genomes'
      );
      return hasMetaExomes && hasMetaGenomes;
    })
    .map((analysis) => analysis.analysis_id);
}

export const datasetCounts = {
  n_samples: 250_000,
  n_phenotypes: 3_400,
}


export const filterValidAnalyses = (
  analyses: any[],
  availableAnalysisIds: string[]
): any[] => {
  return analyses
    .filter((analysis) => analysis.analysis_id !== "654")
    .filter((analysis) => !analysis.description.includes("random"))
    .filter((analysis) => !analysis.description.includes("PFHH"))
    .filter((analysis) => !analysis.description.includes("County"))
    .filter((analysis) => availableAnalysisIds.includes(analysis.analysis_id));
};
