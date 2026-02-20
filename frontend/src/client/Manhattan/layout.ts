/**
 * Chromosome layout and Y-scale utilities for Manhattan plot coordinate calculation.
 * Ported from hail-decoder/src/manhattan/layout.rs to match PNG rendering exactly.
 */

import type { SignificantHit, DisplayHit } from './types';

// =============================================================================
// GRCh38 Chromosome Data (matches hail-decoder/src/manhattan/reference.rs)
// =============================================================================

/** GRCh38 chromosome lengths for autosomes + X (matches hail-decoder reference.rs) */
const GRCH38_CHROM_LENGTHS: Record<string, number> = {
  '1': 248956422,
  '2': 242193529,
  '3': 198295559,
  '4': 190214555,
  '5': 181538259,
  '6': 170805979,
  '7': 159345973,
  '8': 145138636,
  '9': 138394717,
  '10': 133797422,
  '11': 135086622,
  '12': 133275309,
  '13': 114364328,
  '14': 107043718,
  '15': 101991189,
  '16': 90338345,
  '17': 83257441,
  '18': 80373285,
  '19': 58617616,
  '20': 64444167,
  '21': 46709983,
  '22': 50818468,
  'X': 156040895,
};

/** Ordered list of chromosome names (matches hail-decoder) */
const CHROM_ORDER = [
  '1', '2', '3', '4', '5', '6', '7', '8', '9', '10',
  '11', '12', '13', '14', '15', '16', '17', '18', '19', '20',
  '21', '22', 'X',
];

/** Total base pairs across all chromosomes in the layout */
const TOTAL_BP = CHROM_ORDER.reduce((sum, chr) => sum + GRCH38_CHROM_LENGTHS[chr], 0);

// =============================================================================
// ChromosomeLayout - Maps genomic coordinates to normalized X positions
// =============================================================================

/** Gap between chromosomes in pixels (matches hail-decoder) */
const GAP_PX = 4;

/** Reference image width used for layout calculation */
const REF_WIDTH = 3000;

interface ChromosomeInfo {
  name: string;
  startNormalized: number;
  endNormalized: number;
  length: number;
}

/**
 * ChromosomeLayout maps genomic coordinates to normalized X positions (0-1).
 * Matches the layout algorithm in hail-decoder/src/manhattan/layout.rs.
 * Supports both genome-wide view (contig='all') and single-chromosome view.
 */
export class ChromosomeLayout {
  private offsets: Map<string, { start: number; pxPerBp: number }>;
  private pxPerBp: number;
  public chromosomes: ChromosomeInfo[];
  /** The contig this layout is for ('all' for genome-wide) */
  public readonly contig: string;

  constructor(contig: string = 'all') {
    this.contig = contig;
    this.offsets = new Map();
    this.chromosomes = [];

    if (contig === 'all') {
      // Genome-wide layout: all chromosomes concatenated with gaps
      const totalGaps = (CHROM_ORDER.length - 1) * GAP_PX;
      const availableWidth = REF_WIDTH - totalGaps;
      this.pxPerBp = availableWidth / TOTAL_BP;

      let currentX = 0;

      for (const name of CHROM_ORDER) {
        const length = GRCH38_CHROM_LENGTHS[name];
        const width = length * this.pxPerBp;

        this.offsets.set(name, { start: currentX, pxPerBp: this.pxPerBp });

        this.chromosomes.push({
          name,
          startNormalized: currentX / REF_WIDTH,
          endNormalized: (currentX + width) / REF_WIDTH,
          length,
        });

        currentX += width + GAP_PX;
      }
    } else {
      // Single chromosome layout: the entire X axis spans one chromosome
      const name = contig.startsWith('chr') ? contig.slice(3) : contig;
      const length = GRCH38_CHROM_LENGTHS[name];

      if (!length) {
        throw new Error(`Unknown chromosome: ${contig}`);
      }

      this.pxPerBp = REF_WIDTH / length;
      this.offsets.set(name, { start: 0, pxPerBp: this.pxPerBp });
      this.chromosomes.push({
        name,
        startNormalized: 0,
        endNormalized: 1,
        length,
      });
    }
  }

  /**
   * Convert a genomic coordinate to normalized X position (0-1).
   * Returns null if the contig is unknown or not part of this layout.
   */
  getX(contig: string, position: number): number | null {
    // Normalize contig name (strip "chr" prefix if present)
    const name = contig.startsWith('chr') ? contig.slice(3) : contig;

    const offset = this.offsets.get(name);
    if (!offset) {
      return null;
    }

    const xPx = offset.start + position * offset.pxPerBp;
    return xPx / REF_WIDTH;
  }

  /**
   * Reverse-map a normalized X coordinate back to a chromosome name.
   * Returns null if the position falls in a gap or outside the layout.
   * Only useful for genome-wide layout (returns the single chromosome for single-chrom layout).
   */
  getChromosomeAtX(xNormalized: number): string | null {
    for (const chrom of this.chromosomes) {
      if (xNormalized >= chrom.startNormalized && xNormalized <= chrom.endNormalized) {
        return chrom.name;
      }
    }
    return null;
  }
}

// =============================================================================
// YScale - Maps p-values to normalized Y positions using hybrid linear-log scale
// =============================================================================

/** Threshold where scale switches from linear to log (-log10(p) value) */
const LOG_THRESHOLD = 10;

/** Fraction of plot height for the linear portion (0 to LOG_THRESHOLD) */
// hail-decoder uses 0.6 in YScale::new() (see layout.rs line 113)
const LINEAR_FRACTION = 0.6;

/** Maximum -log10(p) value for scaling the log portion */
const MAX_NEG_LOG_P = 300;

/**
 * YScale maps p-values to normalized Y positions (0-1) using a hybrid linear-log scale.
 * - Linear from -log10(p) = 0 to LOG_THRESHOLD (uses LINEAR_FRACTION of height)
 * - Logarithmic above LOG_THRESHOLD (compresses extreme values)
 *
 * Matches hail-decoder/src/manhattan/layout.rs YScale.
 * Returns pixel-normalized coordinates where Y=0 is TOP (most significant).
 */
export class YScale {
  /**
   * Convert a p-value to normalized Y position (0-1).
   * Y=0 is top of plot (most significant), Y=1 is bottom (least significant).
   * This matches PNG pixel coordinates where y=0 is the top row.
   */
  getY(pvalue: number): number {
    if (pvalue <= 0 || pvalue > 1) {
      return 1; // Invalid p-value goes to bottom
    }

    const negLogP = -Math.log10(pvalue);

    // Calculate position from bottom (0 = bottom, 1 = top of plot area)
    let positionFromBottom: number;
    if (negLogP <= LOG_THRESHOLD) {
      // Linear portion: [0, LOG_THRESHOLD] maps to [0, LINEAR_FRACTION] of height from bottom
      positionFromBottom = (negLogP / LOG_THRESHOLD) * LINEAR_FRACTION;
    } else {
      // Log portion: [LOG_THRESHOLD, MAX] maps to [LINEAR_FRACTION, 1.0] from bottom
      // Using ln() for the double-log compression
      const logVal = Math.log(negLogP / LOG_THRESHOLD);
      const logMax = Math.log(MAX_NEG_LOG_P / LOG_THRESHOLD);
      const logPosition = Math.min(logVal / logMax, 1.0);
      positionFromBottom = LINEAR_FRACTION + logPosition * (1 - LINEAR_FRACTION);
    }

    // Convert to pixel coordinates: Y=0 at top, Y=1 at bottom
    // positionFromBottom=0 (low significance) -> y_normalized=1 (bottom of image)
    // positionFromBottom=1 (high significance) -> y_normalized=0 (top of image)
    return 1 - positionFromBottom;
  }
}

// =============================================================================
// Utility functions
// =============================================================================

/** Cached layout instances keyed by contig */
const layoutInstances = new Map<string, ChromosomeLayout>();
let scaleInstance: YScale | null = null;

/**
 * Get or create a chromosome layout for the given contig.
 * @param contig 'all' for genome-wide, or 'chr1'-'chrY' for single chromosome
 */
export function getChromosomeLayout(contig: string = 'all'): ChromosomeLayout {
  if (!layoutInstances.has(contig)) {
    layoutInstances.set(contig, new ChromosomeLayout(contig));
  }
  return layoutInstances.get(contig)!;
}

/** Get or create the Y-scale singleton */
export function getYScale(): YScale {
  if (!scaleInstance) {
    scaleInstance = new YScale();
  }
  return scaleInstance;
}

/**
 * Convert raw hits from the API to display hits with computed coordinates.
 * Filters out hits that can't be positioned (unknown contigs or contigs
 * not part of the selected layout).
 * @param hits Raw significant hits from the API
 * @param contig Layout contig - 'all' for genome-wide, or specific chromosome
 */
export function computeDisplayHits(hits: SignificantHit[], contig: string = 'all'): DisplayHit[] {
  const layout = getChromosomeLayout(contig);
  const scale = getYScale();

  const displayHits: DisplayHit[] = [];

  for (const hit of hits) {
    const x = layout.getX(hit.contig, hit.position);
    if (x === null) {
      continue; // Skip unknown contigs or contigs not in this layout
    }

    const y = scale.getY(hit.pvalue);

    displayHits.push({
      ...hit,
      x_normalized: x,
      y_normalized: y,
    });
  }

  return displayHits;
}
