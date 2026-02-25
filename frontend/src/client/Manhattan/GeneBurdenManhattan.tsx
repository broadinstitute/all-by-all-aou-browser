import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery } from '@axaou/ui';
import { useRecoilValue } from 'recoil';
import { usePeakLabelLayout, PeakLabelNode } from './hooks/usePeakLabelLayout';
import { PeakLabels } from './components/PeakLabels';
import { PeakTooltip } from './components/PeakTooltip';
import { YAxis } from './components/YAxis';
import { ChromosomeLabels } from './components/ChromosomeLabels';
import type { Peak } from './types';
import { axaouDevUrl, pouchDbName, cacheEnabled } from '../Query';
import { ancestryGroupAtom } from '../sharedState';
import './OverviewManhattan.css';

const Y_AXIS_WIDTH = 50;

export interface GeneAssociationResult {
  gene_id: string;
  gene_symbol: string;
  chrom: string | null;
  pos: number | null;
  pvalue: number | null;
  pvalue_burden: number | null;
  pvalue_skat: number | null;
  beta_burden: number | null;
}

export interface GeneBurdenManhattanProps {
  analysisId: string;
  /** Gene data from the parent (already fetched) */
  geneData: GeneAssociationResult[];
  /** IDs of genes to label (when in custom selection mode) */
  selectedGeneIds?: Set<string>;
  /** Whether in custom label mode (true) or default top-25 mode (false) */
  customLabelMode?: boolean;
  /** Callback when a gene label is clicked */
  onGeneClick?: (geneId: string) => void;
}

interface ManhattanApiResponse {
  image_url: string;
  peaks?: Array<{
    contig: string;
    position: number;
    pvalue: number;
    genes: Array<{
      gene_symbol: string;
      gene_id: string;
      distance_kb: number;
      coding_variant_count: number;
    }>;
  }>;
}

/**
 * Convert gene association results to Peak format for the label layout hook.
 */
function genesToPeaks(genes: GeneAssociationResult[]): Peak[] {
  return genes
    .filter((g) => g.chrom && g.pos && g.pvalue != null)
    .map((g) => ({
      contig: g.chrom!,
      position: g.pos!,
      pvalue: g.pvalue!,
      genes: [
        {
          gene_symbol: g.gene_symbol,
          gene_id: g.gene_id,
          distance_kb: 0,
          coding_variant_count: 0,
        },
      ],
    }));
}

/**
 * Gene Burden Manhattan Plot Component.
 *
 * Displays the gene_manhattan.png image with interactive gene labels overlay.
 * Includes Y-axis and chromosome labels matching OverviewManhattan layout.
 */
export const GeneBurdenManhattan: React.FC<GeneBurdenManhattanProps> = ({
  analysisId,
  geneData,
  selectedGeneIds,
  customLabelMode = false,
  onGeneClick,
}) => {
  const ancestryGroup = useRecoilValue(ancestryGroupAtom);
  const imageRef = useRef<HTMLImageElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [hoveredPeakNode, setHoveredPeakNode] = useState<PeakLabelNode | null>(null);
  const [peakCursor, setPeakCursor] = useState({ x: 0, y: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  interface Data {
    manhattanData: ManhattanApiResponse | null;
  }

  const { queryStates, anyLoading } = useQuery<Data>({
    dbName: pouchDbName,
    queries: [
      {
        url: `${axaouDevUrl}/phenotype/${analysisId}/manhattan?ancestry=${ancestryGroup}&plot_type=gene_manhattan&contig=all`,
        name: 'manhattanData',
      },
    ],
    deps: [analysisId, ancestryGroup],
    cacheEnabled,
  });

  // Use peaks from the manhattan API response (contains significant genes)
  // Fall back to converting geneData if no peaks available
  const allPeaks = useMemo(() => {
    const apiPeaks = queryStates.manhattanData?.data?.peaks;
    if (apiPeaks && apiPeaks.length > 0) {
      // Use the pre-computed peaks from the manhattan overlay (significant genes)
      return apiPeaks as Peak[];
    }
    // Fallback: convert geneData (may not include significant genes)
    return genesToPeaks(geneData);
  }, [queryStates.manhattanData?.data?.peaks, geneData]);

  // Filter peaks for labeling based on selection mode
  const peaksForLabels = useMemo(() => {
    if (!customLabelMode || !selectedGeneIds || selectedGeneIds.size === 0) {
      return allPeaks;
    }
    return allPeaks.filter((p) => selectedGeneIds.has(p.genes[0]?.gene_id));
  }, [allPeaks, selectedGeneIds, customLabelMode]);

  // Compute peak label positions and required label area height
  const { nodes: peakLabelNodes, labelAreaHeight } = usePeakLabelLayout(
    peaksForLabels,
    dimensions.width,
    dimensions.height,
    'all',
    customLabelMode ? 500 : 25
  );

  // Observe image size changes
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

  const handlePeakHover = useCallback((node: PeakLabelNode | null, x?: number, y?: number) => {
    setHoveredPeakNode(node);
    if (x !== undefined && y !== undefined) {
      setPeakCursor({ x, y });
    }
  }, []);

  const handlePeakClick = useCallback(
    (node: PeakLabelNode) => {
      const geneId = node.peak.genes[0]?.gene_id;
      if (geneId && onGeneClick) {
        onGeneClick(geneId);
      }
    },
    [onGeneClick]
  );

  const handleImageLoad = useCallback(() => {
    setImageLoaded(true);
    setImageError(false);
  }, []);

  const handleImageError = useCallback(() => {
    setImageError(true);
  }, []);

  // Show loading state
  if (anyLoading()) {
    return (
      <div className="manhattan-container">
        <div className="manhattan-loading">Loading Manhattan plot...</div>
      </div>
    );
  }

  // Handle errors or missing data
  if (queryStates.manhattanData?.error || !queryStates.manhattanData?.data) {
    return (
      <div className="manhattan-container">
        <div
          style={{
            padding: '40px 20px',
            textAlign: 'center',
            background: '#f9f9f9',
            border: '1px solid #e0e0e0',
            borderRadius: '4px',
            color: '#666',
          }}
        >
          <p style={{ margin: 0 }}>Gene burden Manhattan plot not available</p>
          <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#999' }}>
            (ClickHouse connection required for plot images)
          </p>
        </div>
      </div>
    );
  }

  const data = queryStates.manhattanData.data;

  // Construct full image URL
  const imageUrl = data.image_url.startsWith('/')
    ? `${axaouDevUrl.replace('/api', '')}${data.image_url}`
    : data.image_url;

  const hasPeaks = peakLabelNodes.length > 0;

  return (
    <div className="manhattan-container">
      <div className="manhattan-plot-row" style={{ display: 'flex' }}>
        {/* Y-Axis */}
        {imageLoaded && (
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
          {hasPeaks && imageLoaded && <div style={{ height: labelAreaHeight }} />}

          {/* Manhattan plot image */}
          <img
            ref={imageRef}
            src={imageUrl}
            alt="Gene Burden Manhattan Plot"
            className="manhattan-image"
            onLoad={handleImageLoad}
            onError={handleImageError}
            draggable={false}
            style={{ width: '100%', display: 'block' }}
          />

          {/* Peak labels SVG overlay */}
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
                hoveredHitPosition={null}
                onPeakHover={handlePeakHover}
                onPeakClick={handlePeakClick}
              />
            </svg>
          )}

          {/* Tooltip */}
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
        <div style={{ marginLeft: Y_AXIS_WIDTH }}>
          <ChromosomeLabels width={dimensions.width} contig="all" />
        </div>
      )}

      {/* Stats bar */}
      {imageLoaded && (
        <div className="manhattan-stats" style={{ marginLeft: Y_AXIS_WIDTH }}>
          <div className="manhattan-stats-item">
            <span className="manhattan-stats-label">Genes:</span>
            <span className="manhattan-stats-value">{geneData.length.toLocaleString()}</span>
          </div>
          <div className="manhattan-stats-item">
            <span className="manhattan-stats-label">Threshold:</span>
            <span className="manhattan-stats-value">P &lt; 2.5e-6</span>
          </div>
        </div>
      )}

      {/* Loading state for image */}
      {!imageLoaded && !imageError && (
        <div className="manhattan-loading">Loading Manhattan plot...</div>
      )}

      {imageError && (
        <div className="manhattan-error">Failed to load Manhattan plot image</div>
      )}
    </div>
  );
};

export default GeneBurdenManhattan;
