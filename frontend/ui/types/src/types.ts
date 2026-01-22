export interface VariantUIAnnotations {
  isFiltered?: boolean;
  isSelected?: boolean;
}

export type Locus = {
  contig: string;
  position: number;
};

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

export interface Variant {
  variant_id: string;
  locus: Locus;
  alleles?: string[];
  association?: Association;
  finemapping?: FinemappingResult;
  vep?: VepAnnotation;
  ui?: VariantUIAnnotations;
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
