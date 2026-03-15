import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useRecoilValue } from 'recoil';
import type { UnifiedLocus, UnifiedGene, BurdenResult } from './types';
import { LocusGeneContextMenu } from './components/LocusGeneContextMenu';
import { analysisIdAtom } from '../sharedState';
import './ManhattanViewer.css';

const SIG_THRESHOLD = 2.5e-6;

export interface UnifiedLocusTableProps {
  /** Unified loci from the overview API */
  unifiedLoci: UnifiedLocus[];
  /** Callback when a locus is clicked (for zoom navigation) */
  onLocusClick?: (contig: string, position: number, start?: number, stop?: number) => void;
  /** Callback when a gene symbol is clicked */
  onGeneClick?: (geneId: string) => void;
  /** Set of selected peak IDs for custom labeling */
  selectedPeakIds: Set<string>;
  /** Callback to toggle a peak selection - passes filtered loci for initialization */
  onTogglePeak: (peakId: string, currentLabeledIds?: Set<string>) => void;
  /** Whether in custom label mode */
  customLabelMode: boolean;
  /** Number of top peaks to label in default mode */
  topN: number;
  /** Set number of top peaks to label (exits custom mode) */
  onSetTopN: (n: number) => void;
  /** Clear all selections */
  onClearSelection: () => void;
  /** Reset to default mode */
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
  topN,
  onSetTopN,
  onClearSelection,
  onResetToDefault,
  onSelectAllFiltered,
}) => {
  const [showOnlyImplicated, setShowOnlyImplicated] = useState(false);
  const [visibleRowCount, setVisibleRowCount] = useState(100);
  const [searchText, setSearchText] = useState('');
  const currentAnalysisId = useRecoilValue(analysisIdAtom);
  // Local slider value with debounced propagation to avoid layout thrash
  const [sliderValue, setSliderValue] = useState(topN);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => { setSliderValue(topN); }, [topN]);
  // Unified context menu state - can include locus, gene, or both
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    locus?: { contig: string; position: number; start?: number; stop?: number };
    gene?: { geneId: string; geneSymbol: string };
  } | null>(null);

  // Sort by implicated first, then best p-value
  const sortedLoci = useMemo(() => {
    return [...unifiedLoci].sort((a, b) => {
      const aImpl = a.genes.some(geneHasEvidence);
      const bImpl = b.genes.some(geneHasEvidence);
      if (aImpl !== bImpl) return aImpl ? -1 : 1;
      const bestA = Math.min(a.pvalue_genome ?? Infinity, a.pvalue_exome ?? Infinity);
      const bestB = Math.min(b.pvalue_genome ?? Infinity, b.pvalue_exome ?? Infinity);
      return bestA - bestB;
    });
  }, [unifiedLoci]);

  // Filter by search text - matches gene_symbol, contig:position, or special keywords
  const searchFilteredLoci = useMemo(() => {
    if (!searchText.trim()) return sortedLoci;
    const term = searchText.trim().toLowerCase();

    return sortedLoci.filter((locus) => {
      // Check locus position (e.g., "chr1:12345" or just "chr1")
      const locusStr = `${locus.contig}:${locus.position}`.toLowerCase();
      if (locusStr.includes(term) || locus.contig.toLowerCase().includes(term)) {
        return true;
      }

      // Check gene symbols
      if (locus.genes.some((g) => g.gene_symbol.toLowerCase().includes(term))) {
        return true;
      }

      // Special keywords: "lof" matches loci with significant LoF variants/burden
      if (term === 'lof' || term === 'plof') {
        return locus.genes.some((g) => {
          const coding = getGeneCodingCounts(g);
          const hasLofBurden = getGeneBurdenTypes(g).includes('pLoF');
          return coding.lof > 0 || hasLofBurden;
        });
      }

      // Special keywords: "missense" or "mis" matches loci with missense variants/burden
      if (term === 'missense' || term === 'mis') {
        return locus.genes.some((g) => {
          const coding = getGeneCodingCounts(g);
          const hasMisBurden = getGeneBurdenTypes(g).includes('missenseLC');
          return coding.missense > 0 || hasMisBurden;
        });
      }

      // Special keywords: "coding" matches loci with any coding variants
      if (term === 'coding') {
        return locus.genes.some((g) => {
          const coding = getGeneCodingCounts(g);
          return coding.lof > 0 || coding.missense > 0;
        });
      }

      // Special keywords: "burden" matches loci with any significant burden test
      if (term === 'burden') {
        return locus.genes.some((g) => getGeneBurdenTypes(g).length > 0);
      }

      return false;
    });
  }, [sortedLoci, searchText]);

  // Filter to only loci with gene evidence
  const filteredLoci = useMemo(() => {
    if (!showOnlyImplicated) return searchFilteredLoci;
    return searchFilteredLoci.filter((locus) => locus.genes.some(geneHasEvidence));
  }, [searchFilteredLoci, showOnlyImplicated]);

  const handleSliderChange = useCallback((v: number) => {
    setSliderValue(v);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onSetTopN(v);
    }, 250);
  }, [onSetTopN]);

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
          background: 'var(--theme-surface-alt)',
          borderRadius: 4,
          fontSize: 12,
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Search input */}
          <input
            type="text"
            placeholder="Search genes, loci, lof, missense..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{
              padding: '4px 8px',
              fontSize: 11,
              border: '1px solid var(--theme-border, #ccc)',
              borderRadius: 3,
              width: 180,
              background: 'var(--theme-surface, #fff)',
              color: 'var(--theme-text, #333)',
            }}
          />
          <span style={{ color: 'var(--theme-text)' }}>
            <strong>{filteredLoci.length}</strong>
            {(showOnlyImplicated || searchText) ? ` / ${sortedLoci.length}` : ''} loci
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
          {/* Label controls */}
          {customLabelMode ? (
            <span style={{ color: 'var(--theme-primary, #262262)' }}>
              <strong>{selectedPeakIds.size}</strong> labeled
              <button
                onClick={onResetToDefault}
                style={{
                  fontSize: 10,
                  padding: '2px 6px',
                  cursor: 'pointer',
                  background: 'none',
                  border: 'none',
                  color: 'var(--theme-primary, #262262)',
                  textDecoration: 'underline',
                  marginLeft: 4,
                }}
                title="Return to top-N auto-label mode"
              >
                reset
              </button>
            </span>
          ) : (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, color: 'var(--theme-text-muted)', whiteSpace: 'nowrap' }}>Labels:</span>
              <input
                type="range"
                min={0}
                max={Math.min(filteredLoci.length, 100)}
                value={sliderValue}
                onChange={(e) => handleSliderChange(Number(e.target.value))}
                style={{ width: 80, cursor: 'pointer' }}
                title={`Label top ${sliderValue} peaks`}
              />
              <input
                type="number"
                min={0}
                max={filteredLoci.length}
                value={sliderValue}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (!isNaN(v) && v >= 0) handleSliderChange(v);
                }}
                style={{
                  width: 40,
                  fontSize: 11,
                  padding: '2px 4px',
                  border: '1px solid var(--theme-border, #ccc)',
                  borderRadius: 3,
                  background: 'var(--theme-surface, #fff)',
                  color: 'var(--theme-text, #333)',
                  textAlign: 'center',
                }}
              />
              <button
                onClick={handleSelectAllFiltered}
                style={{
                  fontSize: 10,
                  padding: '2px 6px',
                  cursor: 'pointer',
                  background: 'var(--theme-surface)',
                  border: '1px solid var(--theme-border)',
                  borderRadius: 3,
                  whiteSpace: 'nowrap',
                }}
                title="Label all filtered loci"
              >
                All
              </button>
              <button
                onClick={onClearSelection}
                style={{
                  fontSize: 10,
                  padding: '2px 6px',
                  cursor: 'pointer',
                  background: 'var(--theme-surface)',
                  border: '1px solid var(--theme-border)',
                  borderRadius: 3,
                  whiteSpace: 'nowrap',
                }}
                title="Remove all labels"
              >
                None
              </button>
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Right-click hint */}
          <span style={{ fontSize: 10, color: 'var(--theme-text-muted)', fontStyle: 'italic' }}>
            Right-click rows for options
          </span>
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
            const hasLabel = customLabelMode ? isSelected : index < topN;

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
                  onClick={() => onLocusClick?.(locus.contig, locus.position, locus.start, locus.stop)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setContextMenu({
                      x: e.clientX,
                      y: e.clientY,
                      locus: { contig: locus.contig, position: locus.position, start: locus.start, stop: locus.stop },
                    });
                  }}
                  style={{ cursor: onLocusClick ? 'pointer' : 'default' }}
                  title="Click to view locus, right-click for options"
                >
                  <span style={{ color: 'var(--theme-primary, #262262)', textDecoration: 'underline' }}>
                    {locus.contig}:{locus.position.toLocaleString()}
                  </span>
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
                          style={{ fontWeight: 600, cursor: 'pointer', color: 'var(--theme-primary, #262262)' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            onGeneClick?.(g.gene_id);
                          }}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setContextMenu({
                              x: e.clientX,
                              y: e.clientY,
                              locus: { contig: locus.contig, position: locus.position, start: locus.start, stop: locus.stop },
                              gene: { geneId: g.gene_id, geneSymbol: g.gene_symbol },
                            });
                          }}
                          title={`View ${g.gene_symbol} page, right-click for options`}
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
                    <span style={{ color: 'var(--theme-text-muted, #888)', fontSize: 11 }}>
                      {nonImplicatedGenes.slice(0, 3).map((g, idx) => (
                        <React.Fragment key={g.gene_id}>
                          <span
                            style={{ cursor: 'pointer', textDecoration: 'underline' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              onGeneClick?.(g.gene_id);
                            }}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setContextMenu({
                                x: e.clientX,
                                y: e.clientY,
                                locus: { contig: locus.contig, position: locus.position, start: locus.start, stop: locus.stop },
                                gene: { geneId: g.gene_id, geneSymbol: g.gene_symbol },
                              });
                            }}
                            title={`View ${g.gene_symbol} page, right-click for options`}
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
            background: 'var(--theme-surface-alt)',
            border: '1px solid var(--theme-border)',
            borderRadius: 4,
          }}
        >
          Show more ({filteredLoci.length - visibleRowCount} remaining)
        </button>
      )}

      {/* Unified context menu */}
      {contextMenu && (
        <LocusGeneContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          locus={contextMenu.locus}
          gene={contextMenu.gene}
          currentPhenotypeDescription={currentAnalysisId || undefined}
          onClose={() => setContextMenu(null)}
          onLocusClick={onLocusClick}
        />
      )}
    </div>
  );
};

export default UnifiedLocusTable;
