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

const LOF_CSQS = ['stop_gained', 'frameshift_variant', 'splice_acceptor_variant', 'splice_donor_variant', 'start_lost', 'stop_lost'];

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
const formatPvalue = (p: number | undefined, negLog10P?: number): string => {
  if (p === undefined || p === null) return '—';
  if (negLog10P !== undefined && negLog10P > 100) {
    return `1e-${Math.round(negLog10P)}`;
  }
  if (p < 1e-100) return '< 1e-100';
  if (p < 0.001) return p.toExponential(2);
  return p.toPrecision(3);
};

/**
 * P-value cell with color-coded indicator
 */
const PvalueCell: React.FC<{ value: number | undefined; negLog10P?: number; annotation?: string }> = ({ value, negLog10P, annotation }) => {
  const isSignificant = value !== undefined && value < SIG_THRESHOLD;
  const formatted = formatPvalue(value, negLog10P);

  const dotColor = isSignificant
    ? (annotation === 'pLoF' ? '#c62828' : annotation === 'missenseLC' ? '#e68a00' : 'var(--theme-text-muted, #666)')
    : undefined;
  const textColor = isSignificant ? 'var(--theme-text, #333)' : 'var(--theme-text-muted, #aaa)';
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
 * Format consequence for display
 */
const formatConsequence = (csq: string): string => {
  switch (csq) {
    case 'stop_gained': return 'Stop gained';
    case 'frameshift_variant': return 'Frameshift';
    case 'splice_acceptor_variant': return 'Splice acceptor';
    case 'splice_donor_variant': return 'Splice donor';
    case 'start_lost': return 'Start lost';
    case 'stop_lost': return 'Stop lost';
    case 'missense_variant': return 'Missense';
    case 'synonymous_variant': return 'Synonymous';
    default: return csq;
  }
};

/**
 * Coding variant badge component
 */
const CodingBadge: React.FC<{ gene: GeneInLocus }> = ({ gene }) => {
  if (!gene.best_coding_hgvsp && !gene.best_coding_hgvsc) {
    // Fallback to counts
    const lof = gene.lof_count || 0;
    const mis = gene.missense_count || 0;
    if (lof === 0 && mis === 0) return null;
    return (
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {lof > 0 && (
          <span style={{ background: '#fbe9e7', color: '#c62828', padding: '1px 6px', borderRadius: 3, fontSize: 10, fontWeight: 600 }}>
            {lof} LoF
          </span>
        )}
        {mis > 0 && (
          <span style={{ background: '#fff8e1', color: '#e68a00', padding: '1px 6px', borderRadius: 3, fontSize: 10, fontWeight: 600 }}>
            {mis} Missense
          </span>
        )}
      </div>
    );
  }

  const isLof = LOF_CSQS.includes(gene.best_coding_csq ?? '');
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      background: isLof ? '#fbe9e7' : '#fff8e1',
      color: isLof ? '#c62828' : '#b8860b',
      padding: '3px 8px',
      borderRadius: 4,
      fontSize: 10,
      fontWeight: 600,
    }}>
      <span>{gene.best_coding_hgvsp || gene.best_coding_hgvsc}</span>
      {gene.best_coding_csq && (
        <span style={{ fontWeight: 400, opacity: 0.8 }}>{formatConsequence(gene.best_coding_csq)}</span>
      )}
      {gene.best_coding_pvalue !== undefined && (
        <span style={{ fontWeight: 400, opacity: 0.8 }}>
          P={gene.best_coding_pvalue < 0.001 ? gene.best_coding_pvalue.toExponential(2) : gene.best_coding_pvalue.toPrecision(3)}
        </span>
      )}
      {gene.best_coding_beta !== undefined && (
        <span style={{ color: gene.best_coding_beta > 0 ? '#2e7d32' : '#c62828', fontWeight: 700 }}>{gene.best_coding_beta > 0 ? '↑' : '↓'}</span>
      )}
      {gene.best_coding_ac !== undefined && gene.best_coding_ac > 0 && (
        <span style={{ fontWeight: 400, opacity: 0.8 }}>AC: {gene.best_coding_ac}</span>
      )}
      {(() => {
        const total = (gene.lof_count || 0) + (gene.missense_count || 0);
        return total > 1 ? <span style={{ fontWeight: 400, opacity: 0.7 }}>+{total - 1} more</span> : null;
      })()}
    </div>
  );
};

/**
 * Tooltip showing implicated genes in a GWAS locus.
 * Priority: burden analysis > coding variants > peak P & nearest gene.
 */
export const PeakTooltip: React.FC<PeakTooltipProps> = ({ node, x, y, containerWidth }) => {
  const { peak } = node;

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
    padding: '12px 14px',
    borderRadius: '6px',
    fontSize: '11px',
    lineHeight: '1.4',
    pointerEvents: 'none',
    zIndex: 1001,
    minWidth: '360px',
    maxWidth: '550px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.05)',
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
      {/* No evidence */}
      {implicatedGenes.length === 0 && (
        <>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--theme-primary, #262262)', marginBottom: 4 }}>
            {peak.genes[0]?.gene_symbol ?? 'Unknown'}
            <span style={{ fontWeight: 400, color: 'var(--theme-text-muted, #888)', fontSize: 10, marginLeft: 8 }}>
              Nearest gene
            </span>
          </div>
          <div style={{ color: 'var(--theme-text-muted, #666)', fontStyle: 'italic', fontSize: 10, marginBottom: 8 }}>
            No significant burden tests or coding variants in this locus.
          </div>
        </>
      )}

      {/* Section 1: Gene Burden */}
      {(() => {
        const burdenGenes = implicatedGenes.filter(g => g.burden_results?.some(isBurdenSignificant));
        if (burdenGenes.length === 0) return null;
        return (
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--theme-text-muted, #888)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
              Gene Burden
            </div>
            {burdenGenes.slice(0, 4).map((gene, i) => {
              const sigBurdenResults = gene.burden_results!.filter(isBurdenSignificant);
              return (
                <div key={gene.gene_id || i} style={{ marginBottom: i < Math.min(burdenGenes.length, 4) - 1 ? 8 : 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, color: 'var(--theme-primary, #262262)', fontSize: 12 }}>
                      {gene.gene_symbol}
                    </span>
                    <span style={{ color: 'var(--theme-text-muted, #888)', fontSize: 10 }}>
                      {gene.distance_kb < 1 ? '<1' : Math.round(gene.distance_kb)}kb
                    </span>
                  </div>
                  <table style={tableStyle}>
                    <thead>
                      <tr>
                        <th style={thLeftStyle}>Annotation</th>
                        <th style={thStyle}>SKAT-O</th>
                        <th style={thStyle}>Burden</th>
                        <th style={thStyle}>SKAT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sigBurdenResults.map((result) => (
                        <tr
                          key={result.annotation}
                          style={{ backgroundColor: result.annotation === 'pLoF' ? 'rgba(198,40,40,0.06)' : result.annotation === 'missenseLC' ? 'rgba(249,168,37,0.08)' : undefined }}
                        >
                          <td style={{ padding: '3px 6px', fontWeight: 600, color: result.annotation === 'pLoF' ? '#c62828' : result.annotation === 'missenseLC' ? '#e68a00' : '#444' }}>
                            {formatAnnotation(result.annotation)}
                          </td>
                          <PvalueCell value={result.pvalue} negLog10P={result.pvalue_neg_log10} annotation={result.annotation} />
                          <PvalueCell value={result.pvalue_burden} negLog10P={result.pvalue_burden_neg_log10} annotation={result.annotation} />
                          <PvalueCell value={result.pvalue_skat} negLog10P={result.pvalue_skat_neg_log10} annotation={result.annotation} />
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
            {burdenGenes.length > 4 && (
              <div style={{ fontSize: 10, color: 'var(--theme-text-muted, #888)', fontStyle: 'italic', marginTop: 4 }}>
                +{burdenGenes.length - 4} more genes with burden
              </div>
            )}
          </div>
        );
      })()}

      {/* Section 2: Coding Variants */}
      {(() => {
        const codingGenes = implicatedGenes.filter(g => (g.lof_count || 0) > 0 || (g.missense_count || 0) > 0);
        if (codingGenes.length === 0) return null;
        const hasBurdenSection = implicatedGenes.some(g => g.burden_results?.some(isBurdenSignificant));
        return (
          <div style={{ marginTop: hasBurdenSection ? 4 : 0 }}>
            {hasBurdenSection && <div style={{ borderTop: '1px solid var(--theme-border, #e0e0e0)', marginBottom: 8 }} />}
            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--theme-text-muted, #888)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
              Coding Variants
            </div>
            {codingGenes.slice(0, 4).map((gene, i) => (
              <div key={gene.gene_id || i} style={{ marginBottom: i < Math.min(codingGenes.length, 4) - 1 ? 4 : 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontWeight: 700, color: 'var(--theme-primary, #262262)', fontSize: 11 }}>
                    {gene.gene_symbol}
                  </span>
                  <CodingBadge gene={gene} />
                </div>
              </div>
            ))}
            {codingGenes.length > 4 && (
              <div style={{ fontSize: 10, color: 'var(--theme-text-muted, #888)', fontStyle: 'italic', marginTop: 4 }}>
                +{codingGenes.length - 4} more genes with coding variants
              </div>
            )}
          </div>
        );
      })()}

      {/* 3. Locus info footer — peak P & position, other genes */}
      <div style={{
        marginTop: 10,
        paddingTop: 8,
        borderTop: '1px solid var(--theme-border, #e0e0e0)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        fontSize: 10,
        color: 'var(--theme-text-muted, #666)',
      }}>
        <span>
          {node.isBurdenOnly ? 'Burden' : 'Lead variant'} P = <span style={{ color: '#d32f2f', fontWeight: 700 }}>{formatPvalue(peak.pvalue, peak.neg_log10_p)}</span>
        </span>
        <span>{peak.contig}:{peak.position.toLocaleString()}</span>
      </div>
      {otherGenesCount > 0 && (
        <div style={{ fontSize: 10, color: 'var(--theme-text-muted, #aaa)', marginTop: 2 }}>
          {peak.genes
            .filter((g) => !geneHasEvidence(g))
            .map((g) => g.gene_symbol)
            .join(', ')}
        </div>
      )}
    </div>
  );
};
