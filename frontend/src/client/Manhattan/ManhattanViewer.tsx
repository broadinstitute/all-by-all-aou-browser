import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { useHitDetection } from './hooks/useHitDetection';
import { Tooltip } from './components/Tooltip';
import { YAxis } from './components/YAxis';
import { computeDisplayHits } from './layout';
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
  onHitHover,
  showYAxis = true,
  showStats = true,
  minWidth = 800,
  className,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageWrapperRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [hoveredHit, setHoveredHit] = useState<DisplayHit | null>(null);
  const [cursor, setCursor] = useState({ x: 0, y: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Compute display coordinates from raw hits
  const displayHits = useMemo(
    () => computeDisplayHits(overlay.significant_hits),
    [overlay.significant_hits]
  );

  // Use spatial indexing for efficient hit detection
  const { findHit } = useHitDetection(
    displayHits,
    dimensions.width,
    dimensions.height
  );

  // Observe image wrapper size changes for responsive scaling
  useEffect(() => {
    const imageWrapper = imageWrapperRef.current;
    if (!imageWrapper) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const { width, height } = entry.contentRect;
        setDimensions({ width, height });
      }
    });

    observer.observe(imageWrapper);
    return () => observer.disconnect();
  }, []);

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

  const handleClick = useCallback(() => {
    if (hoveredHit && onHitClick) {
      onHitClick(hoveredHit);
    }
  }, [hoveredHit, onHitClick]);

  const handleImageLoad = useCallback(() => {
    setImageLoaded(true);
    setImageError(false);
  }, []);

  const handleImageError = useCallback(() => {
    setImageError(true);
    setImageLoaded(false);
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

  return (
    <div
      ref={containerRef}
      className={`manhattan-container ${className || ''}`}
      style={containerStyle}
    >
      <div className="manhattan-plot-row" style={{ display: 'flex' }}>
        {/* Y-Axis */}
        {showYAxis && imageLoaded && (
          <div style={{ width: Y_AXIS_WIDTH, flexShrink: 0, position: 'relative' }}>
            <YAxis height={dimensions.height} width={Y_AXIS_WIDTH} />
          </div>
        )}

        <div ref={imageWrapperRef} className="manhattan-image-wrapper" style={{ flex: 1 }}>
          <img
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
              viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
              preserveAspectRatio="none"
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              onClick={handleClick}
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

          {/* Tooltip */}
          {hoveredHit && imageLoaded && (
            <Tooltip
              hit={hoveredHit}
              x={cursor.x}
              y={cursor.y}
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
            <table className="manhattan-table">
              <thead>
                <tr>
                  <th>Gene</th>
                  <th>Gene ID</th>
                  <th>Position</th>
                  <th>P-value</th>
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
                    <td>{hit.label}</td>
                    <td title={hit.id}>{hit.id}</td>
                    <td>{hit.contig}:{hit.position.toLocaleString()}</td>
                    <td>{hit.pvalue.toExponential(2)}</td>
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
