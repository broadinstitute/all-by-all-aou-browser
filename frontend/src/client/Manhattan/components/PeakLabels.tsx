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
  /** Callback when a peak label is clicked (for navigation) */
  onPeakClick?: (node: PeakLabelNode) => void;
  /** Callback when a peak dot is clicked to toggle its label on/off */
  onPeakToggle?: (peakId: string) => void;
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
  onPeakToggle,
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
      // Check if the mouse actually moved (real drag vs just a click)
      const dx = Math.abs(e.clientX - dragState.startMouseX);
      const dy = Math.abs(e.clientY - dragState.startMouseY);
      const didDrag = dx > 3 || dy > 3;

      if (didDrag && dragPos && onLabelDragEnd) {
        onLabelDragEnd(dragState.id, dragPos.x, dragPos.y);
        // Only suppress the click if an actual drag happened
        justDraggedRef.current = true;
        requestAnimationFrame(() => { justDraggedRef.current = false; });
      }
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
        const isLabeled = node.isLabeled;
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
            onContextMenu={(e) => {
              e.preventDefault();
              onPeakContextMenu?.(node, e.clientX, e.clientY);
            }}
          >
            {/* Peak dot: click toggles label on/off */}
            {/* Invisible wider hit area for easier clicking */}
            <circle
              cx={node.targetX}
              cy={peakY}
              r={12}
              fill="transparent"
              style={{ cursor: 'pointer' }}
              onClick={() => {
                if (isDragging || justDraggedRef.current) return;
                setHoveredPeakId(null);
                onPeakHover?.(null);
                onPeakToggle?.(peakId);
              }}
            />
            {isBurdenOnly ? (
              <polygon
                points={`${node.targetX},${peakY - dotSize} ${node.targetX + dotSize},${peakY} ${node.targetX},${peakY + dotSize} ${node.targetX - dotSize},${peakY}`}
                fill={burdenOnlyColor}
                stroke={isHovered ? '#4a0072' : undefined}
                strokeWidth={isHovered ? 2 : undefined}
                style={{ pointerEvents: 'none' }}
              />
            ) : (
              <circle
                cx={node.targetX}
                cy={peakY}
                r={dotSize}
                className={`manhattan-peak-dot ${isHovered ? 'manhattan-peak-dot-hovered' : ''}`}
                style={{ pointerEvents: 'none' }}
              />
            )}

            {/* Leader line + label text: click navigates to locus/gene */}
            {isLabeled && (
              <>
                <path
                  d={getPathFn(labelX, labelY + 4, node.targetX, peakY)}
                  stroke="transparent"
                  strokeWidth={10}
                  fill="none"
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    if (isDragging || justDraggedRef.current) return;
                    setHoveredPeakId(null);
                    onPeakHover?.(null);
                    onPeakClick?.(node);
                  }}
                />
                <path
                  d={getPathFn(labelX, labelY + 4, node.targetX, peakY)}
                  className={`manhattan-peak-line ${isHovered ? 'manhattan-peak-line-hovered' : ''}`}
                  fill="none"
                  style={isBurdenOnly ? { stroke: burdenOnlyColor, strokeDasharray: '3,2', pointerEvents: 'none' } : hasOverride ? { stroke: '#666', pointerEvents: 'none' } : { pointerEvents: 'none' }}
                />
              </>
            )}
            {isLabeled && (
              <text
                x={labelX}
                y={labelY}
                className={`manhattan-peak-label ${node.hasBurden ? 'manhattan-peak-label-burden' : ''} ${isHovered ? 'manhattan-peak-label-hovered' : ''}`}
                transform={`rotate(${LABEL_ANGLE}, ${labelX}, ${labelY})`}
                textAnchor="start"
                style={{ cursor: onLabelDragEnd ? (isDragging ? 'grabbing' : 'pointer') : 'pointer' }}
                onMouseDown={(e) => handleDragStart(e, peakId, labelX, labelY)}
                onClick={(e) => {
                  e.stopPropagation();
                  if (isDragging || justDraggedRef.current) return;
                  setHoveredPeakId(null);
                  onPeakHover?.(null);
                  onPeakClick?.(node);
                }}
              >
                {isBurdenOnly && (
                  <tspan fill={burdenOnlyColor} fontWeight="bold">◆ </tspan>
                )}
                {node.burdenTypes.includes('pLoF') && (
                  <tspan fill="#d32f2f">●</tspan>
                )}
                {node.burdenTypes.includes('missenseLC') && (
                  <tspan fill="#f9a825">●</tspan>
                )}
                {node.burdenTypes.length > 0 && ' '}
                {node.isNearestOnly && (
                  <tspan fill="var(--theme-text-muted, #888)" fontStyle="italic">nearest: </tspan>
                )}
                <tspan>{node.label}</tspan>
                {node.hasCoding && (
                  <tspan fill={node.lofCount > 0 ? "#c62828" : "#f9a825"} fontWeight="bold"> (C)</tspan>
                )}
                {node.implicatedCount > 1 && (
                  <tspan fill="#666"> +{node.implicatedCount - 1}</tspan>
                )}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
};
