import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { useHitDetection } from './hooks/useHitDetection';
import { usePeakLabelLayout, PeakLabelNode } from './hooks/usePeakLabelLayout';
import { Tooltip } from './components/Tooltip';
import { PeakTooltip } from './components/PeakTooltip';
import { YAxis } from './components/YAxis';
import { PeakLabels } from './components/PeakLabels';
import { computeDisplayHits, getChromosomeLayout } from './layout';
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
  const [cursor, setCursor] = useState({ x: 0, y: 0 });
  const [peakCursor, setPeakCursor] = useState({ x: 0, y: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Compute display coordinates from raw hits
  const displayHits = useMemo(
    () => computeDisplayHits(overlay.significant_hits, contig),
    [overlay.significant_hits, contig]
  );

  // Compute peak label positions and required label area height
  const { nodes: peakLabelNodes, labelAreaHeight } = usePeakLabelLayout(
    overlay.peaks,
    dimensions.width,
    dimensions.height,
    contig
  );

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

          {imageLoaded && dimensions.width > 0 && displayHits.length > 0 && (
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
              {/* Render all significant hit markers */}
              {displayHits.map((hit) => {
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

      {/* Hit table - adapts columns based on hit type */}
      {imageLoaded && displayHits.length > 0 && (
        <div className="manhattan-table-container" style={{ marginLeft: showYAxis ? Y_AXIS_WIDTH : 0 }}>
          {displayHits[0]?.hit_type === 'gene' ? (
            // Gene table
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
