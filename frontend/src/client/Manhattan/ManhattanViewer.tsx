import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { useHitDetection } from './hooks/useHitDetection';
import { usePeakLabelLayout, PeakLabelNode } from './hooks/usePeakLabelLayout';
import { Tooltip } from './components/Tooltip';
import { PeakTooltip } from './components/PeakTooltip';
import { YAxis } from './components/YAxis';
import { PeakLabels } from './components/PeakLabels';
import { computeDisplayHits, getChromosomeLayout } from './layout';
import type { Peak } from './types';
import { ChromosomeSelector } from '../Shared/ChromosomeSelector';
import type { ManhattanOverlay, DisplayHit } from './types';
import './ManhattanViewer.css';

const Y_AXIS_WIDTH = 50;

export interface ManhattanViewerProps {
  /** URL to the PNG image */
  imageUrl: string;
  /** Overlay data with significant hits from the API */
  overlay: ManhattanOverlay;
  /** Callback when a significant hit is clicked */
  onHitClick?: (hit: DisplayHit) => void;
  /** Callback when a peak label is clicked */
  onPeakClick?: (node: PeakLabelNode) => void;
  /** Callback when hovering over a hit (null = hover out) */
  onHitHover?: (hit: DisplayHit | null) => void;
  /** Show Y-axis with -log10(p) labels */
  showYAxis?: boolean;
  /** Show stats bar with hit counts */
  showStats?: boolean;
  /** Minimum width before horizontal scroll kicks in */
  minWidth?: number;
  /** Custom class name for the container */
  className?: string;
  /** Currently selected chromosome ('all' for genome-wide, or 'chr1'-'chrY') */
  contig?: string;
  /** Callback when a chromosome is clicked (for zoom navigation) */
  onContigClick?: (contig: string) => void;
}

/**
 * Manhattan Plot Viewer Component.
 *
 * Composites a server-rendered PNG with an interactive SVG overlay
 * for significant variant hits. Uses spatial indexing for efficient
 * hit detection without DOM thrashing.
 */
export const ManhattanViewer: React.FC<ManhattanViewerProps> = ({
  imageUrl,
  overlay,
  onHitClick,
  onPeakClick,
  onHitHover,
  showYAxis = true,
  showStats = true,
  minWidth = 800,
  className,
  contig = 'all',
  onContigClick,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageWrapperRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [hoveredHit, setHoveredHit] = useState<DisplayHit | null>(null);
  const [hoveredPeakNode, setHoveredPeakNode] = useState<PeakLabelNode | null>(null);
  // Set of selected peak IDs for custom label curation (contig-position format)
  const [selectedPeakIds, setSelectedPeakIds] = useState<Set<string>>(new Set());
  // Track if user is in custom label mode (vs default top-25 mode)
  const [customLabelMode, setCustomLabelMode] = useState(false);
  // Filter to show only loci with gene evidence (burden hits or coding variants)
  const [showOnlyImplicated, setShowOnlyImplicated] = useState(false);
  // Limit visible rows for performance (not virtualized)
  const [visibleRowCount, setVisibleRowCount] = useState(100);
  const [cursor, setCursor] = useState({ x: 0, y: 0 });
  const [peakCursor, setPeakCursor] = useState({ x: 0, y: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Compute display coordinates from raw hits
  const displayHits = useMemo(
    () => computeDisplayHits(overlay.significant_hits, contig),
    [overlay.significant_hits, contig]
  );

  // Filter peaks for labeling: if in custom mode, show only selected peaks
  // Otherwise show all peaks (hook will limit to maxLabels)
  const peaksForLabels = useMemo(() => {
    if (!overlay.peaks) return undefined;
    if (!customLabelMode) return overlay.peaks;
    // Custom mode - show only selected peaks (no maxLabels limit)
    return overlay.peaks.filter((p) => selectedPeakIds.has(`${p.contig}-${p.position}`));
  }, [overlay.peaks, selectedPeakIds, customLabelMode]);

  // Compute peak label positions and required label area height
  // When in custom mode, use high maxLabels to show all selected
  const { nodes: peakLabelNodes, labelAreaHeight } = usePeakLabelLayout(
    peaksForLabels,
    dimensions.width,
    dimensions.height,
    contig,
    customLabelMode ? 500 : 25 // No limit when user-selected
  );

  // Memoize sorted peaks for the table (expensive for large datasets)
  const sortedPeaks = useMemo(() => {
    if (!overlay.peaks) return [];
    return [...overlay.peaks].sort((a, b) => a.pvalue - b.pvalue);
  }, [overlay.peaks]);

  // Filter peaks to only those with gene evidence (burden hits OR coding LoF/missense)
  const SIG_THRESHOLD = 2.5e-6;
  const filteredPeaks = useMemo(() => {
    if (!showOnlyImplicated) return sortedPeaks;
    return sortedPeaks.filter((peak) =>
      peak.genes.some((g) => {
        // Has significant burden test result (pLoF or missense)?
        const hasBurdenHit = g.burden_results?.some((b) =>
          (b.annotation === 'pLoF' || b.annotation === 'missenseLC') &&
          ((b.pvalue && b.pvalue < SIG_THRESHOLD) ||
           (b.pvalue_burden && b.pvalue_burden < SIG_THRESHOLD) ||
           (b.pvalue_skat && b.pvalue_skat < SIG_THRESHOLD))
        );
        // Has coding LoF or missense variants?
        const hasCodingHit = (g.lof_count || 0) > 0 || (g.missense_count || 0) > 0;
        return hasBurdenHit || hasCodingHit;
      })
    );
  }, [sortedPeaks, showOnlyImplicated]);

  // Stable callbacks for peak selection
  const togglePeak = useCallback((peakId: string) => {
    setCustomLabelMode(true);
    setSelectedPeakIds((prev) => {
      const next = new Set(prev);
      if (next.has(peakId)) {
        next.delete(peakId);
      } else {
        next.add(peakId);
      }
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedPeakIds(new Set());
    // Stay in custom mode - no labels shown
  }, []);

  const resetToDefault = useCallback(() => {
    setSelectedPeakIds(new Set());
    setCustomLabelMode(false);
  }, []);

  const selectAllFiltered = useCallback(() => {
    setCustomLabelMode(true);
    const ids = new Set(filteredPeaks.map((p) => `${p.contig}-${p.position}`));
    setSelectedPeakIds(ids);
  }, [filteredPeaks]);

  const showMoreRows = useCallback(() => {
    setVisibleRowCount((prev) => prev + 100);
  }, []);

  // Use spatial indexing for efficient hit detection
  const { findHit } = useHitDetection(
    displayHits,
    dimensions.width,
    dimensions.height
  );

  // Observe image size changes for responsive scaling
  useEffect(() => {
    const image = imageRef.current;
    if (!image) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const { width, height } = entry.contentRect;
        setDimensions({ width, height });
      }
    });

    observer.observe(image);
    return () => observer.disconnect();
  }, [imageLoaded]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const svg = e.currentTarget;
      const rect = svg.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      setCursor({ x, y });

      const hit = findHit(x, y);
      if (hit !== hoveredHit) {
        setHoveredHit(hit);
        onHitHover?.(hit);
      }
    },
    [findHit, hoveredHit, onHitHover]
  );

  const handleMouseLeave = useCallback(() => {
    setHoveredHit(null);
    onHitHover?.(null);
  }, [onHitHover]);

  const handleClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (hoveredHit && onHitClick) {
        onHitClick(hoveredHit);
      } else if (!hoveredHit && contig === 'all' && onContigClick) {
        // Click-to-zoom: determine which chromosome was clicked
        const rect = e.currentTarget.getBoundingClientRect();
        const xNormalized = (e.clientX - rect.left) / dimensions.width;
        const layout = getChromosomeLayout('all');
        const clickedChrom = layout.getChromosomeAtX(xNormalized);
        if (clickedChrom) {
          onContigClick(`chr${clickedChrom}`);
        }
      }
    },
    [hoveredHit, onHitClick, contig, onContigClick, dimensions.width]
  );

  const handleImageLoad = useCallback(() => {
    setImageLoaded(true);
    setImageError(false);
  }, []);

  const handleImageError = useCallback(() => {
    setImageError(true);
    setImageLoaded(false);
  }, []);

  const handlePeakHover = useCallback((node: PeakLabelNode | null, x?: number, y?: number) => {
    setHoveredPeakNode(node);
    if (x !== undefined && y !== undefined) {
      setPeakCursor({ x, y });
    }
  }, []);

  const containerStyle: React.CSSProperties = {
    minWidth: minWidth,
  };

  if (imageError) {
    return (
      <div className={`manhattan-container ${className || ''}`} style={containerStyle}>
        <div className="manhattan-error">Failed to load Manhattan plot image</div>
      </div>
    );
  }

  const hasPeaks = peakLabelNodes.length > 0;
  const isZoomedIn = contig !== 'all';

  return (
    <div
      ref={containerRef}
      className={`manhattan-container ${className || ''}`}
      style={containerStyle}
    >
      {/* Chromosome navigation controls */}
      {imageLoaded && (
        <div
          className="manhattan-chromosome-nav"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            marginBottom: '8px',
            marginLeft: showYAxis ? Y_AXIS_WIDTH : 0,
          }}
        >
          {isZoomedIn && (
            <button
              onClick={() => onContigClick?.('all')}
              style={{
                cursor: 'pointer',
                padding: '4px 12px',
                borderRadius: '4px',
                border: '1px solid #ccc',
                background: '#fff',
                fontSize: '12px',
              }}
            >
              &larr; Back to All
            </button>
          )}
          <span style={{ fontSize: '12px', color: '#666' }}>Chromosome:</span>
          <ChromosomeSelector />
          {!isZoomedIn && (
            <span style={{ fontSize: '11px', color: '#999', fontStyle: 'italic' }}>
              (or click on plot to zoom)
            </span>
          )}
        </div>
      )}

      <div className="manhattan-plot-row" style={{ display: 'flex' }}>
        {/* Y-Axis */}
        {showYAxis && imageLoaded && (
          <div style={{ width: Y_AXIS_WIDTH, flexShrink: 0, position: 'relative', marginTop: labelAreaHeight }}>
            <YAxis height={dimensions.height} width={Y_AXIS_WIDTH} />
          </div>
        )}

        <div ref={imageWrapperRef} className="manhattan-image-wrapper" style={{ flex: 1, position: 'relative' }}>
          {/* Spacer for label area */}
          {hasPeaks && <div style={{ height: labelAreaHeight }} />}

          <img
            ref={imageRef}
            src={imageUrl}
            alt="Manhattan Plot"
            className="manhattan-image"
            onLoad={handleImageLoad}
            onError={handleImageError}
            draggable={false}
          />

          {imageLoaded && dimensions.width > 0 && (
            <svg
              className="manhattan-overlay"
              width={dimensions.width}
              height={dimensions.height}
              viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
              preserveAspectRatio="none"
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              onClick={handleClick}
              style={{ top: labelAreaHeight }}
            >
              {/* Only render raw variant scatter on per-chromosome drill-down views */}
              {isZoomedIn && displayHits.map((hit) => {
                const x = hit.x_normalized * dimensions.width;
                const y = hit.y_normalized * dimensions.height;
                const isHovered = hoveredHit?.id === hit.id;
                return (
                  <circle
                    key={hit.id}
                    cx={x}
                    cy={y}
                    r={isHovered ? 4 : 2}
                    className={isHovered ? 'manhattan-hit-hovered' : 'manhattan-hit'}
                  />
                );
              })}

            </svg>
          )}

          {/* Peak labels SVG - spans label area and plot */}
          {imageLoaded && dimensions.width > 0 && hasPeaks && (
            <svg
              className="manhattan-peak-overlay"
              width={dimensions.width}
              height={dimensions.height + labelAreaHeight}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                pointerEvents: 'none',
              }}
            >
              <PeakLabels
                nodes={peakLabelNodes}
                plotHeight={dimensions.height}
                labelAreaHeight={labelAreaHeight}
                hoveredHitPosition={hoveredHit ? { contig: hoveredHit.contig, position: hoveredHit.position } : null}
                onPeakHover={handlePeakHover}
                onPeakClick={onPeakClick}
              />
            </svg>
          )}

          {/* Variant Tooltip */}
          {hoveredHit && imageLoaded && !hoveredPeakNode && (
            <Tooltip
              hit={hoveredHit}
              x={cursor.x}
              y={cursor.y + labelAreaHeight}
              containerWidth={dimensions.width}
            />
          )}

          {/* Peak Tooltip */}
          {hoveredPeakNode && imageLoaded && (
            <PeakTooltip
              node={hoveredPeakNode}
              x={peakCursor.x}
              y={peakCursor.y}
              containerWidth={dimensions.width}
            />
          )}
        </div>
      </div>

      {/* Stats bar */}
      {showStats && imageLoaded && overlay.hit_count > 0 && (
        <div className="manhattan-stats" style={{ marginLeft: showYAxis ? Y_AXIS_WIDTH : 0 }}>
          <div className="manhattan-stats-item">
            <span className="manhattan-stats-label">Significant hits:</span>
            <span className="manhattan-stats-value">
              {overlay.hit_count.toLocaleString()}
            </span>
          </div>
          <div className="manhattan-stats-item">
            <span className="manhattan-stats-label">Threshold:</span>
            <span className="manhattan-stats-value">P &lt; 5e-8</span>
          </div>
        </div>
      )}

      {/* Hit table - adapts columns based on hit type & zoom level */}
      {imageLoaded && (displayHits.length > 0 || (!isZoomedIn && overlay.peaks && overlay.peaks.length > 0)) && (
        <div className="manhattan-table-container" style={{ marginLeft: showYAxis ? Y_AXIS_WIDTH : 0 }}>
          {!isZoomedIn && filteredPeaks.length > 0 ? (
            // Locus Navigator Table (Genome-wide view)
            <>
              {/* Control panel above table */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 8,
                padding: '8px 12px',
                background: '#f5f5f5',
                borderRadius: 4,
                fontSize: 12,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <span style={{ color: '#333' }}>
                    <strong>{filteredPeaks.length}</strong>{showOnlyImplicated ? ` / ${sortedPeaks.length}` : ''} loci
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
                    <span style={{ color: '#666', fontSize: 11 }}>
                      Top 25 labeled
                    </span>
                  )}
                  {!customLabelMode && (
                    <button
                      onClick={selectAllFiltered}
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
                      Select all ({filteredPeaks.length})
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
                  {customLabelMode && (
                    <>
                      {selectedPeakIds.size > 0 && (
                        <button
                          onClick={clearSelection}
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
                        onClick={resetToDefault}
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
                    <th>P-value</th>
                    <th title="Significant GWAS variants with LoF or missense consequences">Coding Hits</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPeaks.slice(0, visibleRowCount).map((peak, index) => {
                    const peakId = `${peak.contig}-${peak.position}`;
                    const isSelected = selectedPeakIds.has(peakId);
                    const hasLabel = customLabelMode ? isSelected : index < 25;

                    // Color by annotation type (not significance)
                    const getAnnotationColor = (ann: string) => {
                      if (ann === 'pLoF') return { dot: '#d32f2f', bg: 'rgba(211,47,47,0.12)', text: '#b71c1c' };
                      if (ann === 'missenseLC') return { dot: '#f9a825', bg: 'rgba(249,168,37,0.15)', text: '#f57f17' };
                      if (ann === 'synonymous') return { dot: '#388e3c', bg: 'rgba(56,142,60,0.12)', text: '#1b5e20' };
                      return { dot: '#757575', bg: 'rgba(117,117,117,0.1)', text: '#616161' };
                    };

                    // Helper to format annotation name
                    const formatAnn = (ann: string) => {
                      if (ann === 'pLoF') return 'pLoF';
                      if (ann === 'missenseLC') return 'Missense';
                      if (ann === 'synonymous') return 'Syn';
                      return ann;
                    };

                    // Significance threshold for burden tests
                    const SIG_THRESHOLD = 2.5e-6;

                    // Find significant burden hits per gene
                    const getGeneBurdenHits = (g: typeof peak.genes[0]) => {
                      if (!g.burden_results) return [];
                      const hits: { annotation: string; test: string; pvalue: number }[] = [];
                      for (const b of g.burden_results) {
                        // Check each test type for significance
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
                      // Sort by p-value
                      return hits.sort((a, b) => a.pvalue - b.pvalue);
                    };

                    // Find genes with significant burden results
                    const genesWithBurden = peak.genes
                      .map((g) => ({ gene: g, hits: getGeneBurdenHits(g) }))
                      .filter((x) => x.hits.length > 0);
                    const genesWithoutBurden = peak.genes.filter(
                      (g) => getGeneBurdenHits(g).length === 0
                    );

                    // Sum coding variants by category across all genes in locus
                    const totals = peak.genes.reduce(
                      (acc, g) => ({
                        total: acc.total + (g.coding_variant_count || 0),
                        lof: acc.lof + (g.lof_count || 0),
                        missense: acc.missense + (g.missense_count || 0),
                        synonymous: acc.synonymous + (g.synonymous_count || 0),
                      }),
                      { total: 0, lof: 0, missense: 0, synonymous: 0 }
                    );

                    return (
                      <tr
                        key={peakId}
                        className={isSelected ? 'manhattan-row-selected' : ''}
                      >
                        <td style={{ width: 32, textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={hasLabel}
                            onChange={() => togglePeak(peakId)}
                            title={hasLabel ? 'Remove label' : 'Add label'}
                            style={{ cursor: 'pointer' }}
                          />
                        </td>
                        <td
                          onClick={() => onContigClick?.(peak.contig)}
                          style={{ cursor: 'pointer' }}
                        >
                          {peak.contig}:{peak.position.toLocaleString()}
                        </td>
                        <td>
                          {/* Genes with burden hits shown first */}
                          {genesWithBurden.map(({ gene: g, hits }, i) => {
                            // Show top 2 hits for this gene
                            const topHits = hits.slice(0, 2);
                            return (
                              <div key={g.gene_id} style={{ marginBottom: i < genesWithBurden.length - 1 ? 4 : 0 }}>
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
                                        <span style={{ color: colors.dot }}>●</span> {formatAnn(hit.annotation)} ({hit.test})
                                      </span>
                                    );
                                  })}
                                  {hits.length > 2 && (
                                    <span style={{ fontSize: 10, color: '#888', marginLeft: 4 }}>
                                      +{hits.length - 2}
                                    </span>
                                  )}
                                </span>
                              </div>
                            );
                          })}
                          {/* Other genes on same line */}
                          {genesWithoutBurden.length > 0 && (
                            <div style={{ color: '#666', fontSize: 11 }}>
                              {genesWithoutBurden.slice(0, 4).map((g) => g.gene_symbol).join(', ')}
                              {genesWithoutBurden.length > 4 && ` +${genesWithoutBurden.length - 4} more`}
                            </div>
                          )}
                          {peak.genes.length === 0 && '—'}
                        </td>
                        <td>{peak.pvalue.toExponential(2)}</td>
                        <td style={{ fontSize: 11 }}>
                          {/* Show per-gene LoF/missense variant counts only */}
                          {peak.genes
                            .filter((g) => (g.lof_count || 0) + (g.missense_count || 0) > 0)
                            .slice(0, 3)
                            .map((g) => (
                              <div key={g.gene_id} style={{ whiteSpace: 'nowrap' }}>
                                <span style={{ color: '#666' }}>{g.gene_symbol}:</span>{' '}
                                {g.lof_count ? (
                                  <span style={{ color: '#d32f2f', fontWeight: 500 }}>{g.lof_count} LoF</span>
                                ) : null}
                                {g.lof_count && g.missense_count ? ', ' : null}
                                {g.missense_count ? (
                                  <span style={{ color: '#f57f17', fontWeight: 500 }}>{g.missense_count} mis</span>
                                ) : null}
                              </div>
                            ))}
                          {peak.genes.filter((g) => (g.lof_count || 0) + (g.missense_count || 0) > 0).length > 3 && (
                            <div style={{ color: '#999', fontSize: 10 }}>
                              +{peak.genes.filter((g) => (g.lof_count || 0) + (g.missense_count || 0) > 0).length - 3} more
                            </div>
                          )}
                          {peak.genes.every((g) => !(g.lof_count || 0) && !(g.missense_count || 0)) && (
                            <span style={{ color: '#999' }}>—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredPeaks.length > visibleRowCount && (
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
                  Show more ({filteredPeaks.length - visibleRowCount} remaining)
                </button>
              )}
            </>
          ) : displayHits[0]?.hit_type === 'gene' ? (
            // Gene table (per-chromosome view)
            <table className="manhattan-table manhattan-table-gene">
              <thead>
                <tr>
                  <th>Gene</th>
                  <th>P SKAT-O</th>
                  <th>P Burden</th>
                  <th>P SKAT</th>
                  <th>Beta</th>
                </tr>
              </thead>
              <tbody>
                {displayHits.map((hit) => (
                  <tr
                    key={hit.id}
                    className={hoveredHit?.id === hit.id ? 'manhattan-row-hovered' : ''}
                    onClick={() => onHitClick?.(hit)}
                    style={{ cursor: onHitClick ? 'pointer' : 'default' }}
                  >
                    <td title={hit.id}>{hit.label}</td>
                    <td>{hit.pvalue.toExponential(2)}</td>
                    <td>{hit.pvalue_burden?.toExponential(2) ?? '—'}</td>
                    <td>{hit.pvalue_skat?.toExponential(2) ?? '—'}</td>
                    <td>{hit.beta?.toFixed(3) ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            // Variant table
            <table className="manhattan-table">
              <thead>
                <tr>
                  <th>Variant</th>
                  <th>Gene</th>
                  <th>CSQ</th>
                  <th>HGVS</th>
                  <th>P-value</th>
                  <th>Beta</th>
                  <th>AC</th>
                </tr>
              </thead>
              <tbody>
                {displayHits.map((hit) => (
                  <tr
                    key={hit.id}
                    className={hoveredHit?.id === hit.id ? 'manhattan-row-hovered' : ''}
                    onClick={() => onHitClick?.(hit)}
                    style={{ cursor: onHitClick ? 'pointer' : 'default' }}
                  >
                    <td title={hit.id}>{hit.label}</td>
                    <td>{hit.gene_symbol || '—'}</td>
                    <td>{hit.consequence?.replace(/_/g, ' ') || '—'}</td>
                    <td title={hit.hgvsp || hit.hgvsc}>{(hit.hgvsp || hit.hgvsc)?.split(':')[1] || '—'}</td>
                    <td>{hit.pvalue.toExponential(2)}</td>
                    <td>{hit.beta?.toFixed(3) ?? '—'}</td>
                    <td>{hit.ac?.toLocaleString() || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Loading state */}
      {!imageLoaded && !imageError && (
        <div className="manhattan-loading">Loading Manhattan plot...</div>
      )}
    </div>
  );
};
