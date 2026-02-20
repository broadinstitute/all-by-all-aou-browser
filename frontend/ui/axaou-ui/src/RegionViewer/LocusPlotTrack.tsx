import React, { useContext, useState, useCallback, useMemo, useRef, useEffect } from "react";
import styled from "styled-components";
import { scaleLinear } from "d3-scale";
import { RegionViewerContext } from "./RegionViewer";

// =============================================================================
// Types
// =============================================================================

/** Y-axis configuration for coordinate mapping */
export interface YAxisConfig {
  /** Threshold where scale switches from linear to log (-log10(p) value) */
  log_threshold: number;
  /** Fraction of plot height for the linear portion (0-1) */
  linear_fraction: number;
  /** Maximum -log10(p) value for scaling the log portion */
  max_neg_log_p: number;
}

/** Image dimensions */
export interface ImageDimensions {
  width: number;
  height: number;
}

/** Sidecar metadata for locus plot coordinate mapping */
export interface LocusPlotSidecar {
  /** Original image dimensions */
  image: ImageDimensions;
  /** Y-axis configuration for coordinate calculation */
  y_axis: YAxisConfig;
  /** Significance threshold marker */
  threshold: { pvalue: number; y_px: number };
}

/** Significant variant for overlay rendering */
export interface SignificantHit {
  /** Unique identifier (variant_id) */
  id: string;
  /** Genomic position */
  position: number;
  /** Chromosome */
  contig: string;
  /** P-value */
  pvalue: number;
  /** Gene symbol (optional) */
  gene_symbol?: string;
  /** VEP consequence (optional) */
  consequence?: string;
  /** Allele count (optional) */
  ac?: number;
  /** Allele frequency (optional) */
  af?: number;
  /** Effect size (optional) */
  beta?: number;
  /** HGVS protein notation (optional) */
  hgvsp?: string;
  /** HGVS coding notation (optional) */
  hgvsc?: string;
}

// =============================================================================
// Styled Components
// =============================================================================

const PlotContainer = styled.div<{ height: number }>`
  position: relative;
  width: 100%;
  height: ${(props) => props.height}px;
  overflow: hidden;
`;

const PlotImage = styled.img<{ width: number; height: number }>`
  display: block;
  width: ${(props) => props.width}px;
  height: ${(props) => props.height}px;
  object-fit: fill;
`;

const OverlaySvg = styled.svg`
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: all;
  cursor: crosshair;
`;

const Tooltip = styled.div<{ x: number; y: number; visible: boolean }>`
  position: absolute;
  left: ${(props) => props.x}px;
  top: ${(props) => props.y}px;
  background: rgba(0, 0, 0, 0.85);
  color: white;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 12px;
  white-space: nowrap;
  pointer-events: none;
  z-index: 1000;
  visibility: ${(props) => (props.visible ? "visible" : "hidden")};
  transform: translate(-50%, -100%);
  margin-top: -8px;
`;

const LoadingOverlay = styled.div<{ width: number; height: number }>`
  position: absolute;
  top: 0;
  left: 0;
  width: ${(props) => props.width}px;
  height: ${(props) => props.height}px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.8);
  color: #666;
  font-size: 14px;
`;

// =============================================================================
// Y-Axis Coordinate Calculation
// =============================================================================

/**
 * Compute Y position (in pixels from top) for a given p-value.
 * Uses hybrid linear-log scale matching hail-decoder.
 *
 * @param pvalue - The p-value
 * @param yAxis - Y-axis configuration from sidecar
 * @param height - Plot height in pixels
 * @returns Y position in pixels from top (0 = top, height = bottom)
 */
function computeY(
  pvalue: number,
  yAxis: YAxisConfig,
  height: number
): number {
  if (pvalue <= 0 || pvalue > 1) {
    return height; // Invalid p-value goes to bottom
  }

  const negLogP = -Math.log10(pvalue);
  const linearHeight = height * yAxis.linear_fraction;
  const logHeight = height * (1 - yAxis.linear_fraction);

  if (negLogP <= yAxis.log_threshold) {
    // Linear portion: [0, log_threshold] maps to [height, height - linearHeight]
    const normalized = negLogP / yAxis.log_threshold;
    return height - normalized * linearHeight;
  } else {
    // Log portion: [log_threshold, max] maps to [height - linearHeight, 0]
    const logVal = Math.log(negLogP / yAxis.log_threshold);
    const logMax = Math.log(yAxis.max_neg_log_p / yAxis.log_threshold);
    const normalized = Math.min(logVal / logMax, 1.0);
    return Math.max((height - linearHeight) - normalized * logHeight, 0);
  }
}

// =============================================================================
// Component Props
// =============================================================================

export interface LocusPlotTrackProps {
  /** URL to the pre-rendered PNG image */
  imageUrl: string;
  /** Sidecar metadata for coordinate mapping */
  sidecar: LocusPlotSidecar;
  /** Locus start position (genomic coordinate) */
  locusStart: number;
  /** Locus stop position (genomic coordinate) */
  locusStop: number;
  /** Significant variants to overlay on the plot */
  variants?: SignificantHit[];
  /** Plot height in pixels */
  height?: number;
  /** Callback when hovering over a variant (null = hover out) */
  onHoverVariant?: (variant: SignificantHit | null) => void;
  /** Callback when clicking a variant */
  onClickVariant?: (variant: SignificantHit) => void;
  /** Show significance threshold line */
  showThreshold?: boolean;
  /** Custom circle radius for variant markers */
  markerRadius?: number;
  /** Custom hover circle radius */
  hoverRadius?: number;
}

// =============================================================================
// Main Component
// =============================================================================

/**
 * LocusPlotTrack - Renders a pre-rendered locus PNG with interactive SVG overlay.
 *
 * Uses RegionViewerContext for X-axis coordinate mapping and sidecar metadata
 * for Y-axis positioning. Provides hover/click interactions for significant variants.
 */
export const LocusPlotTrack: React.FC<LocusPlotTrackProps> = ({
  imageUrl,
  sidecar,
  locusStart,
  locusStop,
  variants = [],
  height = 400,
  onHoverVariant,
  onClickVariant,
  showThreshold = true,
  markerRadius = 3,
  hoverRadius = 5,
}) => {
  // Get coordinate context from RegionViewer
  const { scalePosition, centerPanelWidth } = useContext(RegionViewerContext);

  // State for hover interaction
  const [hoveredVariant, setHoveredVariant] = useState<SignificantHit | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Get the view region boundaries from scalePosition.invert
  // This tells us what genomic coordinates map to [0, centerPanelWidth]
  const viewStart = scalePosition.invert ? scalePosition.invert(0) : locusStart;
  const viewStop = scalePosition.invert ? scalePosition.invert(centerPanelWidth) : locusStop;

  // Create a linear scale that maps genomic positions to pixel X coordinates
  // This scale properly extrapolates for positions outside the view region
  const genomicToPixel = useMemo(() => {
    return scaleLinear()
      .domain([viewStart, viewStop])
      .range([0, centerPanelWidth]);
  }, [viewStart, viewStop, centerPanelWidth]);

  // Compute image positioning based on locus coordinates
  // The PNG represents the exact locus window [locusStart, locusStop]
  // Use genomicToPixel which properly extrapolates for out-of-view coordinates
  const imgLeft = genomicToPixel(locusStart);
  const imgRight = genomicToPixel(locusStop);
  const imgWidth = imgRight - imgLeft;

  // Map variants to display coordinates
  // Use genomicToPixel for consistent coordinate mapping with the PNG
  // Y coordinates must be computed using the original image height from sidecar,
  // then scaled to match the display height
  const originalImageHeight = sidecar.image.height;
  const yScaleFactor = height / originalImageHeight;

  const displayVariants = useMemo(() => {
    return variants.map((v) => {
      const x = genomicToPixel(v.position);
      // Compute Y in original PNG coordinate space, then scale to display height
      const yInOriginal = computeY(v.pvalue, sidecar.y_axis, originalImageHeight);
      const y = yInOriginal * yScaleFactor;
      return {
        ...v,
        displayX: x - imgLeft, // Relative to image left edge
        displayY: y,
      };
    }).filter((v) => {
      // Only include variants within the visible region
      return v.displayX >= 0 && v.displayX <= imgWidth;
    });
  }, [variants, sidecar, height, genomicToPixel, imgLeft, imgWidth, originalImageHeight, yScaleFactor]);

  // Handle mouse move for hit detection
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const svg = e.currentTarget;
      const rect = svg.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Find nearest variant within threshold
      let nearest: (SignificantHit & { displayX: number; displayY: number }) | null = null;
      let minDist = Infinity;
      const threshold = 10;

      for (const v of displayVariants) {
        const dist = Math.sqrt((v.displayX - x) ** 2 + (v.displayY - y) ** 2);
        if (dist < minDist && dist < threshold) {
          minDist = dist;
          nearest = v;
        }
      }

      if (nearest !== hoveredVariant) {
        setHoveredVariant(nearest);
        onHoverVariant?.(nearest);
        if (nearest) {
          setTooltipPosition({ x: nearest.displayX, y: nearest.displayY });
        }
      }
    },
    [displayVariants, hoveredVariant, onHoverVariant]
  );

  const handleMouseLeave = useCallback(() => {
    setHoveredVariant(null);
    onHoverVariant?.(null);
  }, [onHoverVariant]);

  const handleClick = useCallback(() => {
    if (hoveredVariant && onClickVariant) {
      onClickVariant(hoveredVariant);
    }
  }, [hoveredVariant, onClickVariant]);

  const handleImageLoad = useCallback(() => {
    setImageLoaded(true);
    setImageError(false);
  }, []);

  const handleImageError = useCallback(() => {
    setImageError(true);
    setImageLoaded(false);
  }, []);

  // Format tooltip content
  const formatTooltip = (v: SignificantHit): string => {
    const parts = [v.id];
    if (v.gene_symbol) parts.push(v.gene_symbol);
    if (v.pvalue) parts.push(`P=${v.pvalue.toExponential(2)}`);
    if (v.consequence) parts.push(v.consequence.replace(/_/g, " "));
    return parts.join(" | ");
  };

  // Don't render if image URL is empty
  if (!imageUrl) {
    return null;
  }

  return (
    <PlotContainer ref={containerRef} height={height}>
      {/* PNG image background */}
      <PlotImage
        src={imageUrl}
        width={imgWidth}
        height={height}
        alt="Locus plot"
        onLoad={handleImageLoad}
        onError={handleImageError}
        style={{
          marginLeft: imgLeft,
        }}
        draggable={false}
      />

      {/* Loading state */}
      {!imageLoaded && !imageError && (
        <LoadingOverlay width={imgWidth} height={height}>
          Loading locus plot...
        </LoadingOverlay>
      )}

      {/* Error state */}
      {imageError && (
        <LoadingOverlay width={imgWidth} height={height}>
          Failed to load plot
        </LoadingOverlay>
      )}

      {/* Interactive SVG overlay */}
      {imageLoaded && (
        <OverlaySvg
          width={imgWidth}
          height={height}
          style={{ left: imgLeft }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onClick={handleClick}
        >
          {/* Render variant markers */}
          {displayVariants.map((v) => {
            const isHovered = hoveredVariant?.id === v.id;
            return (
              <circle
                key={v.id}
                cx={v.displayX}
                cy={v.displayY}
                r={isHovered ? hoverRadius : markerRadius}
                fill={isHovered ? "#ff6b6b" : "rgba(220, 53, 69, 0.6)"}
                stroke={isHovered ? "#c92a2a" : "none"}
                strokeWidth={isHovered ? 2 : 0}
                style={{ cursor: "pointer" }}
              />
            );
          })}
        </OverlaySvg>
      )}

      {/* Tooltip */}
      {hoveredVariant && imageLoaded && (
        <Tooltip
          x={tooltipPosition.x + imgLeft}
          y={tooltipPosition.y}
          visible={true}
        >
          {formatTooltip(hoveredVariant)}
        </Tooltip>
      )}
    </PlotContainer>
  );
};

export default LocusPlotTrack;
