export interface VariantUIAnnotations {
  isFiltered?: boolean;
  isSelected?: boolean;
}

export interface Variant {
  variant_id: string;
  locus: Locus;
  alleles?: string[];
  association?: Association;
  finemapping?: FinemappingResult;
  vep?: VepAnnotation;
  ui?: VariantUIAnnotations;
}

export interface AssociationVariant extends Variant {
  association: Association;
}

export interface IntervalVariant extends Variant {
  association: Association;
}

export interface VepAnnotation {
  variant_id: string;
  locus: Locus;
  hgvs: string;
  hgvsc: string;
  hgvsp: string;
  gene_id: string;
  gene_symbol: string;
  consequence: string;
  consequence_category: string;
  is_canonical_vep: boolean;
}

export type AlleleCounts = {
  name: string;
  ac?: number;
  an?: number;
  af?: number;
  fc?: number;
  subset?: string;
  study?: string;
};

export interface Population {
  population_id: string;
  color: string;
}

export interface Correlation {
  population_id: string;
  r2: number;
}

export interface FinemappingResult {
  region_id: string;
  variant_id: string;
  locus: Locus;
  cs: boolean;
  cs_99: boolean;
  correlations: Correlation[] | [];
  lbf: number;
  maf: number;
  prob: number;
}

export interface FinemappingSummary extends Interval {
  analysis_id: string;
  region_id: string;
}

export interface Association {
  pvalue: number;
  p_het?: number;
  beta?: number;
  se?: number;
  af?: number;
  n_studies?: number;
  n_samples?: number;
  is_binned?: boolean;
}

export interface VariantFilter {
  includeCategories: {
    lof: boolean;
    missense: boolean;
    synonymous: boolean;
    non_coding: boolean;
  };
  searchText: string;
}

export type Exon = {
  feature_type: string;
  start: number;
  stop: number;
};

export type GeneModel = {
  gene_id: string;
  symbol: string;
  name: string | undefined;
  chrom: string;
  start: number;
  stop: number;
  strand: string;
  exons: Exon[];
};

export type Region = {
  feature_type: string;
  chrom?: string;
  start: number;
  stop: number;
  previousRegionDistance: number;
  offset: number;
  variants?: Variant[];
};

export type Locus = {
  contig: string;
  position: number;
};

export interface IntervalParams {
  regionId: string;
}

export interface Interval {
  contig: string;
  start: number;
  stop: number;
  regionId?: string;
}

export interface IntervalState extends Interval {
  zoomStep: number;
  windowSize: number;
  startOffset: number;
  stopOffset: number;
}

export interface UpdateIntervalArgs {
  interval?: Interval;
  locus?: Locus;
  exact?: boolean;
  routePath?: string;
}

export interface Trait {
  name: string;
  description?: string;
  category?: string;
}

export interface AirtableStudyData {
  city: string;
  country: string;
  airtableAbbreviation: string;
  airtableId: string;
  airtableName: string;
}

export interface Study {
  studyPopulation: string;
  fullName?: string;
  studyAbbreviation?: string;
}

export interface AnalysisManifest {
  studyCount: number;
  caseCount: number;
  controlCount: number;
  studies: Study[];
  populations: string[];
}

export interface Analysis {
  analysisId: string;
  analysisKeys: string[];
  trait: Trait;
  subset?: string;
  release?: string;
  phenocode?: string;
  manifestId?: string | null;
  manifest?: AnalysisManifest | null;
}

export interface ManhattanDataset {
  analysis_id: string;
  binned?: Pick<Variant, "variant_id" | "association" | "locus">[];
  unbinned?: Variant[];
  contig: string;
  num_binned: number;
  num_unbinned: number;
  threshold: number;
  n_divisions: number;
  total: number;
}

export interface DownsamplingState {
  threshold: number | null;
  n_divisions: number | null;
}

