import React, { useState, useCallback } from 'react';
import type { PeakLabelNode } from '../hooks/usePeakLabelLayout';

const LABEL_ANGLE = -45; // Degrees

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
}

/**
 * Renders gene labels for significant GWAS peaks.
 * Expects pre-computed positions from usePeakLabelLayout hook.
 */
export const PeakLabels: React.FC<PeakLabelsProps> = ({
  nodes,
  plotHeight,
  labelAreaHeight,
  onPeakClick,
  hoveredHitPosition,
  onPeakHover,
}) => {
  const [hoveredPeakId, setHoveredPeakId] = useState<string | null>(null);

  const handleMouseEnter = useCallback((e: React.MouseEvent, id: string, node: PeakLabelNode) => {
    setHoveredPeakId(id);
    const rect = (e.currentTarget as SVGElement).ownerSVGElement?.getBoundingClientRect();
    if (rect) {
      onPeakHover?.(node, e.clientX - rect.left, e.clientY - rect.top);
    } else {
      onPeakHover?.(node);
    }
  }, [onPeakHover]);

  const handleMouseLeave = useCallback(() => {
    setHoveredPeakId(null);
    onPeakHover?.(null);
  }, [onPeakHover]);

  const handleMouseMove = useCallback((e: React.MouseEvent, node: PeakLabelNode) => {
    const rect = (e.currentTarget as SVGElement).ownerSVGElement?.getBoundingClientRect();
    if (rect) {
      onPeakHover?.(node, e.clientX - rect.left, e.clientY - rect.top);
    }
  }, [onPeakHover]);

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
    <g className="manhattan-peak-labels">
      {nodes.map((node) => {
        // Peak dot position: in the plot area (below label area)
        // Add small offset to avoid drawing at the very edge
        const peakY = labelAreaHeight + Math.max(0.02, node.targetY) * plotHeight;
        const peakId = `${node.peak.contig}-${node.peak.position}`;
        const isHovered = hoveredPeakId === peakId || hoveredFromHit === peakId;

        return (
          <g
            key={peakId}
            className={`manhattan-peak-group ${isHovered ? 'manhattan-peak-group-hovered' : ''}`}
            onMouseEnter={(e) => handleMouseEnter(e, peakId, node)}
            onMouseMove={(e) => handleMouseMove(e, node)}
            onMouseLeave={handleMouseLeave}
            onClick={() => onPeakClick?.(node)}
            style={{ cursor: 'pointer' }}
          >
            {/* Invisible wider hit area for easier hovering */}
            <line
              x1={node.x}
              y1={node.y + 4}
              x2={node.targetX}
              y2={peakY}
              stroke="transparent"
              strokeWidth={10}
            />
            {/* Leader line from label down to peak */}
            <line
              x1={node.x}
              y1={node.y + 4}
              x2={node.targetX}
              y2={peakY}
              className={`manhattan-peak-line ${isHovered ? 'manhattan-peak-line-hovered' : ''}`}
            />
            {/* Dot at the peak position */}
            <circle
              cx={node.targetX}
              cy={peakY}
              r={isHovered ? 5 : 3}
              className={`manhattan-peak-dot ${isHovered ? 'manhattan-peak-dot-hovered' : ''}`}
            />
            {/* Gene label - angled */}
            <text
              x={node.x}
              y={node.y}
              className={`manhattan-peak-label ${node.hasBurden ? 'manhattan-peak-label-burden' : ''} ${isHovered ? 'manhattan-peak-label-hovered' : ''}`}
              transform={`rotate(${LABEL_ANGLE}, ${node.x}, ${node.y})`}
              textAnchor="start"
            >
              {node.hasBurden && '* '}
              {node.label}
              {node.codingCount > 0 && ` (${node.codingCount})`}
            </text>
          </g>
        );
      })}
    </g>
  );
};
