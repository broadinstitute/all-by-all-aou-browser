/**
 * TypeScript interfaces for Manhattan plot data.
 * The backend returns raw genomic coordinates; the frontend computes display positions.
 */

/**
 * A significant variant from ClickHouse with raw genomic coordinates and annotations.
 */
export interface SignificantHit {
  variant_id: string;
  /** Chromosome name (e.g., "chr1", "chr22") */
  contig: string;
  /** Genomic position (1-based) */
  position: number;
  /** P-value */
  pvalue: number;
  /** Effect size (beta coefficient) */
  beta?: number;
  /** Gene symbol from annotations (if available) */
  gene_symbol?: string;
  /** Variant consequence (e.g., "missense_variant", "intron_variant") */
  consequence?: string;
  /** HGVS coding notation */
  hgvsc?: string;
  /** Allele count */
  ac?: number;
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
