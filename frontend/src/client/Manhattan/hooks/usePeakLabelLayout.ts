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
  /** Total number of implicated genes in this peak */
  implicatedCount: number;
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
  implicatedCount: number
): number {
  let text = label;
  // Add space for burden dots (2 chars each: dot + space)
  if (burdenTypes.length > 0) text = '●'.repeat(burdenTypes.length) + ' ' + text;
  // Add space for coding indicator
  if (hasCoding) text += ' (C)';
  // Add space for multi-gene indicator
  if (implicatedCount > 1) text += ` +${implicatedCount - 1}`;
  return text.length * CHAR_WIDTH + LABEL_PADDING * 2;
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

    // Sort by p-value (most significant first) and limit to maxLabels
    // to prevent SVG collision chaos with too many labels
    const topPeaks = [...filteredPeaks]
      .sort((a, b) => a.pvalue - b.pvalue)
      .slice(0, maxLabels);

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

      const topGene = peak.genes[0];
      if (!topGene) {
        continue;
      }

      // Collect burden types from all genes in this peak
      const SIG_THRESHOLD = 2.5e-6;
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

      // Check if top gene has coding variants
      const codingCount = topGene.coding_variant_count || 0;
      const hasCoding = codingCount > 0;

      const labelWidth = estimateLabelWidth(topGene.gene_symbol, burdenTypes, hasCoding, implicatedCount);

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
        implicatedCount,
      });
    }

    if (nodes.length === 0) {
      return { nodes: [], labelAreaHeight: 0 };
    }

    // Sort by x position
    nodes.sort((a, b) => a.targetX - b.targetX);

    // Initial pass: position labels at a baseline, then let force push them up
    // Start with labels at y=100 (arbitrary starting point)
    const baseline = 100;
    for (const node of nodes) {
      node.y = baseline;
    }

    // Run force simulation - labels will spread out to avoid collisions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const simulation = d3Force.forceSimulation(nodes as any)
      .force('x', d3Force.forceX((d: PeakLabelNode) => d.targetX).strength(0.4))
      .force('y', d3Force.forceY(baseline).strength(0.05))
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
      // Clamp X within bounds (account for angled label extending left)
      const leftExtent = node.labelWidth * Math.cos(angleRad);
      const xMargin = Math.max(10, leftExtent);
      node.x = Math.max(xMargin, Math.min(width - 10, node.x));
    }

    return { nodes, labelAreaHeight };
  }, [peaks, width, height, layout, yScale, contig, maxLabels]);
}

/**
 * Resolve remaining overlaps by stacking labels.
 * Runs multiple passes to ensure all overlaps are resolved.
 */
function resolveOverlaps(nodes: PeakLabelNode[]): void {
  // Sort by X position for consistent processing
  const sorted = [...nodes].sort((a, b) => a.x - b.x);

  // Run multiple passes until no overlaps remain
  for (let pass = 0; pass < 10; pass++) {
    let hadOverlap = false;

    for (let i = 0; i < sorted.length; i++) {
      const current = sorted[i];

      for (let j = 0; j < sorted.length; j++) {
        if (i === j) continue;
        const other = sorted[j];

        if (labelsOverlap(current, other)) {
          hadOverlap = true;
          // Move the one with higher Y (lower on screen) up above the other
          if (current.y >= other.y) {
            current.y = other.y - LABEL_HEIGHT - MIN_LABEL_SPACING;
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
