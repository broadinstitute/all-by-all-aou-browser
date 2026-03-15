import React, { useEffect, useMemo, useRef, useState } from 'react'
import styled, { useTheme } from 'styled-components'

import type { VariantJoined } from '../types'

import { createLogLogScaleY } from './logLogScale'

import { renderPoint } from './genePageUtils/renderPoint'
import { VariantPlotProps } from './LocusPagePlots'
import { sortVariantsByConsequence, sortVariantsByCorrelation } from '../utils'
import { getCategoryFromConsequence } from '../vepConsequences'
import { useRecoilValue, useRecoilState } from 'recoil'
import { variantShowLabelAtom } from '../variantState'
import { UnifiedContextMenu } from '../components/UnifiedContextMenu'

const PlotWrapper = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  position: relative;
`

const TooltipContainer = styled.div<{ x: number; y: number }>`
  position: absolute;
  left: ${(props) => props.x}px;
  top: ${(props) => props.y}px;
  background: var(--theme-surface, white);
  color: var(--theme-text, #333);
  border: 1px solid var(--theme-border, #ccc);
  border-radius: 4px;
  padding: 8px 12px;
  font-size: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  pointer-events: none;
  z-index: 1000;
  transform: translate(-50%, -100%);
  margin-top: -10px;
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
  id: string;
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
  width: number
): void {
  if (labels.length === 0) return;
  if (labels.length === 1) {
    labels[0].x = labels[0].anchorX;
    labels[0].showLabel = true;
    // Estimate width
    labels[0].labelWidth = labels[0].label.length * 6 + 4;
    return;
  }

  // Sort by anchor position
  labels.sort((a, b) => a.anchorX - b.anchorX);

  // Estimate label widths
  for (const lbl of labels) {
    lbl.labelWidth = lbl.label.length * 6 + 4;
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
  selectedVariantId,
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
  labelZoneHeight = 0,
  tierY = {},
  labelOverrides = {},
  onLabelDragEnd,
}: VariantPlotProps & {
  showLollipopLabels?: boolean;
  lollipopPvalueThreshold?: number;
  variantLabels?: Record<string, string>;
  labelZoneHeight?: number;
  tierY?: Record<string, number>;
  labelOverrides?: Record<string, {x: number, y: number}>;
  onLabelDragEnd?: (id: string, x: number, y: number) => void;
}) => {
  const theme = useTheme() as any;
  const [variantShowLabel, setVariantShowLabel] = useRecoilState(variantShowLabelAtom);
  const [hoveredHit, setHoveredHit] = useState<VariantJoined | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [dragState, setDragState] = useState<{ id: string, startX: number, startY: number, initialX: number, initialY: number } | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number, y: number } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; variant: VariantJoined } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

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
    return sortVariantsByConsequence(a.data, b.data)
  })

  const scale = window.devicePixelRatio || 2

  // Extract layout preparation into a pure useMemo
  const labelsToRender = useMemo(() => {
    if (!showLollipopLabels || labelZoneHeight <= 0) return [];

    const w = width - margin.left - margin.right;

    const allLabels: LollipopLabel[] = points
      .filter(p => {
        // If a variant is explicitly selected, show ONLY its label
        if (selectedVariantId) {
          return p.data.variant_id === selectedVariantId;
        }

        const hasCustomLabel = variantLabels[p.data.variant_id];
        const explicitlySet = variantShowLabel[p.data.variant_id];
        const hasHgvs = p.data.hgvsp || p.data.hgvsc;

        // Only show labels for variants that have HGVS data or a custom label
        if (!hasCustomLabel && !hasHgvs) {
          return false;
        }

        if (explicitlySet !== undefined) {
          return explicitlySet || !!hasCustomLabel;
        }

        const isSignificant = p.data.pvalue && p.data.pvalue < lollipopPvalueThreshold;
        return !!hasCustomLabel || (isSignificant && hasHgvs);
      })
      .map(p => {
        const customLabel = variantLabels[p.data.variant_id];
        const hgvsLabel = parseHgvspLabel(p.data.hgvsp) || (p.data.hgvsc ? p.data.hgvsc.split(':').pop() || '' : '');
        // Fallback to variant_id if no HGVS notation available
        const label = customLabel || hgvsLabel || p.data.variant_id;
        const priority = getConsequencePriority(p.data.consequence || '');
        const tier = getTierFromPriority(priority);
        const color = TIER_COLORS[tier];
        return {
          id: p.data.variant_id,
          variant: p.data,
          label,
          anchorX: p.x,
          x: p.x,
          pointY: p.y + margin.top,
          labelY: tierY[tier] ?? 40,
          color,
          priority: customLabel || variantShowLabel[p.data.variant_id] ? priority + 10000 : priority,
          tier,
          labelWidth: 0,
          showLabel: true,
          labelAngle: 0,
        } as LollipopLabel;
      });
      // No need to filter by label length since we now guarantee all variants have at least variant_id as label

    // Bypass layout limits when highlighting a specifically selected variant
    if (selectedVariantId) {
      runClusteredLayout(allLabels, w);
      return allLabels;
    }

    const pLoFLabels = allLabels.filter(l => l.tier === 'pLoF');
    const missenseLabels = allLabels.filter(l => l.tier === 'missense');
    const otherLabels = allLabels.filter(l => l.tier === 'other');

    const maxPerTier = 15;
    const pLoFToShow = pLoFLabels.sort((a, b) => (a.variant.pvalue || 1) - (b.variant.pvalue || 1)).slice(0, maxPerTier);
    const missenseToShow = missenseLabels.sort((a, b) => (a.variant.pvalue || 1) - (b.variant.pvalue || 1)).slice(0, maxPerTier);
    const otherToShow = otherLabels.sort((a, b) => (a.variant.pvalue || 1) - (b.variant.pvalue || 1)).slice(0, Math.min(10, maxPerTier));

    runClusteredLayout(pLoFToShow, w);
    runClusteredLayout(missenseToShow, w);
    runClusteredLayout(otherToShow, w);

    return [...pLoFToShow, ...missenseToShow, ...otherToShow];
  }, [points, showLollipopLabels, labelZoneHeight, lollipopPvalueThreshold, variantLabels, variantShowLabel, width, margin.left, margin.right, margin.top, tierY]);

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


    // Split into two arrays to guarantee highlighted points always draw on top
    const normalPoints = [];
    const highlightPoints = [];

    for (let i = 0; i < points.length; i += 1) {
      const point = points[i];
      const isExplicitlySelected = selectedVariantId && point.data.variant_id === selectedVariantId;
      const isHovered = activeVariant && point.data.variant_id === activeVariant;
      const isActiveAnalysis = activeAnalysis && activeVariant && point.data.analysis_id === activeAnalysis && point.data.variant_id === activeVariant;

      if (isExplicitlySelected || isHovered || isActiveAnalysis) {
        highlightPoints.push(point);
      } else {
        normalPoints.push(point);
      }
    }

    // Pass 1: Draw normal points
    for (let i = 0; i < normalPoints.length; i += 1) {
      renderPoint({
        ctx,
        point: normalPoints[i],
        selectedVariant,
        selectedVariantId,
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

    // Pass 2: Draw highlighted points so they sit on top
    for (let i = 0; i < highlightPoints.length; i += 1) {
      renderPoint({
        ctx,
        point: highlightPoints[i],
        selectedVariant,
        selectedVariantId,
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

    return canvas
  }, [variantDatasets, totalHeight, pointColor, width, xLabel, yLabel, thresholds, activeAnalysis, selectedVariantId, showLollipopLabels, labelZoneHeight, lollipopPvalueThreshold])

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

  // Handle label dragging on window to avoid clipping
  useEffect(() => {
    if (!dragState) return;

    const handleMouseMoveWindow = (e: MouseEvent) => {
      const dx = e.clientX - dragState.startX;
      const dy = e.clientY - dragState.startY;
      setDragPos({ x: dragState.initialX + dx, y: dragState.initialY + dy });
    };

    const handleMouseUpWindow = () => {
      if (dragPos && onLabelDragEnd) {
        onLabelDragEnd(dragState.id, dragPos.x, dragPos.y);
      }
      setDragState(null);
      setDragPos(null);
    };

    window.addEventListener('mousemove', handleMouseMoveWindow);
    window.addEventListener('mouseup', handleMouseUpWindow);

    return () => {
      window.removeEventListener('mousemove', handleMouseMoveWindow);
      window.removeEventListener('mouseup', handleMouseUpWindow);
    };
  }, [dragState, dragPos, onLabelDragEnd]);

  const updateHoveredPoint = (x: number, y: number) => {
    if (dragState) return; // don't update hover during drag
    const nearestPoint = findNearestPoint(x, y);
    drawPlot();

    if (nearestPoint) {
      setHoveredHit(nearestPoint.data);
      // Tooltip position relative to plot container
      setTooltipPos({ x: x + margin.left, y: y + margin.top });
    } else {
      setHoveredHit(null);
    }
  };

  const onMouseMove = (event: React.MouseEvent) => {
    const bounds = (event.target as HTMLElement).getBoundingClientRect();
    const mouseX = event.clientX - bounds.left - margin.left;
    const mouseY = event.clientY - bounds.top - margin.top;
    updateHoveredPoint(mouseX, mouseY);
  };

  const onMouseLeave = () => {
    drawPlot();
    setHoveredHit(null);
  };

  const onClick = (event: React.MouseEvent) => {
    const bounds = (event.target as HTMLElement).getBoundingClientRect()
    const clickX = event.clientX - bounds.left - margin.left
    const clickY = event.clientY - bounds.top - margin.top

    const point = findNearestPoint(clickX, clickY)
    if (point) {
      onClickPoint(point.data)
    }
  }

  const onContextMenu = (event: React.MouseEvent) => {
    event.preventDefault()
    const bounds = (event.target as HTMLElement).getBoundingClientRect()
    const clickX = event.clientX - bounds.left - margin.left
    const clickY = event.clientY - bounds.top - margin.top

    const point = findNearestPoint(clickX, clickY)
    if (point) {
      setContextMenu({ x: event.clientX, y: event.clientY, variant: point.data })
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
          display: 'block'
        }}
        onClick={onClick}
        onContextMenu={onContextMenu}
        onMouseLeave={onMouseLeave}
        onMouseMove={onMouseMove}
      />

      {/* Draggable SVG overlay for labels */}
      {labelsToRender.length > 0 && (
        <svg
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: `${width}px`,
            height: `${totalHeight}px`,
            pointerEvents: 'none'
          }}
        >
          <g transform={`translate(${margin.left}, 0)`}>
            {labelsToRender.map((lbl) => {
              if (!lbl.showLabel) return null;

              const isDragging = dragState?.id === lbl.id;
              const x = isDragging && dragPos ? dragPos.x : (labelOverrides[lbl.id]?.x ?? lbl.x);
              const y = isDragging && dragPos ? dragPos.y : (labelOverrides[lbl.id]?.y ?? lbl.labelY);

              const labelBottom = y + 12;
              const kneeY = y + 25;
              const anchorKneeY = Math.max(kneeY + 15, lbl.pointY - 20);

              // Crankshaft stem - points directly down to lbl.pointY - 2 (no mini circle needed)
              const pathD = `M ${x} ${labelBottom} L ${x} ${kneeY} L ${lbl.anchorX} ${anchorKneeY} L ${lbl.anchorX} ${lbl.pointY - 2}`;

              return (
                <g key={lbl.id}>
                  <path
                    d={pathD}
                    stroke={lbl.color}
                    strokeWidth={1.5}
                    fill="none"
                    opacity={0.6}
                  />
                  {/* Removed duplicate mini circle here */}
                  <g
                    transform={`translate(${x}, ${y})`}
                    style={{ cursor: isDragging ? 'grabbing' : 'grab', pointerEvents: 'all' }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDragState({ id: lbl.id, startX: e.clientX, startY: e.clientY, initialX: x, initialY: y });
                      setDragPos({ x, y });
                    }}
                  >
                    <text
                      textAnchor={lbl.labelAngle === 0 ? "center" : "start"}
                      dominantBaseline={lbl.labelAngle === 0 ? "text-after-edge" : "middle"}
                      transform={lbl.labelAngle !== 0 ? `rotate(${lbl.labelAngle}) translate(0, ${lbl.labelAngle === -90 ? 0 : 8})` : `translate(0, 10)`}
                      fontFamily="-apple-system, BlinkMacSystemFont, sans-serif"
                      fontSize="11px"
                      fontWeight="bold"
                      fill={lbl.color}
                    >
                      {lbl.label}
                    </text>
                  </g>
                </g>
              );
            })}
          </g>
        </svg>
      )}

      {hoveredHit && (
        <TooltipContainer x={tooltipPos.x} y={tooltipPos.y}>
          <div style={{ fontWeight: 600 }}>{hoveredHit.variant_id}</div>
          <div style={{ color: 'var(--theme-text-muted)', fontSize: 11 }}>{hoveredHit.gene_symbol || '—'}</div>
          <div style={{ marginTop: 4 }}>
            <span style={{ color: 'var(--theme-text-muted)' }}>Consequence: </span>
            <span style={{ fontWeight: 500, color: TIER_COLORS[getTierFromPriority(getConsequencePriority(hoveredHit.consequence))] || '#333' }}>
              {hoveredHit.consequence.replace(/_/g, ' ')}
            </span>
          </div>
          <div>
            <span style={{ color: 'var(--theme-text-muted)' }}>HGVS: </span>
            <span>{hoveredHit.hgvsp ? hoveredHit.hgvsp.split(':')[1] : (hoveredHit.hgvsc ? hoveredHit.hgvsc.split(':')[1] : '—')}</span>
          </div>
          <div>
            <span style={{ color: 'var(--theme-text-muted)' }}>AF: </span>
            <span style={{ fontFamily: 'monospace' }}>{(hoveredHit.allele_frequency || hoveredHit.af_cases || 0).toExponential(2)}</span>
          </div>
          <div>
            <span style={{ color: 'var(--theme-text-muted)' }}>Beta: </span>
            <span style={{ fontFamily: 'monospace' }}>{(hoveredHit.beta || 0).toFixed(3)}</span>
          </div>
          <div>
            <span style={{ color: 'var(--theme-text-muted)' }}>P-value: </span>
            <span style={{ fontFamily: 'monospace' }}>{(hoveredHit.pvalue || 1).toExponential(2)}</span>
          </div>
        </TooltipContainer>
      )}

      {/* Context menu for variant labeling */}
      {contextMenu && (
        <UnifiedContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          title={contextMenu.variant.variant_id}
          sections={[
            {
              targets: [
                {
                  label: variantShowLabel[contextMenu.variant.variant_id] ? 'Hide Label' : 'Show Label',
                  onClick: () => {
                    const variantId = contextMenu.variant.variant_id
                    setVariantShowLabel(prev => ({
                      ...prev,
                      [variantId]: !prev[variantId]
                    }))
                    setContextMenu(null)
                  },
                  icon: '🏷️'
                }
              ]
            }
          ]}
          onNavigate={() => {}}
          onClose={() => setContextMenu(null)}
        />
      )}
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
