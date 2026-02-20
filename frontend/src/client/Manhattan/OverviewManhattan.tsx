import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { usePeakLabelLayout, PeakLabelNode } from './hooks/usePeakLabelLayout';
import { PeakLabels } from './components/PeakLabels';
import { PeakTooltip } from './components/PeakTooltip';
import { YAxis } from './components/YAxis';
import { getChromosomeLayout } from './layout';
import type { UnifiedLocus, Peak, BurdenResult } from './types';
import './OverviewManhattan.css';

const Y_AXIS_WIDTH = 50;

export interface OverviewManhattanProps {
  /** URL to the genome Manhattan plot image */
  genomeImageUrl: string;
  /** URL to the exome Manhattan plot image */
  exomeImageUrl: string;
  /** Unified loci from the overview API */
  unifiedLoci: UnifiedLocus[];
  /** IDs of peaks to label (when in custom selection mode) */
  selectedPeakIds?: Set<string>;
  /** Whether in custom label mode (true) or default top-25 mode (false) */
  customLabelMode?: boolean;
  /** Callback when a peak label is clicked */
  onPeakClick?: (node: PeakLabelNode) => void;
  /** Show Y-axis with -log10(p) labels */
  showYAxis?: boolean;
}

/**
 * Convert unified loci to Peak format for usePeakLabelLayout hook.
 * Uses the best p-value (min of genome and exome) for each locus.
 */
function unifiedLociToPeaks(loci: UnifiedLocus[]): Peak[] {
  return loci.map((locus) => {
    // Use best (lowest) p-value between genome and exome
    const pvalue = Math.min(
      locus.pvalue_genome ?? Infinity,
      locus.pvalue_exome ?? Infinity
    );

    // Convert unified genes to GeneInLocus format
    const genes = locus.genes.map((g) => ({
      gene_symbol: g.gene_symbol,
      gene_id: g.gene_id,
      distance_kb: g.distance_kb,
      coding_variant_count:
        (g.genome_coding_hits?.lof ?? 0) +
        (g.genome_coding_hits?.missense ?? 0) +
        (g.exome_coding_hits?.lof ?? 0) +
        (g.exome_coding_hits?.missense ?? 0),
      lof_count:
        (g.genome_coding_hits?.lof ?? 0) + (g.exome_coding_hits?.lof ?? 0) || undefined,
      missense_count:
        (g.genome_coding_hits?.missense ?? 0) + (g.exome_coding_hits?.missense ?? 0) || undefined,
      burden_results: g.burden_results,
    }));

    return {
      contig: locus.contig,
      position: locus.position,
      pvalue: pvalue === Infinity ? 1 : pvalue,
      genes,
    };
  });
}

/**
 * Overview Manhattan Plot Component.
 *
 * Composites genome and exome Manhattan plots using CSS overlay.
 * Uses CSS filter to color-shift the exome plot for visual distinction.
 */
export const OverviewManhattan: React.FC<OverviewManhattanProps> = ({
  genomeImageUrl,
  exomeImageUrl,
  unifiedLoci,
  selectedPeakIds,
  customLabelMode = false,
  onPeakClick,
  showYAxis = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [hoveredPeakNode, setHoveredPeakNode] = useState<PeakLabelNode | null>(null);
  const [peakCursor, setPeakCursor] = useState({ x: 0, y: 0 });
  const [genomeLoaded, setGenomeLoaded] = useState(false);
  const [exomeLoaded, setExomeLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Convert unified loci to peaks format for label layout
  const peaks = useMemo(() => unifiedLociToPeaks(unifiedLoci), [unifiedLoci]);

  // Filter peaks for labeling: if in custom mode, show only selected peaks
  const peaksForLabels = useMemo(() => {
    if (!customLabelMode || !selectedPeakIds) return peaks;
    return peaks.filter((p) => selectedPeakIds.has(`${p.contig}-${p.position}`));
  }, [peaks, selectedPeakIds, customLabelMode]);

  // Compute peak label positions and required label area height
  const { nodes: peakLabelNodes, labelAreaHeight } = usePeakLabelLayout(
    peaksForLabels,
    dimensions.width,
    dimensions.height,
    'all',
    customLabelMode ? 500 : 25
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
  }, [genomeLoaded]);

  const handlePeakHover = useCallback((node: PeakLabelNode | null, x?: number, y?: number) => {
    setHoveredPeakNode(node);
    if (x !== undefined && y !== undefined) {
      setPeakCursor({ x, y });
    }
  }, []);

  const handleGenomeLoad = useCallback(() => {
    setGenomeLoaded(true);
    setImageError(false);
  }, []);

  const handleExomeLoad = useCallback(() => {
    setExomeLoaded(true);
  }, []);

  const handleImageError = useCallback(() => {
    setImageError(true);
  }, []);

  if (imageError) {
    return (
      <div className="manhattan-container">
        <div className="manhattan-error">Failed to load Manhattan plot images</div>
      </div>
    );
  }

  const hasPeaks = peakLabelNodes.length > 0;
  const imagesLoaded = genomeLoaded && exomeLoaded;

  return (
    <div ref={containerRef} className="manhattan-container">
      <div className="manhattan-plot-row" style={{ display: 'flex' }}>
        {/* Y-Axis */}
        {showYAxis && imagesLoaded && (
          <div
            style={{
              width: Y_AXIS_WIDTH,
              flexShrink: 0,
              position: 'relative',
              marginTop: labelAreaHeight,
            }}
          >
            <YAxis height={dimensions.height} width={Y_AXIS_WIDTH} />
          </div>
        )}

        <div
          className="manhattan-image-wrapper"
          style={{ flex: 1, position: 'relative' }}
        >
          {/* Spacer for label area */}
          {hasPeaks && <div style={{ height: labelAreaHeight }} />}

          {/* Composite image wrapper */}
          <div className="overview-image-wrapper">
            {/* Base image: Genome Manhattan */}
            <img
              ref={imageRef}
              src={genomeImageUrl}
              alt="Genome Manhattan Plot"
              className="overview-image-base manhattan-image"
              onLoad={handleGenomeLoad}
              onError={handleImageError}
              draggable={false}
            />

            {/* Overlay image: Exome Manhattan with CSS filter */}
            <img
              src={exomeImageUrl}
              alt="Exome Manhattan Plot"
              className="overview-image-overlay"
              onLoad={handleExomeLoad}
              onError={handleImageError}
              draggable={false}
            />
          </div>

          {/* Peak labels SVG - spans label area and plot */}
          {imagesLoaded && dimensions.width > 0 && hasPeaks && (
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
                hoveredHitPosition={null}
                onPeakHover={handlePeakHover}
                onPeakClick={onPeakClick}
              />
            </svg>
          )}

          {/* Peak Tooltip */}
          {hoveredPeakNode && imagesLoaded && (
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
      {imagesLoaded && (
        <div className="overview-stats" style={{ marginLeft: showYAxis ? Y_AXIS_WIDTH : 0 }}>
          <div className="overview-stats-item">
            <span className="overview-stats-label">Combined loci:</span>
            <span className="overview-stats-value">{unifiedLoci.length.toLocaleString()}</span>
          </div>
          <div className="overview-stats-item">
            <span className="overview-stats-label">Threshold:</span>
            <span className="overview-stats-value">P &lt; 5e-8</span>
          </div>
        </div>
      )}

      {/* Loading state */}
      {!imagesLoaded && !imageError && (
        <div className="manhattan-loading">Loading Manhattan plots...</div>
      )}
    </div>
  );
};

export default OverviewManhattan;
