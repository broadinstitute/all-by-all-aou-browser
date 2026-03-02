import React, { useEffect, useMemo, useRef } from 'react'
import styled, { useTheme } from 'styled-components'

import type { VariantJoined } from '../types'

import { createLogLogScaleY } from './logLogScale'

import { renderPoint } from './genePageUtils/renderPoint'
import { VariantPlotProps } from './LocusPagePlots'
import { sortVariantsByConsequence, sortVariantsByCorrelation } from '../utils'
import { getCategoryFromConsequence } from '../vepConsequences'

const PlotWrapper = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
`

const marginBottom = 40

// Height reserved for lollipop labels above the plot
// Increased to accommodate vertical labels that can be 60+ pixels tall
const LABEL_ZONE_HEIGHT = 120

// Parse hgvsp to extract short label (e.g., "p.Val600Glu" -> "V600E")
function parseHgvspLabel(hgvsp: string | undefined | null): string {
  if (!hgvsp) return '';

  // Handle "p.Val600Glu" format - convert to single letter
  const match = hgvsp.match(/p\.([A-Z][a-z]{2})(\d+)([A-Z][a-z]{2})/);
  if (match) {
    const aa3to1: Record<string, string> = {
      Ala: 'A', Arg: 'R', Asn: 'N', Asp: 'D', Cys: 'C',
      Glu: 'E', Gln: 'Q', Gly: 'G', His: 'H', Ile: 'I',
      Leu: 'L', Lys: 'K', Met: 'M', Phe: 'F', Pro: 'P',
      Ser: 'S', Thr: 'T', Trp: 'W', Tyr: 'Y', Val: 'V',
      Ter: '*',
    };
    const ref = aa3to1[match[1]] || match[1];
    const pos = match[2];
    const alt = aa3to1[match[3]] || match[3];
    return `${ref}${pos}${alt}`;
  }

  // Handle "p.V600E" format (already single letter)
  const shortMatch = hgvsp.match(/p\.([A-Z])(\d+)([A-Z*])/);
  if (shortMatch) {
    return `${shortMatch[1]}${shortMatch[2]}${shortMatch[3]}`;
  }

  // Handle synonymous "p.Val600=" format
  const synMatch = hgvsp.match(/p\.([A-Z][a-z]{2})(\d+)=/);
  if (synMatch) {
    const aa3to1: Record<string, string> = {
      Ala: 'A', Arg: 'R', Asn: 'N', Asp: 'D', Cys: 'C',
      Glu: 'E', Gln: 'Q', Gly: 'G', His: 'H', Ile: 'I',
      Leu: 'L', Lys: 'K', Met: 'M', Phe: 'F', Pro: 'P',
      Ser: 'S', Thr: 'T', Trp: 'W', Tyr: 'Y', Val: 'V',
    };
    const ref = aa3to1[synMatch[1]] || synMatch[1];
    return `${ref}${synMatch[2]}=`;
  }

  // Fallback: strip "p." prefix if present
  return hgvsp.replace(/^p\./, '');
}

// Get consequence priority for sorting (higher = more severe)
export function getConsequencePriority(csq: string): number {
  const cat = getCategoryFromConsequence(csq);
  if (cat === 'lof' || cat === 'pLoF') return 4;
  if (cat === 'missense' || cat === 'missenseLC') return 3;
  if (cat === 'synonymous') return 2;
  return 1;
}

// Get tier name from consequence priority
export function getTierFromPriority(priority: number): 'pLoF' | 'missense' | 'other' {
  if (priority >= 4) return 'pLoF';
  if (priority === 3) return 'missense';
  return 'other';
}

// Tier colors
export const TIER_COLORS = {
  pLoF: '#c62828',     // Red for loss of function
  missense: '#f57c00', // Orange for missense
  other: '#757575',    // Gray for other
} as const;

interface LollipopLabel {
  variant: VariantJoined;
  label: string;
  anchorX: number;     // genomic position in pixels (anchor point)
  x: number;           // current x position (may be spread)
  pointY: number;      // variant point Y position in plot area
  labelY: number;      // label Y position (tier-based)
  color: string;
  priority: number;
  tier: 'pLoF' | 'missense' | 'other';
  labelWidth: number;
  showLabel: boolean;
  labelAngle: number;  // 0 = horizontal, -45 = diagonal, -90 = vertical
}

// Clustered layout: group nearby variants and spread evenly within clusters
function runClusteredLayout(
  labels: LollipopLabel[],
  width: number,
  ctx: CanvasRenderingContext2D
): void {
  if (labels.length === 0) return;
  if (labels.length === 1) {
    labels[0].x = labels[0].anchorX;
    labels[0].showLabel = true;
    return;
  }

  // Sort by anchor position
  labels.sort((a, b) => a.anchorX - b.anchorX);

  // Measure label widths
  ctx.font = 'bold 10px sans-serif';
  for (const lbl of labels) {
    lbl.labelWidth = ctx.measureText(lbl.label).width + 4;
  }

  // Calculate minimum spacing needed for labels
  const minSpacing = Math.max(
    ...labels.map(l => l.labelWidth * 0.8 + 8),
    25  // Minimum 25px spacing
  );

  // Cluster variants that are close together (within 2.5x minSpacing)
  const clusterThreshold = minSpacing * 2.5;
  const clusters: LollipopLabel[][] = [];
  let currentCluster: LollipopLabel[] = [labels[0]];

  for (let i = 1; i < labels.length; i++) {
    const prev = labels[i - 1];
    const curr = labels[i];

    if (curr.anchorX - prev.anchorX <= clusterThreshold) {
      currentCluster.push(curr);
    } else {
      clusters.push(currentCluster);
      currentCluster = [curr];
    }
  }
  clusters.push(currentCluster);

  // Layout each cluster
  const margin = 30;

  for (const cluster of clusters) {
    if (cluster.length === 1) {
      cluster[0].x = cluster[0].anchorX;
      continue;
    }

    // Calculate cluster bounds
    const minAnchor = cluster[0].anchorX;
    const maxAnchor = cluster[cluster.length - 1].anchorX;
    const anchorSpan = maxAnchor - minAnchor;
    const midpoint = (minAnchor + maxAnchor) / 2;

    // Required span for this cluster
    const requiredSpan = (cluster.length - 1) * minSpacing;
    const effectiveSpan = Math.max(anchorSpan, requiredSpan);

    // Position cluster centered on its anchor midpoint
    let startX = midpoint - effectiveSpan / 2;
    let endX = midpoint + effectiveSpan / 2;

    // Clamp to width bounds
    if (startX < margin) {
      startX = margin;
      endX = startX + effectiveSpan;
    }
    if (endX > width - margin) {
      endX = width - margin;
      startX = endX - effectiveSpan;
    }
    startX = Math.max(margin, startX);

    // Distribute evenly within cluster region
    const spacing = cluster.length > 1 ? (endX - startX) / (cluster.length - 1) : 0;
    for (let i = 0; i < cluster.length; i++) {
      cluster[i].x = startX + i * spacing;
    }
  }

  // Resolve inter-cluster overlaps
  resolveClusterOverlaps(clusters, minSpacing, width, margin);

  // Determine label angles based on density and show/hide labels
  resolveLabelCollisions(labels, width);
}

// Push clusters apart if they overlap
function resolveClusterOverlaps(
  clusters: LollipopLabel[][],
  minSpacing: number,
  width: number,
  margin: number
): void {
  if (clusters.length < 2) return;

  for (let iter = 0; iter < 5; iter++) {
    let hasOverlap = false;

    for (let i = 0; i < clusters.length - 1; i++) {
      const leftCluster = clusters[i];
      const rightCluster = clusters[i + 1];

      const leftRight = leftCluster[leftCluster.length - 1].x;
      const rightLeft = rightCluster[0].x;
      const gap = rightLeft - leftRight;

      if (gap < minSpacing) {
        hasOverlap = true;
        const shift = (minSpacing - gap) / 2 + 2;

        for (const l of leftCluster) {
          l.x = Math.max(margin, l.x - shift);
        }
        for (const l of rightCluster) {
          l.x = Math.min(width - margin, l.x + shift);
        }
      }
    }

    if (!hasOverlap) break;
  }
}

// Calculate horizontal footprint of a label at a given angle
function getLabelFootprint(labelWidth: number, angle: number): number {
  if (angle === 0) return labelWidth;
  if (angle === -45) return labelWidth * 0.707;
  if (angle === -90) return 12;
  return labelWidth * Math.abs(Math.cos(angle * Math.PI / 180));
}

// Determine which labels to show and at what angle based on density
function resolveLabelCollisions(labels: LollipopLabel[], width: number): void {
  if (labels.length === 0) return;

  // Sort by X position
  const sorted = [...labels].sort((a, b) => a.x - b.x);

  // Calculate average spacing to determine density
  const avgSpacing = sorted.length > 1
    ? (sorted[sorted.length - 1].x - sorted[0].x) / (sorted.length - 1)
    : width;

  // Choose angle based on density
  let labelAngle = 0;
  if (avgSpacing < 30) {
    labelAngle = -90;  // Very dense: vertical
  } else if (avgSpacing < 60) {
    labelAngle = -45;  // Medium: diagonal
  }

  const labelGap = 4;
  let rightBoundary = -Infinity;

  for (const lbl of sorted) {
    lbl.labelAngle = labelAngle;

    const labelStart = lbl.x + 3;  // Small offset from center
    const footprint = getLabelFootprint(lbl.labelWidth, labelAngle);

    if (labelStart > rightBoundary) {
      lbl.showLabel = true;
      rightBoundary = labelStart + footprint + labelGap;
    } else {
      lbl.showLabel = false;
      rightBoundary = Math.max(rightBoundary, lbl.x + labelGap);
    }

    // Don't let labels extend past right edge
    if (labelStart + footprint > width - 10) {
      lbl.showLabel = false;
    }
  }
}

export const LocusPvaluePlot = ({
  variantDatasets = [],
  activeAnalysis,
  activeVariant,
  transparency,
  logLogEnabled = true,
  scalePosition,
  leftPanelWidth,
  rightPanelWidth,
  height = 400,
  width = 1100,
  alleleFrequencyScale,
  betaScale,
  onClickPoint = (d) => console.log(JSON.stringify(d)),
  pointColor = () => '#383838',
  pointLabel = (d) => {
    let variantLabel = 'FIXME'
    if (d.variant_id !== null) {
      variantLabel = d.variant_id
    }
    if (d.pvalue) {
      return `${variantLabel} (${d.pvalue})`
    }

    return variantLabel
  },
  selectedVariant,
  thresholds = [],
  xLabel = '',
  yLabel = '-log10(p)',
  applyStroke,
  gwasCatalogOption = 'hide',
  showLollipopLabels = true,
  lollipopPvalueThreshold = 1e-4,
  variantLabels = {},
  reverseConsequenceSort = false,
  labelZoneHeight = 0,
  tierY = {},
}: VariantPlotProps & { showLollipopLabels?: boolean; lollipopPvalueThreshold?: number; variantLabels?: Record<string, string>; reverseConsequenceSort?: boolean; labelZoneHeight?: number; tierY?: Record<string, number> }) => {
  const theme = useTheme() as any;

  // Add extra height for lollipop labels if enabled
  const totalHeight = height + labelZoneHeight

  const margin = {
    bottom: marginBottom,
    left: leftPanelWidth,
    right: rightPanelWidth,
    top: 40 + labelZoneHeight,  // Push plot down to make room for labels
  }

  // Margin for scale calculation (without label zone offset)
  const scaleMargin = {
    bottom: marginBottom,
    top: 40,
  }

  const variantsAll = variantDatasets.flatMap((v) => v)

  const logLogScale = createLogLogScaleY({ variants: variantsAll, margin: scaleMargin, height, logLogEnabled })

  const points = variantDatasets.flatMap((variants) =>
    variants.map((d) => {
      const pvalue = -Math.log10(d.pvalue) || 0

      return {
        data: d,
        x: (scalePosition(d.locus && d.locus.position) as number) || 0,
        y: logLogScale(pvalue),
      }
    })
  ).sort((a, b) => {
    const sortValue = sortVariantsByConsequence(a.data, b.data)
    // Reverse sort for region pages (when reverseConsequenceSort is true)
    // to account for different compositing behavior
    return reverseConsequenceSort ? -sortValue : sortValue
  })

  const scale = window.devicePixelRatio || 2

  const plotCanvas = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.height = totalHeight * scale
    canvas.width = width * scale

    const ctx = canvas.getContext('2d')!

    ctx.setTransform(scale, 0, 0, scale, 0, 0)
    ctx.save()  // Save DPR transform as base state

    ctx.lineWidth = 1

    const w = width - margin.left - margin.right

    ctx.save()

    ctx.transform(1, 0, 0, 1, margin.left, margin.top)


    for (let i = 0; i < points.length; i += 1) {
      const point = points[i]

      renderPoint({
        ctx,
        point,
        selectedVariant,
        activeVariant,
        activeAnalysis,
        margin,
        alleleFrequencyScale,
        pointColor,
        transparency,
        betaScale,
        height,
        applyStroke,
        gwasCatalogOption,
        theme,
      })
    }

    ctx.restore()

    // Significance thresholds
    // ====================================================

    ctx.save()

    ctx.transform(1, 0, 0, 1, margin.left, margin.top)

    ctx.globalCompositeOperation = 'destination-over'
    thresholds.forEach((threshold) => {
      const thresholdY = logLogScale(-Math.log10(threshold.value)) || 0
      ctx.beginPath()
      ctx.moveTo(0, thresholdY)
      ctx.lineTo(w, thresholdY)
      ctx.setLineDash([3, 3])
      ctx.lineWidth = 2
      ctx.strokeStyle = threshold.color || '#333'
      ctx.stroke()

      if (threshold.label) {
        ctx.font = '14px sans-serif'
        ctx.fillStyle = theme.text || '#000'
        ctx.fillText(threshold.label, 2, thresholdY - 4)
      }
    })

    ctx.restore()

    // ====================================================

    // Lollipop labels for significant variants (tiered by consequence)
    // ====================================================
    if (showLollipopLabels && labelZoneHeight > 0) {
      ctx.save()
      ctx.setLineDash([])  // Reset line dash

      // Get significant variants with HGVS labels, grouped by tier
      // Also include any variant with a custom label, regardless of p-value
      const allLabels: LollipopLabel[] = points
        .filter(p => {
          const hasCustomLabel = variantLabels[p.data.variant_id];
          const isSignificant = p.data.pvalue && p.data.pvalue < lollipopPvalueThreshold;
          const hasHgvs = p.data.hgvsp || p.data.hgvsc;
          return hasCustomLabel || (isSignificant && hasHgvs);
        })
        .map(p => {
          // Use custom label if available, otherwise fall back to HGVS
          const customLabel = variantLabels[p.data.variant_id];
          const hgvsLabel = parseHgvspLabel(p.data.hgvsp) || (p.data.hgvsc ? p.data.hgvsc.split(':').pop() || '' : '');
          const label = customLabel || hgvsLabel;
          const priority = getConsequencePriority(p.data.consequence || '');
          const tier = getTierFromPriority(priority);
          const color = TIER_COLORS[tier];
          return {
            variant: p.data,
            label,
            anchorX: p.x,
            x: p.x,
            pointY: p.y + margin.top,  // Absolute Y position of the point
            labelY: tierY[tier] ?? 40,  // Y position based on dynamic tier
            color,
            priority: customLabel ? priority + 10000 : priority,  // Boost priority for custom-labeled variants
            tier,
            labelWidth: 0,  // Will be calculated during layout
            showLabel: true,
            labelAngle: 0,
          } as LollipopLabel;
        })
        .filter(l => l.label.length > 0 && l.tier !== 'other');

      // Group by tier
      const pLoFLabels = allLabels.filter(l => l.tier === 'pLoF');
      const missenseLabels = allLabels.filter(l => l.tier === 'missense');
      const otherLabels = allLabels.filter(l => l.tier === 'other');

      // Limit each tier to avoid overcrowding
      const maxPerTier = 15;
      const pLoFToShow = pLoFLabels
        .sort((a, b) => (a.variant.pvalue || 1) - (b.variant.pvalue || 1))
        .slice(0, maxPerTier);
      const missenseToShow = missenseLabels
        .sort((a, b) => (a.variant.pvalue || 1) - (b.variant.pvalue || 1))
        .slice(0, maxPerTier);
      const otherToShow = otherLabels
        .sort((a, b) => (a.variant.pvalue || 1) - (b.variant.pvalue || 1))
        .slice(0, Math.min(10, maxPerTier));

      // Run clustered layout for each tier
      runClusteredLayout(pLoFToShow, w, ctx);
      runClusteredLayout(missenseToShow, w, ctx);
      runClusteredLayout(otherToShow, w, ctx);

      // Combine all labels to show
      const labelsToShow = [...pLoFToShow, ...missenseToShow, ...otherToShow];

      // Draw stems and labels
      ctx.transform(1, 0, 0, 1, margin.left, 0);  // Position relative to left margin

      for (const lbl of labelsToShow) {
        if (!lbl.showLabel) continue;

        // Round coordinates to half-pixels for crisp 1px lines
        const x = Math.round(lbl.x) + 0.5;
        const anchorX = Math.round(lbl.anchorX) + 0.5;
        const pointY = Math.round(lbl.pointY) + 0.5;

        // Draw crankshaft stem from label to point
        // Structure: label -> vertical down -> diagonal to anchor -> vertical to point
        ctx.strokeStyle = lbl.color;
        ctx.lineWidth = 1.5;  // Slightly thicker for better visibility
        ctx.globalAlpha = 0.6;
        ctx.beginPath();

        const labelBottom = Math.round(lbl.labelY + 12) + 0.5;
        const kneeY = Math.round(lbl.labelY + 25) + 0.5;
        const anchorKneeY = Math.round(Math.max(kneeY + 15, pointY - 20)) + 0.5;

        // From label down
        ctx.moveTo(x, labelBottom);
        // Vertical down to knee
        ctx.lineTo(x, kneeY);
        // Diagonal to anchor position
        ctx.lineTo(anchorX, anchorKneeY);
        // Vertical to near the point
        ctx.lineTo(anchorX, pointY - 5);
        ctx.stroke();

        // Draw small dot at connection point (above the variant)
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.arc(Math.round(lbl.anchorX), Math.round(lbl.pointY) - 5, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = lbl.color;
        ctx.fill();

        // Draw label text with rotation based on density
        ctx.globalAlpha = 1;
        ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillStyle = lbl.color;

        // Round text positions for crisp rendering
        const textX = Math.round(lbl.x);
        const textY = Math.round(lbl.labelY);

        if (lbl.labelAngle === 0) {
          // Horizontal label
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(lbl.label, textX, textY + 10);
        } else if (lbl.labelAngle === -90) {
          // Vertical label
          ctx.save();
          ctx.translate(textX, textY);
          ctx.rotate(-Math.PI / 2);
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(lbl.label, 0, 0);
          ctx.restore();
        } else {
          // Diagonal label (-45)
          ctx.save();
          ctx.translate(textX, textY + 8);
          ctx.rotate(lbl.labelAngle * Math.PI / 180);
          ctx.textAlign = 'left';
          ctx.textBaseline = 'bottom';
          ctx.fillText(lbl.label, 0, 0);
          ctx.restore();
        }
      }

      ctx.restore();
    }
    // ====================================================

    return canvas
  }, [variantDatasets, totalHeight, pointColor, width, xLabel, yLabel, thresholds, activeAnalysis, showLollipopLabels, labelZoneHeight, lollipopPvalueThreshold])

  const mainCanvas: {
    current: HTMLCanvasElement | null
  } = useRef<HTMLCanvasElement>(null)

  const drawPlot = () => {
    const canvas = mainCanvas.current
    if (canvas) {
      const ctx: CanvasRenderingContext2D = canvas.getContext('2d')!
      ctx.setTransform(scale, 0, 0, scale, 0, 0)
      ctx.clearRect(0, 0, width, totalHeight)
      ctx.drawImage(plotCanvas, 0, 0, width, totalHeight)
    }
  }

  useEffect(drawPlot)

  const findNearestPoint = (x = 0, y = 0, distanceThreshold = 5) => {
    let nearestPoint
    let minDistance = Infinity


    for (let i = 0; i < points.length; i += 1) {
      const p = points[i]
      const d = Math.sqrt((p.x - x) ** 2 + (p.y - y) ** 2)
      if (d < minDistance) {
        nearestPoint = p
        minDistance = d
      }
    }

    return minDistance <= distanceThreshold ? nearestPoint : undefined
  }

  const updateHoveredPoint = (x: number, y: number) => {
    const nearestPoint = findNearestPoint(x, y)

    drawPlot()

    if (nearestPoint) {
      const canvas = mainCanvas.current
      if (canvas) {
        const ctx = canvas.getContext('2d')!
        ctx.save()

        ctx.transform(1, 0, 0, 1, margin.left, margin.top)

        ctx.font = '14px sans-serif'
        const label = pointLabel(nearestPoint.data)
        const { width: textWidth } = ctx.measureText(label)

        const labelX = x < width / 2 ? nearestPoint.x : nearestPoint.x - textWidth - 10
        const labelY = y < 30 ? nearestPoint.y : nearestPoint.y - 24

        ctx.beginPath()
        ctx.rect(labelX, labelY, textWidth + 12, 24)
        ctx.fillStyle = theme.surface || '#000'
        ctx.fill()

        ctx.strokeStyle = theme.border || '#333'
        ctx.strokeRect(labelX, labelY, textWidth + 12, 24)

        ctx.fillStyle = theme.text || '#fff'
        ctx.fillText(label, labelX + 6, labelY + 16)

        ctx.restore()
      }
    }
  }

  const onMouseMove = (event: React.MouseEvent) => {
    const bounds = (event.target as HTMLElement).getBoundingClientRect()
    const mouseX = event.clientX - bounds.left - margin.left
    const mouseY = event.clientY - bounds.top - margin.top
    updateHoveredPoint(mouseX, mouseY)
  }

  const onClick = (event: React.MouseEvent) => {
    const bounds = (event.target as HTMLElement).getBoundingClientRect()
    const clickX = event.clientX - bounds.left - margin.left
    const clickY = event.clientY - bounds.top - margin.top

    const point = findNearestPoint(clickX, clickY)
    if (point) {
      onClickPoint(point.data)
    }
  }

  return (
    <PlotWrapper>
      <canvas
        ref={mainCanvas}
        height={totalHeight * scale}
        width={width * scale}
        style={{
          height: `${totalHeight}px`,
          width: `${width}px`,
        }}
        onClick={onClick}
        onMouseLeave={drawPlot}
        onMouseMove={onMouseMove}
      />
    </PlotWrapper>
  )
}

interface LeftPanelProps {
  height: number
  width: number
  variantDatasets: VariantJoined[][]
  axisTicks: number[]
  labelZoneHeight?: number
}

export const LeftPanel: React.FC<LeftPanelProps & { tierY?: Record<string, number> }> = ({
  height,
  variantDatasets,
  width,
  axisTicks,
  labelZoneHeight = 0,
  tierY = {},
}) => {
  const theme = useTheme() as any;
  const hPadding = 30

  const totalHeight = height + labelZoneHeight
  const variantsAll = variantDatasets.flatMap((v) => v)

  const margin = {
    bottom: marginBottom,
    top: 40 + labelZoneHeight,  // Account for label zone
  }

  // Margin for scale calculation (without label zone offset)
  const scaleMargin = {
    bottom: marginBottom,
    top: 40,
  }

  const logLogScale = createLogLogScaleY({
    variants: variantsAll,
    margin: scaleMargin,
    height,
    logLogEnabled: true,
  })

  // Offset for labels/ticks to account for label zone
  const yOffset = labelZoneHeight

  const yAxisLabel = (
    <text x={5} y={(totalHeight + yOffset) / 2} transform={`rotate(270 ${hPadding / 3} ${(totalHeight + yOffset) / 2})`} fill={theme.text}>
      {'-log10(P)'}
    </text>
  )

  const yAxisTicks = (
    <g>
      {axisTicks.map((t) => {
        return (
          <g key={t}>
            <text
              className='yTickText'
              textAnchor='middle'
              x={hPadding - 5}
              y={logLogScale(t) + marginBottom + yOffset - 2}
              fill={theme.text}
            >
              {t.toFixed(0)}
            </text>
          </g>
        )
      })}
      <text className='yTickText' textAnchor='middle' x={hPadding - 5} y={labelZoneHeight + 30} fill={theme.text} fontSize="10">
        &gt;300
      </text>
    </g>
  )

  const yAxisStart = logLogScale(0) + marginBottom + yOffset
  const yAxisEnd = logLogScale(100) + marginBottom + yOffset

  const yAxis = (
    <g>
      <line x1={43} x2={43} y1={yAxisStart} y2={yAxisEnd} stroke={theme.border} />
      <line x1={marginBottom} x2={43} y1={yAxisEnd} y2={yAxisEnd} stroke={theme.border} />
      <line x1={marginBottom} x2={43} y1={yAxisStart} y2={yAxisStart} stroke={theme.border} />
    </g>
  )

  const NoPValLabel = (
    <text x={0} y={totalHeight - 10} fill={theme.text}>
      {'No P-val'}
    </text>
  )

  // Tier labels in the label zone
  const tierLabels = labelZoneHeight > 0 ? (
    <g>
      {tierY.pLoF !== undefined && <text x={width - 5} y={tierY.pLoF + 4} fontSize="9" fill={TIER_COLORS.pLoF} textAnchor="end" fontWeight="bold">pLoF</text>}
      {tierY.missense !== undefined && <text x={width - 5} y={tierY.missense + 4} fontSize="9" fill={TIER_COLORS.missense} textAnchor="end" fontWeight="bold">missense</text>}
    </g>
  ) : null

  return (
    <svg width={width} height={totalHeight}>
      <rect fill='none' style={{ border: `1px solid ${theme.border}` }} />
      {tierLabels}
      {yAxisLabel}
      {yAxisTicks}
      {yAxis}
      {NoPValLabel}
    </svg>
  )
}
