import React from 'react';
import type { PeakLabelNode } from '../hooks/usePeakLabelLayout';
import type { BurdenResult } from '../types';

interface PeakTooltipProps {
  node: PeakLabelNode;
  x: number;
  y: number;
  containerWidth: number;
}

const SIGNIFICANCE_THRESHOLD = 2.5e-6;

/**
 * Tooltip showing all genes in a GWAS locus with evidence summary.
 */
export const PeakTooltip: React.FC<PeakTooltipProps> = ({ node, x, y, containerWidth }) => {
  const { peak } = node;

  // Flip tooltip to the left if near right edge
  const shouldFlip = x > containerWidth * 0.6;

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
    minWidth: '320px',
    maxWidth: '480px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.05)',
  };

  const formatPvalue = (p: number | undefined): string => {
    if (p === undefined || p === null) return '—';
    if (p < 1e-100) return '< 1e-100';
    if (p < 0.001) return p.toExponential(1);
    return p.toPrecision(2);
  };

  const isSignificant = (p: number | undefined): boolean => {
    return p !== undefined && p !== null && p < SIGNIFICANCE_THRESHOLD;
  };

  const hasAnySignificantBurden = (results: BurdenResult[] | undefined): boolean => {
    return results?.some((r) => isSignificant(r.pvalue)) ?? false;
  };

  // Format annotation name for display
  const formatAnnotation = (ann: string): string => {
    switch (ann) {
      case 'pLoF': return 'pLoF';
      case 'missenseLC': return 'Missense';
      case 'synonymous': return 'Syn';
      default: return ann;
    }
  };

  return (
    <div style={style} className="manhattan-peak-tooltip">
      {/* Header */}
      <div style={{
        fontWeight: 600,
        fontSize: '12px',
        marginBottom: '10px',
        paddingBottom: '8px',
        borderBottom: '1px solid #e0e0e0'
      }}>
        <div style={{ color: '#666', fontSize: '10px', marginBottom: '2px' }}>
          {peak.contig}:{peak.position.toLocaleString()}
        </div>
        <div>
          Peak P = <span style={{ color: '#d32f2f', fontWeight: 700 }}>{formatPvalue(peak.pvalue)}</span>
        </div>
      </div>

      {/* Genes */}
      {peak.genes.slice(0, 6).map((gene, i) => {
        const hasSignificant = hasAnySignificantBurden(gene.burden_results);
        const hasCoding = gene.coding_variant_count > 0;
        const hasBurdenData = gene.burden_results && gene.burden_results.length > 0;

        return (
          <div
            key={gene.gene_id || i}
            style={{
              marginBottom: i < peak.genes.length - 1 ? '10px' : 0,
              paddingBottom: i < peak.genes.length - 1 ? '10px' : 0,
              borderBottom: i < peak.genes.length - 1 ? '1px solid #f0f0f0' : undefined,
            }}
          >
            {/* Gene header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: hasBurdenData ? '6px' : 0,
            }}>
              <div style={{
                fontWeight: hasSignificant ? 700 : hasCoding ? 600 : 400,
                color: hasSignificant ? '#1565c0' : '#333',
                fontSize: '12px',
              }}>
                {hasSignificant && <span style={{ color: '#4caf50' }}>● </span>}
                {gene.gene_symbol}
              </div>
              <div style={{ color: '#888', fontSize: '10px' }}>
                {gene.distance_kb < 1 ? '<1' : Math.round(gene.distance_kb)}kb
                {hasCoding && <span style={{ marginLeft: '8px', color: '#666' }}>{gene.coding_variant_count} coding</span>}
              </div>
            </div>

            {/* Burden results table */}
            {hasBurdenData && (
              <div style={{
                backgroundColor: '#fafafa',
                borderRadius: '4px',
                padding: '6px 8px',
                fontSize: '10px',
              }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '55px 1fr 1fr 1fr',
                  gap: '2px 6px',
                  color: '#888',
                  fontWeight: 500,
                  marginBottom: '4px',
                }}>
                  <div></div>
                  <div style={{ textAlign: 'right' }}>SKAT-O</div>
                  <div style={{ textAlign: 'right' }}>Burden</div>
                  <div style={{ textAlign: 'right' }}>SKAT</div>
                </div>
                {gene.burden_results!.map((result) => {
                  const rowSignificant = isSignificant(result.pvalue);
                  return (
                    <div
                      key={result.annotation}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '55px 1fr 1fr 1fr',
                        gap: '2px 6px',
                        padding: '2px 0',
                        backgroundColor: rowSignificant ? 'rgba(76, 175, 80, 0.1)' : undefined,
                        borderRadius: '2px',
                      }}
                    >
                      <div style={{ fontWeight: 500, color: '#666' }}>
                        {formatAnnotation(result.annotation)}
                      </div>
                      <PvalueCell value={result.pvalue} />
                      <PvalueCell value={result.pvalue_burden} />
                      <PvalueCell value={result.pvalue_skat} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {peak.genes.length > 6 && (
        <div style={{ color: '#888', fontStyle: 'italic', marginTop: '8px', fontSize: '10px' }}>
          +{peak.genes.length - 6} more genes in locus
        </div>
      )}

      {/* Legend */}
      <div style={{
        marginTop: '10px',
        paddingTop: '8px',
        borderTop: '1px solid #e0e0e0',
        fontSize: '9px',
        color: '#888',
      }}>
        <span style={{ color: '#4caf50' }}>●</span> Significant (P &lt; 2.5e-6)
      </div>
    </div>
  );
};

/**
 * P-value cell with significance highlighting
 */
const PvalueCell: React.FC<{ value: number | undefined }> = ({ value }) => {
  if (value === undefined || value === null) {
    return <div style={{ textAlign: 'right', color: '#ccc' }}>—</div>;
  }

  const significant = value < SIGNIFICANCE_THRESHOLD;
  const formatted = value < 0.001 ? value.toExponential(1) : value.toPrecision(2);

  return (
    <div style={{
      textAlign: 'right',
      color: significant ? '#2e7d32' : '#666',
      fontWeight: significant ? 600 : 400,
    }}>
      {significant && <span style={{ color: '#4caf50' }}>● </span>}
      {formatted}
    </div>
  );
};
