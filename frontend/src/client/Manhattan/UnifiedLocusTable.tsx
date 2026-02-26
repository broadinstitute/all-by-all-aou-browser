import React, { useState, useCallback, useMemo } from 'react';
import type { UnifiedLocus, UnifiedGene, BurdenResult } from './types';
import { LocusContextMenu } from './components/LocusContextMenu';
import './ManhattanViewer.css';

const SIG_THRESHOLD = 2.5e-6;

export interface UnifiedLocusTableProps {
  /** Unified loci from the overview API */
  unifiedLoci: UnifiedLocus[];
  /** Callback when a locus is clicked (for zoom navigation) */
  onLocusClick?: (contig: string, position: number) => void;
  /** Callback when a gene symbol is clicked */
  onGeneClick?: (geneId: string) => void;
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
 * Get unique burden annotation types with significant p-values for a gene
 * Returns array like ['pLoF', 'missenseLC'] for genes with those significant burden tests
 */
function getGeneBurdenTypes(g: UnifiedGene): string[] {
  if (!g.burden_results) return [];
  const types = new Set<string>();
  for (const b of g.burden_results) {
    const hasSig =
      (b.pvalue && b.pvalue < SIG_THRESHOLD) ||
      (b.pvalue_burden && b.pvalue_burden < SIG_THRESHOLD) ||
      (b.pvalue_skat && b.pvalue_skat < SIG_THRESHOLD);
    if (hasSig) {
      types.add(b.annotation);
    }
  }
  return Array.from(types);
}

/**
 * Get total coding variant counts for a gene (genome + exome)
 */
function getGeneCodingCounts(g: UnifiedGene): { lof: number; missense: number } {
  const lof = (g.genome_coding_hits?.lof ?? 0) + (g.exome_coding_hits?.lof ?? 0);
  const missense = (g.genome_coding_hits?.missense ?? 0) + (g.exome_coding_hits?.missense ?? 0);
  return { lof, missense };
}

/**
 * Check if gene has implicated evidence (burden or coding hits)
 */
function geneHasEvidence(g: UnifiedGene): boolean {
  const hasBurden = getGeneBurdenTypes(g).length > 0;
  const coding = getGeneCodingCounts(g);
  return hasBurden || coding.lof > 0 || coding.missense > 0;
}

/**
 * Unified Locus Table Component.
 *
 * Displays merged evidence from genome GWAS, exome GWAS, and gene burden tests.
 */
export const UnifiedLocusTable: React.FC<UnifiedLocusTableProps> = ({
  unifiedLoci,
  onLocusClick,
  onGeneClick,
  selectedPeakIds,
  onTogglePeak,
  customLabelMode,
  onClearSelection,
  onResetToDefault,
  onSelectAllFiltered,
}) => {
  const [showOnlyImplicated, setShowOnlyImplicated] = useState(false);
  const [visibleRowCount, setVisibleRowCount] = useState(100);
  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    contig: string;
    position: number;
  } | null>(null);

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
          {/* Legend */}
          <span style={{ fontSize: 10, color: '#666' }}>
            Burden: <span style={{ color: '#d32f2f' }}>●</span>pLoF{' '}
            <span style={{ color: '#f9a825' }}>●</span>Mis{' '}
            <span style={{ color: '#388e3c' }}>●</span>Syn
          </span>
          <span style={{ fontSize: 10, color: '#262262', fontWeight: 500 }}>
            (nLOF) (nMIS)
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
          </tr>
        </thead>
        <tbody>
          {filteredLoci.slice(0, visibleRowCount).map((locus, index) => {
            const locusId = `${locus.contig}-${locus.position}`;
            const isSelected = selectedPeakIds.has(locusId);
            const hasLabel = customLabelMode ? isSelected : index < 25;

            // Partition genes: implicated first, then non-implicated
            const implicatedGenes = locus.genes.filter(geneHasEvidence);
            const nonImplicatedGenes = locus.genes.filter((g) => !geneHasEvidence(g));

            // Best burden p-value across all genes
            const bestBurdenPvalue = locus.genes.reduce((best, g) => {
              const types = getGeneBurdenTypes(g);
              if (types.length === 0) return best;
              // Find best p-value across all burden results
              let minP = Infinity;
              for (const b of g.burden_results || []) {
                if (b.pvalue && b.pvalue < minP) minP = b.pvalue;
                if (b.pvalue_burden && b.pvalue_burden < minP) minP = b.pvalue_burden;
                if (b.pvalue_skat && b.pvalue_skat < minP) minP = b.pvalue_skat;
              }
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
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setContextMenu({
                      x: e.clientX,
                      y: e.clientY,
                      contig: locus.contig,
                      position: locus.position,
                    });
                  }}
                  style={{ cursor: onLocusClick ? 'pointer' : 'default' }}
                  title="Click to view locus, right-click for options"
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
                  {/* Implicated genes shown first - ALL of them, never truncated */}
                  {implicatedGenes.map((g, i) => {
                    const burdenTypes = getGeneBurdenTypes(g);
                    const coding = getGeneCodingCounts(g);
                    const hasBurden = burdenTypes.length > 0;
                    const hasCoding = coding.lof > 0 || coding.missense > 0;

                    return (
                      <span
                        key={g.gene_id}
                        style={{
                          display: 'inline-block',
                          marginRight: 8,
                          marginBottom: 2,
                        }}
                      >
                        <span
                          style={{ fontWeight: 600, cursor: 'pointer', color: '#1565c0' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            onGeneClick?.(g.gene_id);
                          }}
                          title={`View ${g.gene_symbol} page`}
                        >
                          {g.gene_symbol}
                        </span>
                        {/* Burden dots - one per annotation type */}
                        {burdenTypes.includes('pLoF') && (
                          <span style={{ color: '#d32f2f', marginLeft: 2 }} title="pLoF burden">●</span>
                        )}
                        {burdenTypes.includes('missenseLC') && (
                          <span style={{ color: '#f9a825', marginLeft: 1 }} title="Missense burden">●</span>
                        )}
                        {burdenTypes.includes('synonymous') && (
                          <span style={{ color: '#388e3c', marginLeft: 1 }} title="Synonymous burden">●</span>
                        )}
                        {/* Coding counts inline - AoU dark blue */}
                        {hasCoding && (
                          <span style={{ fontSize: 10, marginLeft: 2, color: '#262262', fontWeight: 500 }}>
                            {coding.lof > 0 && (
                              <span>({coding.lof}LOF)</span>
                            )}
                            {coding.missense > 0 && (
                              <span style={{ marginLeft: coding.lof > 0 ? 2 : 0 }}>({coding.missense}MIS)</span>
                            )}
                          </span>
                        )}
                      </span>
                    );
                  })}
                  {/* Non-implicated genes condensed */}
                  {nonImplicatedGenes.length > 0 && (
                    <span style={{ color: '#888', fontSize: 11 }}>
                      {nonImplicatedGenes.slice(0, 3).map((g, idx) => (
                        <React.Fragment key={g.gene_id}>
                          <span
                            style={{ cursor: 'pointer', textDecoration: 'underline' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              onGeneClick?.(g.gene_id);
                            }}
                            title={`View ${g.gene_symbol} page`}
                          >
                            {g.gene_symbol}
                          </span>
                          {idx < 2 && idx < nonImplicatedGenes.length - 1 && ', '}
                        </React.Fragment>
                      ))}
                      {nonImplicatedGenes.length > 3 && ` +${nonImplicatedGenes.length - 3}`}
                    </span>
                  )}
                  {locus.genes.length === 0 && '—'}
                </td>
                <td>{locus.pvalue_genome?.toExponential(2) ?? '—'}</td>
                <td>{locus.pvalue_exome?.toExponential(2) ?? '—'}</td>
                <td>
                  {bestBurdenPvalue !== Infinity ? bestBurdenPvalue.toExponential(2) : '—'}
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

      {/* Context menu */}
      {contextMenu && (
        <LocusContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          contig={contextMenu.contig}
          position={contextMenu.position}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
};

export default UnifiedLocusTable;
