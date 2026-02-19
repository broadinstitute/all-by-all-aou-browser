import React from 'react';
import type { PeakLabelNode } from '../hooks/usePeakLabelLayout';
import type { BurdenResult } from '../types';

interface PeakTooltipProps {
  node: PeakLabelNode;
  x: number;
  y: number;
  containerWidth: number;
}

// P-value thresholds for coloring
const GREEN_THRESHOLD = 3.5e-7;  // Most significant
const ORANGE_THRESHOLD = 1e-6;   // Significant

/**
 * Get color for p-value based on significance thresholds
 */
const getPvalueColor = (p: number | undefined): 'green' | 'orange' | 'none' => {
  if (p === undefined || p === null) return 'none';
  if (p < GREEN_THRESHOLD) return 'green';
  if (p < ORANGE_THRESHOLD) return 'orange';
  return 'none';
};

/**
 * Format annotation name for display
 */
const formatAnnotation = (ann: string): string => {
  switch (ann) {
    case 'pLoF': return 'pLoF';
    case 'missenseLC': return 'Missense (LC)';
    case 'synonymous': return 'Synonymous';
    default: return ann;
  }
};

/**
 * Format p-value for display
 */
const formatPvalue = (p: number | undefined): string => {
  if (p === undefined || p === null) return '—';
  if (p < 1e-100) return '< 1e-100';
  if (p < 0.001) return p.toExponential(2);
  return p.toPrecision(3);
};

/**
 * P-value cell with color-coded indicator
 */
const PvalueCell: React.FC<{ value: number | undefined }> = ({ value }) => {
  const color = getPvalueColor(value);
  const formatted = formatPvalue(value);

  const dotColor = color === 'green' ? '#4caf50' : color === 'orange' ? '#ff9800' : undefined;
  const textColor = color === 'green' ? '#2e7d32' : color === 'orange' ? '#e65100' : '#666';
  const fontWeight = color !== 'none' ? 600 : 400;

  return (
    <td style={{
      textAlign: 'right',
      color: textColor,
      fontWeight,
      padding: '3px 6px',
      whiteSpace: 'nowrap',
    }}>
      {dotColor && <span style={{ color: dotColor }}>● </span>}
      {formatted}
    </td>
  );
};

/**
 * Tooltip showing all genes in a GWAS locus with burden test results.
 */
export const PeakTooltip: React.FC<PeakTooltipProps> = ({ node, x, y, containerWidth }) => {
  const { peak } = node;

  // Flip tooltip to the left if near right edge
  const shouldFlip = x > containerWidth * 0.5;

  const style: React.CSSProperties = {
    position: 'absolute',
    top: y + 10,
    left: shouldFlip ? undefined : x + 10,
    right: shouldFlip ? containerWidth - x + 10 : undefined,
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    color: '#333',
    padding: '12px',
    borderRadius: '6px',
    fontSize: '11px',
    lineHeight: '1.4',
    pointerEvents: 'none',
    zIndex: 1001,
    minWidth: '400px',
    maxWidth: '600px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.05)',
  };

  const headerStyle: React.CSSProperties = {
    fontWeight: 600,
    fontSize: '12px',
    marginBottom: '10px',
    paddingBottom: '8px',
    borderBottom: '1px solid #e0e0e0',
  };

  const tableStyle: React.CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '10px',
  };

  const thStyle: React.CSSProperties = {
    textAlign: 'right',
    padding: '4px 6px',
    fontWeight: 600,
    color: '#666',
    borderBottom: '1px solid #e0e0e0',
    whiteSpace: 'nowrap',
  };

  const thLeftStyle: React.CSSProperties = {
    ...thStyle,
    textAlign: 'left',
  };

  // Check if any gene has significant burden results
  const hasAnySignificant = peak.genes.some(gene =>
    gene.burden_results?.some(r => getPvalueColor(r.pvalue) !== 'none')
  );

  return (
    <div style={style} className="manhattan-peak-tooltip">
      {/* Header */}
      <div style={headerStyle}>
        <div style={{ color: '#666', fontSize: '10px', marginBottom: '2px' }}>
          {peak.contig}:{peak.position.toLocaleString()}
        </div>
        <div>
          Peak P = <span style={{ color: '#d32f2f', fontWeight: 700 }}>{formatPvalue(peak.pvalue)}</span>
        </div>
      </div>

      {/* Genes table */}
      {peak.genes.slice(0, 8).map((gene, geneIndex) => {
        const hasBurdenData = gene.burden_results && gene.burden_results.length > 0;
        const geneHasSignificant = gene.burden_results?.some(r => getPvalueColor(r.pvalue) !== 'none');

        return (
          <div
            key={gene.gene_id || geneIndex}
            style={{
              marginBottom: geneIndex < Math.min(peak.genes.length, 8) - 1 ? '12px' : 0,
            }}
          >
            {/* Gene header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '6px',
              padding: '4px 0',
              borderBottom: hasBurdenData ? '1px solid #eee' : undefined,
            }}>
              <div style={{
                fontWeight: geneHasSignificant ? 700 : 600,
                color: geneHasSignificant ? '#1565c0' : '#333',
                fontSize: '12px',
              }}>
                {gene.gene_symbol}
              </div>
              <div style={{ color: '#888', fontSize: '10px' }}>
                {gene.distance_kb < 1 ? '<1' : Math.round(gene.distance_kb)}kb away
                {gene.coding_variant_count > 0 && (
                  <span style={{ marginLeft: '8px', color: '#666' }}>
                    {gene.coding_variant_count} coding variant{gene.coding_variant_count > 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>

            {/* Burden results table */}
            {hasBurdenData && (
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thLeftStyle}>Category</th>
                    <th style={thStyle}>SKAT-O</th>
                    <th style={thStyle}>Burden</th>
                    <th style={thStyle}>SKAT</th>
                  </tr>
                </thead>
                <tbody>
                  {gene.burden_results!.map((result) => {
                    const rowColor = getPvalueColor(result.pvalue);
                    const rowBg = rowColor === 'green'
                      ? 'rgba(76, 175, 80, 0.08)'
                      : rowColor === 'orange'
                        ? 'rgba(255, 152, 0, 0.08)'
                        : undefined;

                    return (
                      <tr
                        key={result.annotation}
                        style={{ backgroundColor: rowBg }}
                      >
                        <td style={{
                          padding: '3px 6px',
                          fontWeight: 500,
                          color: '#444',
                        }}>
                          {formatAnnotation(result.annotation)}
                        </td>
                        <PvalueCell value={result.pvalue} />
                        <PvalueCell value={result.pvalue_burden} />
                        <PvalueCell value={result.pvalue_skat} />
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {!hasBurdenData && (
              <div style={{ color: '#999', fontSize: '10px', fontStyle: 'italic' }}>
                No burden test results
              </div>
            )}
          </div>
        );
      })}

      {peak.genes.length > 8 && (
        <div style={{ color: '#888', fontStyle: 'italic', marginTop: '8px', fontSize: '10px' }}>
          +{peak.genes.length - 8} more genes in locus
        </div>
      )}

      {/* Legend */}
      <div style={{
        marginTop: '10px',
        paddingTop: '8px',
        borderTop: '1px solid #e0e0e0',
        fontSize: '9px',
        color: '#888',
        display: 'flex',
        gap: '12px',
      }}>
        <span><span style={{ color: '#4caf50' }}>●</span> P &lt; 3.5e-7</span>
        <span><span style={{ color: '#ff9800' }}>●</span> P &lt; 1e-6</span>
      </div>
    </div>
  );
};
