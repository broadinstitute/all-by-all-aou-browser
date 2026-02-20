import {
  VariantAnnotationsHds as VariantAnnotations,
  WorstCsqByGeneCanonical,
} from './hds_types/variant_annotations_hds'
import { VariantAssociationHdsB602Fafeb990 as VariantAssociations } from './hds_types/variant_association_hds_b602fafeb990'
import { VariantPhewasHds as VariantPhewas } from './hds_types/variant_phewas_hds'
import { GeneAssociationsHds } from './hds_types/gene_associations_hds'
import { AnalysisMetadataHds as AnalysisMetadata } from './hds_types/analysis_metadata_hds'
import { AnalysisCategoriesHds as AnalysisCategories } from './hds_types/analysis_categories_hds'
import { GeneModelsHds as GeneModels, GnomadConstraint } from './hds_types/gene_models_hds'
import {
  GenePhewasHds as GenePhewas,
  Data as GenePhewasDataItem,
} from './hds_types/gene_phewas_hds'
import { AxouConfig as AxaouConfig } from './axou_config'

type MissingFieldsAxaouAnalysis = {
  saige_version: string
  inv_normalized: string
  phenocode: string
  coding: string
  modifier: string
  path: string
  n_cases_both_sexes: number
  n_cases_females: number
  n_cases_males: number
  coding_description: string | null
  BETA: number | null
  color: string
}

type GenePhewasAnnotated = GenePhewasDataItem & AnalysisMetadata & MissingFieldsAxaouAnalysis

interface Locus {
  contig: string
  position: number
}

interface Association {
  pvalue: number
  p_het?: number
  beta?: number
  se?: number
  af?: number
  n_studies?: number
  n_samples?: number
  is_binned?: boolean
}

type MissingVariantFieldsGenePage = {
  gwas_catalog: any
  analysis_description: string | undefined
  trait_type?: string
  variant_id: string
  sequencing_type: string
  ancestry_group: string
  correlation?: number
  hgvsp: string
  hgvsc: string
  consequence: string
}

type RegionFlag = {
  lcr: boolean
  fail_interval_qc: boolean
  in_capture_region: boolean
}

type VariantJoined = VariantAnnotations & VariantAssociations & MissingVariantFieldsGenePage

export interface VariantDataset {
  sequencingType: string;
  ancestryGroup: string;
  analysisId: string;
  data: VariantJoined[];
}

interface VariantAssociationManhattan extends VariantAssociations {
  variant_id: string
  chrom: string
  pos: number
  pval: number
  gene_id: string | null
  is_binned: boolean
}

interface LookupResult<T = any> {
  count: number
  data: T[]
  storage_source: string
  time: number
  compressed_data_column: boolean
}

interface GeneSymbol {
  gene_symbol: string
  gene_id: string
}

type CorrelationEntry = {
  xpos: number;
  ref: string;
  alt: string;
  variant_id: string;
  correlation: number;
};

type LdEntry = {
  xpos: number;
  ref: string;
  alt: string;
  results: CorrelationEntry[];
};

interface LocusAssociation {
  contig: string;
  start: number;
  stop: number;
  region_id: string;
  lead_variant_id: string;
  n_snps: number;
  min_pvalue: number;
}

// TODO: fixme
interface GeneAssociations extends GeneAssociationsHds {
  chrom: string;
  contig: string;
  gene_start_position: number | null;
  pos?: number;
  beta_burden: number | null;
  // total_variants: number | null;
  pval?: number;
}

interface AnalysisDetail {
  sequencing_type: string;
  ancestry_group: string;
}

interface LoadedAnalysis {
  analysis_id: string;
  details: AnalysisDetail[];
}

// =============================================================================
// Locus Plot Types (for PNG-based locus visualization)
// =============================================================================

/** Y-axis configuration for locus plot coordinate mapping */
interface LocusPlotYAxisConfig {
  /** Threshold where scale switches from linear to log (-log10(p) value) */
  log_threshold: number;
  /** Fraction of plot height for the linear portion (0-1) */
  linear_fraction: number;
  /** Maximum -log10(p) value for scaling the log portion */
  max_neg_log_p: number;
}

/** Image dimensions */
interface LocusPlotImageDimensions {
  width: number;
  height: number;
}

/** Sidecar metadata for locus plot coordinate mapping */
interface LocusPlotSidecar {
  /** Original image dimensions */
  image: LocusPlotImageDimensions;
  /** Y-axis configuration for coordinate calculation */
  y_axis: LocusPlotYAxisConfig;
  /** Significance threshold marker */
  threshold: { pvalue: number; y_px: number };
}

/** Response from /api/phenotype/:id/loci/:locus_id/plot */
interface LocusPlotResponse {
  /** URL to the locus plot PNG image */
  image_url: string;
  /** Sidecar metadata for coordinate mapping */
  sidecar: LocusPlotSidecar;
  /** Locus start position (genomic coordinate) */
  locus_start: number;
  /** Locus stop position (genomic coordinate) */
  locus_stop: number;
  /** Chromosome */
  contig: string;
}

/** Locus metadata from /api/phenotype/:id/loci */
interface LocusMetadata {
  locus_id: string;
  phenotype: string;
  ancestry: string;
  contig: string;
  start: number;
  stop: number;
  xstart: number;
  xstop: number;
  source: string;
  lead_variant: string;
  lead_pvalue: number;
  exome_count: number;
  genome_count: number;
  plot_gcs_uri: string;
}

export {
  AxaouConfig,
  LookupResult,
  VariantAnnotations,
  WorstCsqByGeneCanonical,
  VariantPhewas,
  VariantAssociations,
  VariantAssociationManhattan,
  GeneAssociations,
  AnalysisMetadata,
  AnalysisCategories,
  GeneModels,
  GeneSymbol,
  GenePhewas,
  GenePhewasDataItem,
  GenePhewasAnnotated,
  VariantJoined,
  Association,
  RegionFlag,
  MissingVariantFieldsGenePage,
  Locus,
  LocusAssociation,
  LdEntry,
  CorrelationEntry,
  GnomadConstraint,
  LoadedAnalysis,
  LocusPlotYAxisConfig,
  LocusPlotImageDimensions,
  LocusPlotSidecar,
  LocusPlotResponse,
  LocusMetadata,
}
