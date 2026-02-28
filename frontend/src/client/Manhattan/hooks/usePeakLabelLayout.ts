import { useMemo } from 'react';
import * as d3Force from 'd3-force';
import { getChromosomeLayout, getYScale } from '../layout';
import type { Peak } from '../types';

// Label dimensions for collision detection
const LABEL_HEIGHT = 12;
const CHAR_WIDTH = 6;
const LABEL_PADDING = 6;
const MIN_LABEL_SPACING = 10;
const LABEL_ANGLE = -45; // Degrees
const TOP_PADDING = 15; // Minimum space above topmost label
const BOTTOM_PADDING = 8; // Space between labels and plot

export interface PeakLabelNode {
  peak: Peak;
  targetX: number;
  targetY: number; // Y position on the plot (normalized, 0-1)
  x: number;
  y: number;
  label: string;
  labelWidth: number;
  hasBurden: boolean;
  codingCount: number;
  collisionRadius: number;
  /** Array of burden annotation types found (e.g., ['pLoF', 'missenseLC']) */
  burdenTypes: string[];
  /** Whether the top gene has significant coding variants */
  hasCoding: boolean;
  /** Count of LoF variants in the top gene */
  lofCount: number;
  /** Count of missense variants in the top gene */
  missenseCount: number;
  /** Total number of implicated genes in this peak */
  implicatedCount: number;
  /** Whether this is a burden-only peak (no GWAS single-variant signal) */
  isBurdenOnly: boolean;
}

export interface PeakLabelLayout {
  nodes: PeakLabelNode[];
  labelAreaHeight: number;
}

/**
 * Estimates the width of a label string in pixels
 */
function estimateLabelWidth(
  label: string,
  burdenTypes: string[],
  hasCoding: boolean,
  implicatedCount: number,
  isBurdenOnly: boolean = false
): number {
  let text = label;
  // Add space for burden-only indicator
  if (isBurdenOnly) text = '◆ ' + text;
  // Add space for burden dots (2 chars each: dot + space)
  if (burdenTypes.length > 0) text = '●'.repeat(burdenTypes.length) + ' ' + text;
  // Add space for coding indicator
  if (hasCoding) text += ' (C)';
  // Add space for multi-gene indicator
  if (implicatedCount > 1) text += ` +${implicatedCount - 1}`;
  return text.length * CHAR_WIDTH + LABEL_PADDING * 2;
}

const SIG_THRESHOLD = 2.5e-6;

interface PeakGene {
  gene_id: string;
  gene_symbol: string;
  burden_results?: Array<{
    annotation: string;
    pvalue?: number;
    pvalue_burden?: number;
    pvalue_skat?: number;
  }>;
  coding_variant_count?: number;
  lof_count?: number;
  missense_count?: number;
  distance_kb?: number;
}

/**
 * Selects the best representative gene for a given peak based on:
 * 1. Has significant burden or coding variants
 * 2. Best burden p-value
 * 3. Highest coding variant count
 * 4. Physical distance to peak
 */
function getBestGeneForPeak(peak: Peak): PeakGene | undefined {
  if (!peak.genes || peak.genes.length === 0) return undefined;

  return [...peak.genes].sort((a, b) => {
    // Helper to get minimum p-value from burden results
    const getMinP = (br: { pvalue?: number; pvalue_burden?: number; pvalue_skat?: number }) =>
      Math.min(br.pvalue ?? Infinity, br.pvalue_burden ?? Infinity, br.pvalue_skat ?? Infinity);

    const aMinP = Math.min(...(a.burden_results?.map(getMinP) || [Infinity]));
    const bMinP = Math.min(...(b.burden_results?.map(getMinP) || [Infinity]));

    const aBurdenSig = aMinP < SIG_THRESHOLD;
    const bBurdenSig = bMinP < SIG_THRESHOLD;

    const aCodingCount = a.coding_variant_count || 0;
    const bCodingCount = b.coding_variant_count || 0;

    const aImplicated = aBurdenSig || aCodingCount > 0;
    const bImplicated = bBurdenSig || bCodingCount > 0;

    // 1. Prefer implicated genes
    if (aImplicated && !bImplicated) return -1;
    if (!aImplicated && bImplicated) return 1;

    // 2. Best burden p-value
    if (aMinP !== bMinP) return aMinP - bMinP;

    // 3. Highest coding variant count
    if (aCodingCount !== bCodingCount) return bCodingCount - aCodingCount;

    // 4. Distance (closest physical proximity as tie-breaker)
    return (a.distance_kb || 0) - (b.distance_kb || 0);
  })[0];
}

/**
 * Hook that computes peak label positions and the required label area height.
 * Returns positioned nodes and the computed height needed for labels.
 * @param peaks Peak data from the API
 * @param width Container width in pixels
 * @param height Container height in pixels
 * @param contig Layout contig - 'all' for genome-wide, or specific chromosome
 */
export function usePeakLabelLayout(
  peaks: Peak[] | undefined,
  width: number,
  height: number,
  contig: string = 'all',
  maxLabels: number = 25
): PeakLabelLayout {
  const layout = getChromosomeLayout(contig);
  const yScale = getYScale();

  return useMemo(() => {
    if (!peaks || peaks.length === 0 || width === 0 || height === 0) {
      return { nodes: [], labelAreaHeight: 0 };
    }

    // Filter peaks to only those on the selected chromosome (if not 'all')
    const filteredPeaks = contig === 'all'
      ? peaks
      : peaks.filter((p) => {
          const peakContig = p.contig.startsWith('chr') ? p.contig : `chr${p.contig}`;
          return peakContig === contig;
        });

    // Separate GWAS peaks from burden-only peaks
    const gwasPeaks = filteredPeaks.filter((p) => !p.isBurdenOnly);
    const burdenOnlyPeaks = filteredPeaks.filter((p) => p.isBurdenOnly);

    // Take top N GWAS peaks
    const topGwasPeaks = [...gwasPeaks]
      .sort((a, b) => a.pvalue - b.pvalue)
      .slice(0, maxLabels);

    // Include ALL burden-only peaks with significant pLoF or missense burden
    const SIG_BURDEN_THRESHOLD = 2.5e-6;
    const significantBurdenOnlyPeaks = burdenOnlyPeaks.filter((p) =>
      p.genes.some((g) =>
        g.burden_results?.some((b) =>
          (b.annotation === 'pLoF' || b.annotation === 'missenseLC') &&
          ((b.pvalue !== undefined && b.pvalue < SIG_BURDEN_THRESHOLD) ||
           (b.pvalue_burden !== undefined && b.pvalue_burden < SIG_BURDEN_THRESHOLD) ||
           (b.pvalue_skat !== undefined && b.pvalue_skat < SIG_BURDEN_THRESHOLD))
        )
      )
    );

    // Combine: top GWAS peaks + all significant burden-only peaks
    const topPeaks = [...topGwasPeaks, ...significantBurdenOnlyPeaks]
      .sort((a, b) => a.pvalue - b.pvalue);

    const nodes: PeakLabelNode[] = [];

    for (const peak of topPeaks) {
      const xNorm = layout.getX(peak.contig, peak.position);
      const yNorm = yScale.getY(peak.pvalue);

      if (xNorm === null) {
        continue;
      }

      // Defensive: ensure genes array exists
      if (!peak.genes || peak.genes.length === 0) {
        continue;
      }

      const topGene = getBestGeneForPeak(peak);
      if (!topGene) {
        continue;
      }

      // Collect burden types from all genes in this peak
      const burdenTypesSet = new Set<string>();
      let implicatedCount = 0;
      for (const g of peak.genes) {
        const hasGeneBurden = g.burden_results?.some((b) => (b.pvalue ?? Infinity) < SIG_THRESHOLD) ?? false;
        const hasGeneCoding = (g.coding_variant_count || 0) > 0;
        if (hasGeneBurden || hasGeneCoding) {
          implicatedCount++;
        }
        if (g.burden_results) {
          for (const b of g.burden_results) {
            if ((b.pvalue ?? Infinity) < SIG_THRESHOLD) {
              burdenTypesSet.add(b.annotation);
            }
          }
        }
      }
      const burdenTypes = Array.from(burdenTypesSet);
      const hasBurden = burdenTypes.length > 0;

      // Extract specific coding variant counts
      const lofCount = topGene.lof_count || 0;
      const missenseCount = topGene.missense_count || 0;
      const codingCount = topGene.coding_variant_count || 0;
      const hasCoding = codingCount > 0;

      const isBurdenOnly = peak.isBurdenOnly ?? false;
      const labelWidth = estimateLabelWidth(topGene.gene_symbol, burdenTypes, hasCoding, implicatedCount, isBurdenOnly);

      // For angled labels, calculate collision radius
      const angleRad = Math.abs(LABEL_ANGLE * Math.PI / 180);
      const effectiveWidth = labelWidth * Math.cos(angleRad) + LABEL_HEIGHT * Math.sin(angleRad);
      const effectiveHeight = labelWidth * Math.sin(angleRad) + LABEL_HEIGHT * Math.cos(angleRad);
      const collisionRadius = Math.max(effectiveWidth, effectiveHeight) / 2 + MIN_LABEL_SPACING;

      const targetX = xNorm * width;
      const targetY = yNorm; // Store normalized Y for now

      nodes.push({
        peak,
        targetX,
        targetY,
        x: targetX,
        y: 0, // Will be computed by force simulation
        label: topGene.gene_symbol,
        labelWidth,
        hasBurden,
        codingCount,
        collisionRadius,
        burdenTypes,
        hasCoding,
        lofCount,
        missenseCount,
        implicatedCount,
        isBurdenOnly,
      });
    }

    if (nodes.length === 0) {
      return { nodes: [], labelAreaHeight: 0 };
    }

    // Sort by x position
    nodes.sort((a, b) => a.targetX - b.targetX);

    // Initial pass: position labels at a baseline closer to the data
    // Lower baseline (50 instead of 100) keeps labels closer to peaks
    const baseline = 50;
    for (const node of nodes) {
      node.y = baseline;
    }

    // Run force simulation - labels will spread out to avoid collisions
    // Lower forceX strength allows more horizontal spreading
    // Higher forceY strength keeps labels anchored near the baseline
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const simulation = d3Force.forceSimulation(nodes as any)
      .force('x', d3Force.forceX((d: PeakLabelNode) => d.targetX).strength(0.2))
      .force('y', d3Force.forceY(baseline).strength(0.1))
      .force('collide', d3Force.forceCollide((d: PeakLabelNode) => d.collisionRadius * 1.2).strength(1).iterations(6))
      .stop();

    // Run simulation with more iterations for better convergence
    for (let i = 0; i < 400; i++) {
      simulation.tick();
    }

    // Resolve any remaining overlaps
    resolveOverlaps(nodes);

    // Find the vertical extent of labels, accounting for angled text
    // For -45 degree rotation, text extends up-left from anchor point
    const angleRad = Math.abs(LABEL_ANGLE * Math.PI / 180);
    let minY = Infinity;
    let maxY = -Infinity;
    for (const node of nodes) {
      // Angled label extends upward by: labelWidth * sin(angle)
      const upwardExtent = node.labelWidth * Math.sin(angleRad);
      // And downward by approximately LABEL_HEIGHT * cos(angle)
      const downwardExtent = LABEL_HEIGHT * Math.cos(angleRad);

      minY = Math.min(minY, node.y - upwardExtent);
      maxY = Math.max(maxY, node.y + downwardExtent);
    }

    // Calculate required label area height
    const labelExtent = maxY - minY;
    const labelAreaHeight = Math.ceil(labelExtent + TOP_PADDING + BOTTOM_PADDING);

    // Shift all labels so that the topmost point is at TOP_PADDING
    const shift = TOP_PADDING - minY;
    for (const node of nodes) {
      node.y += shift;
      // Clamp X within bounds (account for angled label extending both directions)
      // With -45° rotation and textAnchor="start", text extends up-right from anchor
      const rightExtent = node.labelWidth * Math.cos(angleRad);
      const leftMargin = 10;
      const rightMargin = Math.max(10, rightExtent);
      node.x = Math.max(leftMargin, Math.min(width - rightMargin, node.x));
    }

    return { nodes, labelAreaHeight };
  }, [peaks, width, height, layout, yScale, contig, maxLabels]);
}

/**
 * Resolve remaining overlaps by pushing labels apart.
 * Prefers horizontal spreading over vertical stacking to keep labels closer to data.
 * Runs multiple passes to ensure all overlaps are resolved.
 */
function resolveOverlaps(nodes: PeakLabelNode[]): void {
  // Sort by X position for consistent processing
  const sorted = [...nodes].sort((a, b) => a.x - b.x);

  // Run multiple passes until no overlaps remain
  for (let pass = 0; pass < 15; pass++) {
    let hadOverlap = false;

    for (let i = 0; i < sorted.length; i++) {
      const current = sorted[i];

      for (let j = 0; j < sorted.length; j++) {
        if (i === j) continue;
        const other = sorted[j];

        if (labelsOverlap(current, other)) {
          hadOverlap = true;

          // Calculate overlap amounts in each direction
          const dx = current.x - other.x;
          const dy = current.y - other.y;
          const minDist = (current.collisionRadius + other.collisionRadius) * 0.7;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist === 0) {
            // Same position - push apart horizontally
            current.x += minDist / 2;
          } else {
            // Prefer horizontal separation: use a 2:1 bias for horizontal vs vertical
            const pushAmount = (minDist - dist) / 2 + MIN_LABEL_SPACING;
            const horizontalBias = 2;

            if (Math.abs(dx) * horizontalBias > Math.abs(dy)) {
              // Push horizontally
              const direction = dx >= 0 ? 1 : -1;
              current.x += direction * pushAmount;
            } else {
              // Push vertically (only if horizontal won't work well)
              // Move the one with higher Y (lower on screen) up above the other
              if (current.y >= other.y) {
                current.y = other.y - LABEL_HEIGHT - MIN_LABEL_SPACING;
              } else {
                other.y = current.y - LABEL_HEIGHT - MIN_LABEL_SPACING;
              }
            }
          }
        }
      }
    }

    if (!hadOverlap) break;
  }
}

/**
 * Check if two labels overlap using their collision radii
 */
function labelsOverlap(a: PeakLabelNode, b: PeakLabelNode): boolean {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  // Use larger multiplier for more conservative collision detection
  const minDist = (a.collisionRadius + b.collisionRadius) * 0.7;
  return dist < minDist;
}
