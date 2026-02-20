import React, { useState, useCallback, useMemo } from 'react';
import type { UnifiedLocus, UnifiedGene, BurdenResult } from './types';
import './ManhattanViewer.css';

const SIG_THRESHOLD = 2.5e-6;

export interface UnifiedLocusTableProps {
  /** Unified loci from the overview API */
  unifiedLoci: UnifiedLocus[];
  /** Callback when a locus is clicked (for zoom navigation) */
  onLocusClick?: (contig: string, position: number) => void;
  /** Set of selected peak IDs for custom labeling */
  selectedPeakIds: Set<string>;
  /** Callback to toggle a peak selection */
  onTogglePeak: (peakId: string) => void;
  /** Whether in custom label mode */
  customLabelMode: boolean;
  /** Clear all selections */
  onClearSelection: () => void;
  /** Reset to default (top 25) mode */
  onResetToDefault: () => void;
  /** Select all filtered loci */
  onSelectAllFiltered: (ids: Set<string>) => void;
}

/**
 * Get annotation color scheme
 */
function getAnnotationColor(ann: string) {
  if (ann === 'pLoF') return { dot: '#d32f2f', bg: 'rgba(211,47,47,0.12)', text: '#b71c1c' };
  if (ann === 'missenseLC') return { dot: '#f9a825', bg: 'rgba(249,168,37,0.15)', text: '#f57f17' };
  if (ann === 'synonymous') return { dot: '#388e3c', bg: 'rgba(56,142,60,0.12)', text: '#1b5e20' };
  return { dot: '#757575', bg: 'rgba(117,117,117,0.1)', text: '#616161' };
}

/**
 * Format annotation name for display
 */
function formatAnn(ann: string) {
  if (ann === 'pLoF') return 'pLoF';
  if (ann === 'missenseLC') return 'Missense';
  if (ann === 'synonymous') return 'Syn';
  return ann;
}

/**
 * Get significant burden hits for a gene
 */
function getGeneBurdenHits(g: UnifiedGene): { annotation: string; test: string; pvalue: number }[] {
  if (!g.burden_results) return [];
  const hits: { annotation: string; test: string; pvalue: number }[] = [];
  for (const b of g.burden_results) {
    if (b.pvalue && b.pvalue < SIG_THRESHOLD) {
      hits.push({ annotation: b.annotation, test: 'SKAT-O', pvalue: b.pvalue });
    }
    if (b.pvalue_burden && b.pvalue_burden < SIG_THRESHOLD) {
      hits.push({ annotation: b.annotation, test: 'Burden', pvalue: b.pvalue_burden });
    }
    if (b.pvalue_skat && b.pvalue_skat < SIG_THRESHOLD) {
      hits.push({ annotation: b.annotation, test: 'SKAT', pvalue: b.pvalue_skat });
    }
  }
  return hits.sort((a, b) => a.pvalue - b.pvalue);
}

/**
 * Check if gene has implicated evidence (burden or coding hits)
 */
function geneHasEvidence(g: UnifiedGene): boolean {
  const hasBurdenHit = getGeneBurdenHits(g).length > 0;
  const hasGenomeCoding =
    (g.genome_coding_hits?.lof ?? 0) > 0 || (g.genome_coding_hits?.missense ?? 0) > 0;
  const hasExomeCoding =
    (g.exome_coding_hits?.lof ?? 0) > 0 || (g.exome_coding_hits?.missense ?? 0) > 0;
  return hasBurdenHit || hasGenomeCoding || hasExomeCoding;
}

/**
 * Unified Locus Table Component.
 *
 * Displays merged evidence from genome GWAS, exome GWAS, and gene burden tests.
 */
export const UnifiedLocusTable: React.FC<UnifiedLocusTableProps> = ({
  unifiedLoci,
  onLocusClick,
  selectedPeakIds,
  onTogglePeak,
  customLabelMode,
  onClearSelection,
  onResetToDefault,
  onSelectAllFiltered,
}) => {
  const [showOnlyImplicated, setShowOnlyImplicated] = useState(false);
  const [visibleRowCount, setVisibleRowCount] = useState(100);

  // Sort by best p-value
  const sortedLoci = useMemo(() => {
    return [...unifiedLoci].sort((a, b) => {
      const bestA = Math.min(a.pvalue_genome ?? Infinity, a.pvalue_exome ?? Infinity);
      const bestB = Math.min(b.pvalue_genome ?? Infinity, b.pvalue_exome ?? Infinity);
      return bestA - bestB;
    });
  }, [unifiedLoci]);

  // Filter to only loci with gene evidence
  const filteredLoci = useMemo(() => {
    if (!showOnlyImplicated) return sortedLoci;
    return sortedLoci.filter((locus) => locus.genes.some(geneHasEvidence));
  }, [sortedLoci, showOnlyImplicated]);

  const handleSelectAllFiltered = useCallback(() => {
    const ids = new Set(filteredLoci.map((l) => `${l.contig}-${l.position}`));
    onSelectAllFiltered(ids);
  }, [filteredLoci, onSelectAllFiltered]);

  const showMoreRows = useCallback(() => {
    setVisibleRowCount((prev) => prev + 100);
  }, []);

  return (
    <div className="manhattan-table-container">
      {/* Control panel above table */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
          padding: '8px 12px',
          background: '#f5f5f5',
          borderRadius: 4,
          fontSize: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ color: '#333' }}>
            <strong>{filteredLoci.length}</strong>
            {showOnlyImplicated ? ` / ${sortedLoci.length}` : ''} loci
          </span>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={showOnlyImplicated}
              onChange={(e) => setShowOnlyImplicated(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            <span style={{ fontSize: 11 }}>Gene implicated</span>
          </label>
          {customLabelMode ? (
            <span style={{ color: '#1565c0' }}>
              <strong>{selectedPeakIds.size}</strong> labeled
            </span>
          ) : (
            <span style={{ color: '#666', fontSize: 11 }}>Top 25 labeled</span>
          )}
          {!customLabelMode && (
            <button
              onClick={handleSelectAllFiltered}
              style={{
                fontSize: 11,
                padding: '4px 10px',
                cursor: 'pointer',
                background: '#fff',
                border: '1px solid #ccc',
                borderRadius: 3,
              }}
              title="Select all filtered loci for labeling"
            >
              Select all ({filteredLoci.length})
            </button>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Legend for annotation colors */}
          <span style={{ fontSize: 10, color: '#666' }}>
            <span style={{ color: '#d32f2f' }}>●</span> pLoF
          </span>
          <span style={{ fontSize: 10, color: '#666' }}>
            <span style={{ color: '#f9a825' }}>●</span> Missense
          </span>
          <span style={{ fontSize: 10, color: '#666', marginLeft: 8 }}>
            <span
              style={{
                fontSize: 9,
                padding: '1px 4px',
                background: '#e3f2fd',
                borderRadius: 2,
                fontWeight: 500,
              }}
            >
              G
            </span>{' '}
            Genome
          </span>
          <span style={{ fontSize: 10, color: '#666' }}>
            <span
              style={{
                fontSize: 9,
                padding: '1px 4px',
                background: '#fff3e0',
                borderRadius: 2,
                fontWeight: 500,
              }}
            >
              E
            </span>{' '}
            Exome
          </span>
          <span style={{ fontSize: 10, color: '#666', marginLeft: 8 }}>
            <span
              style={{
                fontSize: 9,
                padding: '1px 4px',
                background: 'rgba(156, 39, 176, 0.15)',
                color: '#7b1fa2',
                borderRadius: 2,
                fontWeight: 500,
              }}
            >
              Burden only
            </span>{' '}
            No GWAS signal
          </span>
          {customLabelMode && (
            <>
              {selectedPeakIds.size > 0 && (
                <button
                  onClick={onClearSelection}
                  style={{
                    fontSize: 11,
                    padding: '4px 10px',
                    cursor: 'pointer',
                    background: '#fff',
                    border: '1px solid #ccc',
                    borderRadius: 3,
                  }}
                >
                  Clear all
                </button>
              )}
              <button
                onClick={onResetToDefault}
                style={{
                  fontSize: 11,
                  padding: '4px 10px',
                  cursor: 'pointer',
                  background: '#fff',
                  border: '1px solid #ccc',
                  borderRadius: 3,
                }}
              >
                Reset to top 25
              </button>
            </>
          )}
        </div>
      </div>

      <table className="manhattan-table manhattan-table-locus">
        <thead>
          <tr>
            <th style={{ width: 32 }}>Label</th>
            <th>Locus</th>
            <th>Genes in Locus</th>
            <th>P-value (Genome)</th>
            <th>P-value (Exome)</th>
            <th title="Gene burden test results">P-value (Burden)</th>
            <th title="Coding variants from significant GWAS hits">Coding Hits</th>
          </tr>
        </thead>
        <tbody>
          {filteredLoci.slice(0, visibleRowCount).map((locus, index) => {
            const locusId = `${locus.contig}-${locus.position}`;
            const isSelected = selectedPeakIds.has(locusId);
            const hasLabel = customLabelMode ? isSelected : index < 25;

            // Genes with burden hits
            const genesWithBurden = locus.genes
              .map((g) => ({ gene: g, hits: getGeneBurdenHits(g) }))
              .filter((x) => x.hits.length > 0);
            const genesWithoutBurden = locus.genes.filter(
              (g) => getGeneBurdenHits(g).length === 0
            );

            // Best burden p-value across all genes
            const bestBurdenPvalue = locus.genes.reduce((best, g) => {
              const hits = getGeneBurdenHits(g);
              if (hits.length === 0) return best;
              const minP = Math.min(...hits.map((h) => h.pvalue));
              return minP < best ? minP : best;
            }, Infinity);

            // Check if this is a burden-only locus (no GWAS signal)
            const isBurdenOnly = locus.pvalue_genome == null && locus.pvalue_exome == null;

            return (
              <tr
                key={locusId}
                className={isSelected ? 'manhattan-row-selected' : ''}
                style={isBurdenOnly ? { background: 'rgba(156, 39, 176, 0.06)' } : undefined}
              >
                <td style={{ width: 32, textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={hasLabel}
                    onChange={() => onTogglePeak(locusId)}
                    title={hasLabel ? 'Remove label' : 'Add label'}
                    style={{ cursor: 'pointer' }}
                  />
                </td>
                <td
                  onClick={() => onLocusClick?.(locus.contig, locus.position)}
                  style={{ cursor: onLocusClick ? 'pointer' : 'default' }}
                >
                  {locus.contig}:{locus.position.toLocaleString()}
                  {isBurdenOnly && (
                    <span
                      style={{
                        fontSize: 9,
                        marginLeft: 6,
                        padding: '1px 5px',
                        background: 'rgba(156, 39, 176, 0.15)',
                        color: '#7b1fa2',
                        borderRadius: 3,
                        fontWeight: 500,
                      }}
                    >
                      Burden only
                    </span>
                  )}
                </td>
                <td>
                  {/* Genes with burden hits shown first with badges */}
                  {genesWithBurden.map(({ gene: g, hits }, i) => {
                    const topHits = hits.slice(0, 2);
                    const hasGenomeCoding =
                      (g.genome_coding_hits?.lof ?? 0) > 0 ||
                      (g.genome_coding_hits?.missense ?? 0) > 0;
                    const hasExomeCoding =
                      (g.exome_coding_hits?.lof ?? 0) > 0 ||
                      (g.exome_coding_hits?.missense ?? 0) > 0;

                    return (
                      <div
                        key={g.gene_id}
                        style={{ marginBottom: i < genesWithBurden.length - 1 ? 4 : 0 }}
                      >
                        <span style={{ fontWeight: 600 }}>{g.gene_symbol}</span>
                        <span style={{ fontSize: 10, color: '#888', marginLeft: 4 }}>
                          ({Math.round(g.distance_kb)}kb)
                        </span>
                        <span style={{ marginLeft: 6 }}>
                          {topHits.map((hit, j) => {
                            const colors = getAnnotationColor(hit.annotation);
                            return (
                              <span
                                key={`${hit.annotation}-${hit.test}`}
                                style={{
                                  fontSize: 10,
                                  marginLeft: j > 0 ? 4 : 0,
                                  padding: '1px 5px',
                                  borderRadius: 3,
                                  background: colors.bg,
                                  color: colors.text,
                                  fontWeight: 500,
                                }}
                              >
                                <span style={{ color: colors.dot }}>●</span>{' '}
                                {formatAnn(hit.annotation)} ({hit.test})
                              </span>
                            );
                          })}
                          {hits.length > 2 && (
                            <span style={{ fontSize: 10, color: '#888', marginLeft: 4 }}>
                              +{hits.length - 2}
                            </span>
                          )}
                        </span>
                        {/* G/E badges for coding hits */}
                        {hasGenomeCoding && (
                          <span
                            style={{
                              fontSize: 9,
                              marginLeft: 4,
                              padding: '1px 4px',
                              background: '#e3f2fd',
                              borderRadius: 2,
                              fontWeight: 500,
                            }}
                          >
                            G
                          </span>
                        )}
                        {hasExomeCoding && (
                          <span
                            style={{
                              fontSize: 9,
                              marginLeft: 2,
                              padding: '1px 4px',
                              background: '#fff3e0',
                              borderRadius: 2,
                              fontWeight: 500,
                            }}
                          >
                            E
                          </span>
                        )}
                      </div>
                    );
                  })}
                  {/* Other genes on same line */}
                  {genesWithoutBurden.length > 0 && (
                    <div style={{ color: '#666', fontSize: 11 }}>
                      {genesWithoutBurden.slice(0, 4).map((g) => {
                        const hasGenomeCoding =
                          (g.genome_coding_hits?.lof ?? 0) > 0 ||
                          (g.genome_coding_hits?.missense ?? 0) > 0;
                        const hasExomeCoding =
                          (g.exome_coding_hits?.lof ?? 0) > 0 ||
                          (g.exome_coding_hits?.missense ?? 0) > 0;
                        return (
                          <span key={g.gene_id} style={{ marginRight: 6 }}>
                            {g.gene_symbol}
                            {hasGenomeCoding && (
                              <span
                                style={{
                                  fontSize: 9,
                                  marginLeft: 2,
                                  padding: '1px 3px',
                                  background: '#e3f2fd',
                                  borderRadius: 2,
                                }}
                              >
                                G
                              </span>
                            )}
                            {hasExomeCoding && (
                              <span
                                style={{
                                  fontSize: 9,
                                  marginLeft: 2,
                                  padding: '1px 3px',
                                  background: '#fff3e0',
                                  borderRadius: 2,
                                }}
                              >
                                E
                              </span>
                            )}
                          </span>
                        );
                      })}
                      {genesWithoutBurden.length > 4 &&
                        ` +${genesWithoutBurden.length - 4} more`}
                    </div>
                  )}
                  {locus.genes.length === 0 && '—'}
                </td>
                <td>{locus.pvalue_genome?.toExponential(2) ?? '—'}</td>
                <td>{locus.pvalue_exome?.toExponential(2) ?? '—'}</td>
                <td>
                  {bestBurdenPvalue !== Infinity ? bestBurdenPvalue.toExponential(2) : '—'}
                </td>
                <td style={{ fontSize: 11 }}>
                  {/* Per-gene LoF/missense variant counts */}
                  {locus.genes
                    .filter((g) => geneHasEvidence(g))
                    .slice(0, 3)
                    .map((g) => {
                      const genomeLof = g.genome_coding_hits?.lof ?? 0;
                      const genomeMis = g.genome_coding_hits?.missense ?? 0;
                      const exomeLof = g.exome_coding_hits?.lof ?? 0;
                      const exomeMis = g.exome_coding_hits?.missense ?? 0;
                      const totalLof = genomeLof + exomeLof;
                      const totalMis = genomeMis + exomeMis;

                      if (totalLof === 0 && totalMis === 0) return null;

                      return (
                        <div key={g.gene_id} style={{ whiteSpace: 'nowrap' }}>
                          <span style={{ color: '#666' }}>{g.gene_symbol}:</span>{' '}
                          {totalLof > 0 && (
                            <span style={{ color: '#d32f2f', fontWeight: 500 }}>
                              {totalLof} LoF
                            </span>
                          )}
                          {totalLof > 0 && totalMis > 0 && ', '}
                          {totalMis > 0 && (
                            <span style={{ color: '#f57f17', fontWeight: 500 }}>
                              {totalMis} mis
                            </span>
                          )}
                        </div>
                      );
                    })}
                  {locus.genes.every((g) => !geneHasEvidence(g)) && (
                    <span style={{ color: '#999' }}>—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {filteredLoci.length > visibleRowCount && (
        <button
          onClick={showMoreRows}
          style={{
            width: '100%',
            padding: '8px',
            marginTop: 4,
            cursor: 'pointer',
            fontSize: 12,
            background: '#f5f5f5',
            border: '1px solid #ddd',
            borderRadius: 4,
          }}
        >
          Show more ({filteredLoci.length - visibleRowCount} remaining)
        </button>
      )}
    </div>
  );
};

export default UnifiedLocusTable;
