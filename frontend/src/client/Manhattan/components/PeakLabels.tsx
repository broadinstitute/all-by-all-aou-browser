import React, { useState, useCallback, useEffect, useRef } from 'react';
import type { PeakLabelNode } from '../hooks/usePeakLabelLayout';

const LABEL_ANGLE = -45; // Degrees

export interface LabelPositionOverride {
  x: number;
  y: number;
}

export interface PeakLabelsProps {
  /** Pre-computed label nodes with positions */
  nodes: PeakLabelNode[];
  /** Height of the plot area (not including label area) */
  plotHeight: number;
  /** Height of the label area above the plot */
  labelAreaHeight: number;
  /** Callback when a peak is clicked */
  onPeakClick?: (node: PeakLabelNode) => void;
  /** Currently hovered hit from the main overlay (contig-position format) */
  hoveredHitPosition?: { contig: string; position: number } | null;
  /** Callback when hovering a peak label - includes cursor position for tooltip */
  onPeakHover?: (node: PeakLabelNode | null, cursorX?: number, cursorY?: number) => void;
  /** Callback when a peak label is right-clicked */
  onPeakContextMenu?: (node: PeakLabelNode, clientX: number, clientY: number) => void;
  /** User-dragged label position overrides */
  labelOverrides?: Record<string, LabelPositionOverride>;
  /** Callback when a label is dragged to a new position */
  onLabelDragEnd?: (id: string, x: number, y: number) => void;
  /** Use dog-leg/crankshaft stems instead of straight lines */
  useDogLegStems?: boolean;
}

/**
 * Generate a straight line path from label to peak.
 */
function getStraightPath(labelX: number, labelY: number, peakX: number, peakY: number): string {
  return `M ${labelX} ${labelY} L ${peakX} ${peakY}`;
}

/**
 * Generate a dog-leg/crankshaft path from label to peak.
 * The path goes: label → knee (horizontal) → peak (vertical)
 */
function getDogLegPath(labelX: number, labelY: number, peakX: number, peakY: number): string {
  // Knee point: drop down from label partway, then go horizontal to peak X
  const kneeY = labelY + (peakY - labelY) * 0.4; // 40% of the way down
  return `M ${labelX} ${labelY} L ${labelX} ${kneeY} L ${peakX} ${kneeY} L ${peakX} ${peakY}`;
}

/**
 * Renders gene labels for significant GWAS peaks.
 * Expects pre-computed positions from usePeakLabelLayout hook.
 * Supports draggable labels and dog-leg connector stems.
 */
export const PeakLabels: React.FC<PeakLabelsProps> = ({
  nodes,
  plotHeight,
  labelAreaHeight,
  onPeakClick,
  hoveredHitPosition,
  onPeakHover,
  onPeakContextMenu,
  labelOverrides = {},
  onLabelDragEnd,
  useDogLegStems = false,
}) => {
  // Choose path function based on stem style
  const getPathFn = useDogLegStems ? getDogLegPath : getStraightPath;
  const [hoveredPeakId, setHoveredPeakId] = useState<string | null>(null);
  // Drag state: track which node is being dragged and current position
  const [dragState, setDragState] = useState<{
    id: string;
    startMouseX: number;
    startMouseY: number;
    initialX: number;
    initialY: number;
  } | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const justDraggedRef = useRef(false);
  const svgRef = useRef<SVGGElement>(null);

  // Handle mouse move during drag (attached to window)
  useEffect(() => {
    if (!dragState) return;

    const handleMouseMove = (e: MouseEvent) => {
      const svg = svgRef.current?.ownerSVGElement;
      if (!svg) return;

      const rect = svg.getBoundingClientRect();
      const dx = e.clientX - dragState.startMouseX;
      const dy = e.clientY - dragState.startMouseY;
      setDragPos({
        x: dragState.initialX + dx,
        y: dragState.initialY + dy,
      });
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (dragPos && onLabelDragEnd) {
        onLabelDragEnd(dragState.id, dragPos.x, dragPos.y);
      }
      // Flag that a drag just ended so the click handler can suppress
      justDraggedRef.current = true;
      requestAnimationFrame(() => { justDraggedRef.current = false; });
      setDragState(null);
      setDragPos(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, dragPos, onLabelDragEnd]);

  const handleMouseEnter = useCallback((e: React.MouseEvent, id: string, node: PeakLabelNode) => {
    if (dragState) return; // Don't update hover during drag
    setHoveredPeakId(id);
    const rect = (e.currentTarget as SVGElement).ownerSVGElement?.getBoundingClientRect();
    if (rect) {
      onPeakHover?.(node, e.clientX - rect.left, e.clientY - rect.top);
    } else {
      onPeakHover?.(node);
    }
  }, [onPeakHover, dragState]);

  const handleMouseLeave = useCallback(() => {
    if (dragState) return; // Don't update hover during drag
    setHoveredPeakId(null);
    onPeakHover?.(null);
  }, [onPeakHover, dragState]);

  const handleMouseMoveLabel = useCallback((e: React.MouseEvent, node: PeakLabelNode) => {
    if (dragState) return; // Don't update hover during drag
    const rect = (e.currentTarget as SVGElement).ownerSVGElement?.getBoundingClientRect();
    if (rect) {
      onPeakHover?.(node, e.clientX - rect.left, e.clientY - rect.top);
    }
  }, [onPeakHover, dragState]);

  const handleDragStart = useCallback((e: React.MouseEvent, peakId: string, currentX: number, currentY: number) => {
    if (!onLabelDragEnd) return; // Dragging not enabled
    e.stopPropagation();
    e.preventDefault();
    setDragState({
      id: peakId,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      initialX: currentX,
      initialY: currentY,
    });
    setDragPos({ x: currentX, y: currentY });
  }, [onLabelDragEnd]);

  if (nodes.length === 0) {
    return null;
  }

  // Check if any peak matches the hovered hit from the main overlay
  const getHoveredFromHit = (): string | null => {
    if (!hoveredHitPosition) return null;
    for (const node of nodes) {
      // Check if this peak contains the hovered position (within 1Mb bin)
      if (node.peak.contig === hoveredHitPosition.contig) {
        const peakBin = Math.floor(node.peak.position / 1000000);
        const hitBin = Math.floor(hoveredHitPosition.position / 1000000);
        if (peakBin === hitBin) {
          return `${node.peak.contig}-${node.peak.position}`;
        }
      }
    }
    return null;
  };

  const hoveredFromHit = getHoveredFromHit();

  return (
    <g ref={svgRef} className="manhattan-peak-labels" style={{ pointerEvents: 'all' }}>
      {nodes.map((node) => {
        // Peak dot position: in the plot area (below label area)
        // Add small offset to avoid drawing at the very edge
        const peakY = labelAreaHeight + Math.max(0.02, node.targetY) * plotHeight;
        const peakId = `${node.peak.contig}-${node.peak.position}`;
        const isHovered = hoveredPeakId === peakId || hoveredFromHit === peakId;
        const isDragging = dragState?.id === peakId;

        // Burden-only peaks get special styling
        const isBurdenOnly = node.isBurdenOnly;
        const dotSize = isBurdenOnly ? (isHovered ? 7 : 5) : (isHovered ? 5 : 3);
        const burdenOnlyColor = '#7b1fa2'; // Purple for burden-only

        // Get label position: dragging > override > computed
        let labelX = node.x;
        let labelY = node.y;
        if (isDragging && dragPos) {
          labelX = dragPos.x;
          labelY = dragPos.y;
        } else if (labelOverrides[peakId]) {
          labelX = labelOverrides[peakId].x;
          labelY = labelOverrides[peakId].y;
        }

        // Whether this label has been manually positioned
        const hasOverride = !!labelOverrides[peakId] || isDragging;

        return (
          <g
            key={peakId}
            className={`manhattan-peak-group ${isHovered ? 'manhattan-peak-group-hovered' : ''} ${isDragging ? 'manhattan-peak-group-dragging' : ''}`}
            onMouseEnter={(e) => handleMouseEnter(e, peakId, node)}
            onMouseMove={(e) => handleMouseMoveLabel(e, node)}
            onMouseLeave={handleMouseLeave}
            onClick={() => !isDragging && !justDraggedRef.current && onPeakClick?.(node)}
            onContextMenu={(e) => {
              e.preventDefault();
              onPeakContextMenu?.(node, e.clientX, e.clientY);
            }}
            style={{ cursor: onLabelDragEnd ? (isDragging ? 'grabbing' : 'pointer') : 'pointer' }}
          >
            {/* Invisible wider hit area for easier hovering */}
            <path
              d={getPathFn(labelX, labelY + 4, node.targetX, peakY)}
              stroke="transparent"
              strokeWidth={10}
              fill="none"
            />
            {/* Leader line from label down to peak */}
            <path
              d={getPathFn(labelX, labelY + 4, node.targetX, peakY)}
              className={`manhattan-peak-line ${isHovered ? 'manhattan-peak-line-hovered' : ''}`}
              fill="none"
              style={isBurdenOnly ? { stroke: burdenOnlyColor, strokeDasharray: '3,2' } : hasOverride ? { stroke: '#666' } : undefined}
            />
            {/* Dot/shape at the peak position */}
            {isBurdenOnly ? (
              // Diamond shape for burden-only peaks
              <polygon
                points={`${node.targetX},${peakY - dotSize} ${node.targetX + dotSize},${peakY} ${node.targetX},${peakY + dotSize} ${node.targetX - dotSize},${peakY}`}
                fill={burdenOnlyColor}
                stroke={isHovered ? '#4a0072' : undefined}
                strokeWidth={isHovered ? 2 : undefined}
              />
            ) : (
              // Circle for regular GWAS peaks
              <circle
                cx={node.targetX}
                cy={peakY}
                r={dotSize}
                className={`manhattan-peak-dot ${isHovered ? 'manhattan-peak-dot-hovered' : ''}`}
              />
            )}
            {/* Gene label - angled with burden dots, coding indicator, multi-gene count */}
            <text
              x={labelX}
              y={labelY}
              className={`manhattan-peak-label ${node.hasBurden ? 'manhattan-peak-label-burden' : ''} ${isHovered ? 'manhattan-peak-label-hovered' : ''}`}
              transform={`rotate(${LABEL_ANGLE}, ${labelX}, ${labelY})`}
              textAnchor="start"
              onMouseDown={(e) => handleDragStart(e, peakId, labelX, labelY)}
            >
              {/* Burden-only indicator */}
              {isBurdenOnly && (
                <tspan fill={burdenOnlyColor} fontWeight="bold">◆ </tspan>
              )}
              {/* Burden type dots - pLoF in red, missense in yellow */}
              {node.burdenTypes.includes('pLoF') && (
                <tspan fill="#d32f2f">●</tspan>
              )}
              {node.burdenTypes.includes('missenseLC') && (
                <tspan fill="#f9a825">●</tspan>
              )}
              {node.burdenTypes.length > 0 && ' '}
              {/* Gene symbol */}
              {node.isNearestOnly && (
                <tspan fill="var(--theme-text-muted, #888)" fontStyle="italic">nearest: </tspan>
              )}
              <tspan>{node.label}</tspan>
              {/* Coding indicator: red if pLoF exists, else yellow/orange for missense */}
              {node.hasCoding && (
                <tspan fill={node.lofCount > 0 ? "#c62828" : "#f9a825"} fontWeight="bold"> (C)</tspan>
              )}
              {/* Multi-gene indicator */}
              {node.implicatedCount > 1 && (
                <tspan fill="#666"> +{node.implicatedCount - 1}</tspan>
              )}
            </text>
          </g>
        );
      })}
    </g>
  );
};
