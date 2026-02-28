import React from 'react';
import type { PeakLabelNode } from '../hooks/usePeakLabelLayout';
import type { BurdenResult, GeneInLocus } from '../types';

interface PeakTooltipProps {
  node: PeakLabelNode;
  x: number;
  y: number;
  containerWidth: number;
}

// Burden significance threshold (consistent with the rest of the app)
const SIG_THRESHOLD = 2.5e-6;

/**
 * Get color for p-value based on burden significance
 */
const getPvalueColor = (p: number | undefined): 'red' | 'yellow' | 'none' => {
  if (p === undefined || p === null) return 'none';
  if (p < SIG_THRESHOLD) return 'red';
  return 'none';
};

/**
 * Check if a burden result has any significant p-value
 */
const isBurdenSignificant = (r: BurdenResult): boolean => {
  return (r.pvalue !== undefined && r.pvalue < SIG_THRESHOLD) ||
         (r.pvalue_burden !== undefined && r.pvalue_burden < SIG_THRESHOLD) ||
         (r.pvalue_skat !== undefined && r.pvalue_skat < SIG_THRESHOLD);
};

/**
 * Check if a gene has any evidence (significant burden or coding variants)
 */
const geneHasEvidence = (gene: GeneInLocus): boolean => {
  const hasSigBurden = gene.burden_results?.some(isBurdenSignificant) ?? false;
  const hasCoding = (gene.lof_count || 0) > 0 || (gene.missense_count || 0) > 0;
  return hasSigBurden || hasCoding;
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
 * P-value cell with color-coded indicator (red for pLoF sig, yellow for missense sig)
 */
const PvalueCell: React.FC<{ value: number | undefined; annotation?: string }> = ({ value, annotation }) => {
  const isSignificant = value !== undefined && value < SIG_THRESHOLD;
  const formatted = formatPvalue(value);

  // Color based on annotation type when significant
  const dotColor = isSignificant
    ? (annotation === 'pLoF' ? '#c62828' : annotation === 'missenseLC' ? '#f9a825' : 'var(--theme-text-muted, #666)')
    : undefined;
  const textColor = isSignificant ? 'var(--theme-text, #333)' : 'var(--theme-text-muted, #666)';
  const fontWeight = isSignificant ? 600 : 400;

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
 * Tooltip showing implicated genes in a GWAS locus (those with significant burden or coding variants).
 */
export const PeakTooltip: React.FC<PeakTooltipProps> = ({ node, x, y, containerWidth }) => {
  const { peak } = node;

  // Filter to only show genes with evidence (significant burden or coding variants)
  const implicatedGenes = peak.genes.filter(geneHasEvidence);
  const otherGenesCount = peak.genes.length - implicatedGenes.length;

  // Flip tooltip to the left if near right edge
  const shouldFlip = x > containerWidth * 0.5;

  const style: React.CSSProperties = {
    position: 'absolute',
    top: y + 10,
    left: shouldFlip ? undefined : x + 10,
    right: shouldFlip ? containerWidth - x + 10 : undefined,
    backgroundColor: 'var(--theme-surface, rgba(255, 255, 255, 0.98))',
    color: 'var(--theme-text, #333)',
    padding: '12px',
    borderRadius: '6px',
    fontSize: '11px',
    lineHeight: '1.4',
    pointerEvents: 'none',
    zIndex: 1001,
    minWidth: '380px',
    maxWidth: '550px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.05)',
  };

  const headerStyle: React.CSSProperties = {
    fontWeight: 600,
    fontSize: '12px',
    marginBottom: '10px',
    paddingBottom: '8px',
    borderBottom: '1px solid var(--theme-border, #e0e0e0)',
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
    color: 'var(--theme-text-muted, #666)',
    borderBottom: '1px solid var(--theme-border, #e0e0e0)',
    whiteSpace: 'nowrap',
  };

  const thLeftStyle: React.CSSProperties = {
    ...thStyle,
    textAlign: 'left',
  };

  return (
    <div style={style} className="manhattan-peak-tooltip">
      {/* Header */}
      <div style={headerStyle}>
        <div style={{ color: 'var(--theme-text-muted, #666)', fontSize: '10px', marginBottom: '2px' }}>
          {peak.contig}:{peak.position.toLocaleString()}
        </div>
        <div>
          Peak P = <span style={{ color: '#d32f2f', fontWeight: 700 }}>{formatPvalue(peak.pvalue)}</span>
        </div>
      </div>

      {/* Show message if no implicated genes */}
      {implicatedGenes.length === 0 && (
        <div style={{ color: 'var(--theme-text-muted, #666)', fontStyle: 'italic', fontSize: '11px' }}>
          No genes with significant burden tests or coding variants in this locus.
          <br />
          <span style={{ fontSize: '10px' }}>({peak.genes.length} nearby genes without evidence)</span>
        </div>
      )}

      {/* Implicated genes */}
      {implicatedGenes.slice(0, 6).map((gene, geneIndex) => {
        const lof = gene.lof_count || 0;
        const mis = gene.missense_count || 0;
        const hasCoding = lof > 0 || mis > 0;

        // Only show significant burden results
        const sigBurdenResults = gene.burden_results?.filter(isBurdenSignificant) || [];

        return (
          <div
            key={gene.gene_id || geneIndex}
            style={{
              marginBottom: geneIndex < Math.min(implicatedGenes.length, 6) - 1 ? '12px' : 0,
            }}
          >
            {/* Gene header with coding variant counts */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '6px',
              padding: '4px 0',
              borderBottom: sigBurdenResults.length > 0 ? '1px solid #eee' : undefined,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  fontWeight: 700,
                  color: 'var(--theme-primary, #262262)',
                  fontSize: '12px',
                }}>
                  {gene.gene_symbol}
                </span>
                {/* Coding variant badges */}
                {hasCoding && (
                  <span style={{ display: 'flex', gap: '4px' }}>
                    {lof > 0 && (
                      <span style={{
                        background: '#ffebee',
                        color: '#c62828',
                        padding: '1px 5px',
                        borderRadius: '3px',
                        fontSize: '9px',
                        fontWeight: 600,
                      }}>
                        {lof} LoF
                      </span>
                    )}
                    {mis > 0 && (
                      <span style={{
                        background: '#fff8e1',
                        color: '#f57f17',
                        padding: '1px 5px',
                        borderRadius: '3px',
                        fontSize: '9px',
                        fontWeight: 600,
                      }}>
                        {mis} Mis
                      </span>
                    )}
                  </span>
                )}
              </div>
              <div style={{ color: 'var(--theme-text-muted, #888)', fontSize: '10px' }}>
                {gene.distance_kb < 1 ? '<1' : Math.round(gene.distance_kb)}kb
              </div>
            </div>

            {/* Significant burden results table */}
            {sigBurdenResults.length > 0 && (
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thLeftStyle}>Burden Test</th>
                    <th style={thStyle}>SKAT-O</th>
                    <th style={thStyle}>Burden</th>
                    <th style={thStyle}>SKAT</th>
                  </tr>
                </thead>
                <tbody>
                  {sigBurdenResults.map((result) => {
                    const bgColor = result.annotation === 'pLoF'
                      ? 'rgba(198, 40, 40, 0.06)'
                      : result.annotation === 'missenseLC'
                        ? 'rgba(249, 168, 37, 0.08)'
                        : undefined;

                    return (
                      <tr
                        key={result.annotation}
                        style={{ backgroundColor: bgColor }}
                      >
                        <td style={{
                          padding: '3px 6px',
                          fontWeight: 600,
                          color: result.annotation === 'pLoF' ? '#c62828' : result.annotation === 'missenseLC' ? '#f57f17' : '#444',
                        }}>
                          {formatAnnotation(result.annotation)}
                        </td>
                        <PvalueCell value={result.pvalue} annotation={result.annotation} />
                        <PvalueCell value={result.pvalue_burden} annotation={result.annotation} />
                        <PvalueCell value={result.pvalue_skat} annotation={result.annotation} />
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        );
      })}

      {/* Additional counts */}
      {(implicatedGenes.length > 6 || otherGenesCount > 0) && (
        <div style={{ color: 'var(--theme-text-muted, #888)', fontStyle: 'italic', marginTop: '8px', fontSize: '10px' }}>
          {implicatedGenes.length > 6 && (
            <span>+{implicatedGenes.length - 6} more implicated genes</span>
          )}
          {implicatedGenes.length > 6 && otherGenesCount > 0 && ' • '}
          {otherGenesCount > 0 && (
            <span>{otherGenesCount} other gene{otherGenesCount > 1 ? 's' : ''} nearby</span>
          )}
        </div>
      )}

      {/* Legend */}
      <div style={{
        marginTop: '10px',
        paddingTop: '8px',
        borderTop: '1px solid var(--theme-border, #e0e0e0)',
        fontSize: '9px',
        color: 'var(--theme-text-muted, #888)',
        display: 'flex',
        gap: '12px',
      }}>
        <span><span style={{ color: '#c62828' }}>●</span> pLoF burden P &lt; 2.5e-6</span>
        <span><span style={{ color: '#f9a825' }}>●</span> Missense burden P &lt; 2.5e-6</span>
      </div>
    </div>
  );
};
