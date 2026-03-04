import React from 'react';
import type { DisplayHit } from '../types';

interface TooltipProps {
  hit: DisplayHit;
  x: number;
  y: number;
  containerWidth: number;
}

/**
 * Tooltip component for displaying hit information on hover.
 * Supports both variant and gene hits.
 * Automatically positions itself to avoid overflowing the viewport edge.
 */
export const Tooltip: React.FC<TooltipProps> = ({ hit, x, y, containerWidth }) => {
  // Flip tooltip to the left if cursor is near right edge
  const flipThreshold = 0.8;
  const shouldFlip = x > containerWidth * flipThreshold;

  const style: React.CSSProperties = {
    position: 'absolute',
    top: y - 10,
    left: shouldFlip ? undefined : x + 15,
    right: shouldFlip ? containerWidth - x + 15 : undefined,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    color: '#fff',
    padding: '8px 12px',
    borderRadius: '4px',
    fontSize: '13px',
    lineHeight: '1.4',
    pointerEvents: 'none',
    zIndex: 1000,
    maxWidth: '300px',
    whiteSpace: 'nowrap',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
  };

  const formatPvalue = (p: number, negLog10P?: number): string => {
    // Use neg_log10_p for precise display of extremely small p-values
    if (negLog10P !== undefined && negLog10P > 100) {
      // For very small p-values, show as 1e-X using the precise neg_log10_p
      return `1e-${Math.round(negLog10P)}`;
    }
    if (p < 1e-100) {
      return '< 1e-100';
    }
    return p.toExponential(2);
  };

  const isGene = hit.hit_type === 'gene';

  return (
    <div style={style} className="manhattan-tooltip">
      <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
        {isGene ? (
          <>Gene: {hit.label}</>
        ) : (
          hit.label
        )}
      </div>
      <div style={{ color: '#aaa' }}>
        P = <span style={{ color: '#ff6b6b' }}>{formatPvalue(hit.pvalue, hit.neg_log10_p)}</span>
      </div>
      {isGene && hit.id && (
        <div style={{ color: '#888', fontSize: '11px' }}>
          {hit.id}
        </div>
      )}
      <div style={{ color: '#888', fontSize: '11px', marginTop: '4px' }}>
        {hit.contig}:{hit.position.toLocaleString()}
      </div>
    </div>
  );
};
