/**
 * TypeScript interfaces for Manhattan plot data.
 * The backend returns raw genomic coordinates; the frontend computes display positions.
 * Supports both variant hits (exome/genome Manhattan) and gene hits (gene burden Manhattan).
 */

/**
 * Type of Manhattan plot hit
 */
export type HitType = 'variant' | 'gene';

/**
 * A significant hit from ClickHouse with raw genomic coordinates and annotations.
 * Can represent either a variant hit or a gene hit depending on the plot type.
 */
export interface SignificantHit {
  /** Type of hit (variant or gene) */
  hit_type: HitType;
  /** Primary ID: variant_id for variants, gene_id for genes */
  id: string;
  /** Display label: variant_id for variants, gene_symbol for genes */
  label: string;
  /** Chromosome name (e.g., "chr1", "chr22") */
  contig: string;
  /** Genomic position (1-based) */
  position: number;
  /** P-value */
  pvalue: number;
  /** Effect size (beta coefficient for variants, beta_burden for genes) */
  beta?: number;
  /** Gene symbol from annotations (for variants) or primary gene symbol (for genes) */
  gene_symbol?: string;
  /** Variant consequence (e.g., "missense_variant", "intron_variant") - variants only */
  consequence?: string;
  /** HGVS coding notation - variants only */
  hgvsc?: string;
  /** HGVS protein notation - variants only */
  hgvsp?: string;
  /** Allele count - variants only */
  ac?: number;
  /** P-value for burden test - genes only */
  pvalue_burden?: number;
  /** P-value for SKAT test - genes only */
  pvalue_skat?: number;
}

/**
 * Overlay data from the API.
 */
export interface ManhattanOverlay {
  significant_hits: SignificantHit[];
  hit_count: number;
}

/**
 * A hit with computed display coordinates (used internally after layout calculation).
 */
export interface DisplayHit extends SignificantHit {
  /** X position normalized to image width (0.0 to 1.0) */
  x_normalized: number;
  /** Y position normalized to image height (0.0 to 1.0) */
  y_normalized: number;
}
