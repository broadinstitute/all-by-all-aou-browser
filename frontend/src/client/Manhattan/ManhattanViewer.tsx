import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { useHitDetection } from './hooks/useHitDetection';
import { usePeakLabelLayout, PeakLabelNode } from './hooks/usePeakLabelLayout';
import { Tooltip } from './components/Tooltip';
import { PeakTooltip } from './components/PeakTooltip';
import { YAxis } from './components/YAxis';
import { PeakLabels } from './components/PeakLabels';
import { ChromosomeLabels } from './components/ChromosomeLabels';
import { LocusContextMenu } from './components/LocusContextMenu';
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
  /** Callback when a locus is clicked (for split-screen navigation) */
  onLocusClick?: (contig: string, position: number) => void;
  /** Callback when a gene symbol is clicked */
  onGeneClick?: (geneId: string) => void;
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
  onLocusClick,
  onGeneClick,
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
  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    contig: string;
    position: number;
  } | null>(null);

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
  // Filter by current chromosome when zoomed in
  const sortedPeaks = useMemo(() => {
    if (!overlay.peaks) return [];
    let peaks = [...overlay.peaks];
    // Filter to current chromosome when zoomed in
    if (contig !== 'all') {
      const chromName = contig.startsWith('chr') ? contig : `chr${contig}`;
      peaks = peaks.filter((p) => {
        const peakChrom = p.contig.startsWith('chr') ? p.contig : `chr${p.contig}`;
        return peakChrom === chromName;
      });
    }
    return peaks.sort((a, b) => a.pvalue - b.pvalue);
  }, [overlay.peaks, contig]);

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
                onPeakContextMenu={(node, clientX, clientY) => {
                  setContextMenu({
                    x: clientX,
                    y: clientY,
                    contig: node.peak.contig,
                    position: node.peak.position,
                  });
                }}
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

      {/* Chromosome labels */}
      {imageLoaded && dimensions.width > 0 && (
        <div style={{ marginLeft: showYAxis ? Y_AXIS_WIDTH : 0 }}>
          <ChromosomeLabels width={dimensions.width} contig={contig} />
        </div>
      )}

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
      {imageLoaded && (displayHits.length > 0 || filteredPeaks.length > 0) && (
        <div className="manhattan-table-container" style={{ marginLeft: showYAxis ? Y_AXIS_WIDTH : 0 }}>
          {filteredPeaks.length > 0 ? (
            // Locus Navigator Table (works in both genome-wide and per-chromosome views)
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
                  </tr>
                </thead>
                <tbody>
                  {filteredPeaks.slice(0, visibleRowCount).map((peak, index) => {
                    const peakId = `${peak.contig}-${peak.position}`;
                    const isSelected = selectedPeakIds.has(peakId);
                    const hasLabel = customLabelMode ? isSelected : index < 25;

                    // Significance threshold for burden tests
                    const SIG_THRESHOLD = 2.5e-6;

                    // Get burden annotation types for a gene
                    const getGeneBurdenTypes = (g: typeof peak.genes[0]): string[] => {
                      if (!g.burden_results) return [];
                      const types = new Set<string>();
                      for (const b of g.burden_results) {
                        const hasSig =
                          (b.pvalue && b.pvalue < SIG_THRESHOLD) ||
                          (b.pvalue_burden && b.pvalue_burden < SIG_THRESHOLD) ||
                          (b.pvalue_skat && b.pvalue_skat < SIG_THRESHOLD);
                        if (hasSig) types.add(b.annotation);
                      }
                      return Array.from(types);
                    };

                    // Check if gene has evidence (burden or coding)
                    const geneHasEvidence = (g: typeof peak.genes[0]): boolean => {
                      const hasBurden = getGeneBurdenTypes(g).length > 0;
                      const hasCoding = (g.lof_count || 0) > 0 || (g.missense_count || 0) > 0;
                      return hasBurden || hasCoding;
                    };

                    // Partition genes
                    const implicatedGenes = peak.genes.filter(geneHasEvidence);
                    const nonImplicatedGenes = peak.genes.filter((g) => !geneHasEvidence(g));

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
                          onClick={() => onLocusClick?.(peak.contig, peak.position)}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            setContextMenu({
                              x: e.clientX,
                              y: e.clientY,
                              contig: peak.contig,
                              position: peak.position,
                            });
                          }}
                          style={{ cursor: 'pointer' }}
                          title="Click to view locus, right-click for options"
                        >
                          {peak.contig}:{peak.position.toLocaleString()}
                        </td>
                        <td>
                          {/* Implicated genes shown first - ALL of them */}
                          {implicatedGenes.map((g) => {
                            const burdenTypes = getGeneBurdenTypes(g);
                            const lof = g.lof_count || 0;
                            const mis = g.missense_count || 0;
                            const hasCoding = lof > 0 || mis > 0;

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
                                {/* Burden dots */}
                                {burdenTypes.includes('pLoF') && (
                                  <span style={{ color: '#d32f2f', marginLeft: 2 }} title="pLoF burden">●</span>
                                )}
                                {burdenTypes.includes('missenseLC') && (
                                  <span style={{ color: '#f9a825', marginLeft: 1 }} title="Missense burden">●</span>
                                )}
                                {burdenTypes.includes('synonymous') && (
                                  <span style={{ color: '#388e3c', marginLeft: 1 }} title="Synonymous burden">●</span>
                                )}
                                {/* Coding counts - AoU dark blue */}
                                {hasCoding && (
                                  <span style={{ fontSize: 10, marginLeft: 2, color: '#262262', fontWeight: 500 }}>
                                    {lof > 0 && <span>({lof}LOF)</span>}
                                    {mis > 0 && <span style={{ marginLeft: lof > 0 ? 2 : 0 }}>({mis}MIS)</span>}
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
                          {peak.genes.length === 0 && '—'}
                        </td>
                        <td>{peak.pvalue.toExponential(2)}</td>
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
