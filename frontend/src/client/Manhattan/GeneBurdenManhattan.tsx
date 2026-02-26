import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { YAxis } from './components/YAxis';
import { ChromosomeLabels } from './components/ChromosomeLabels';
import { getChromosomeLayout, getYScale } from './layout';
import './OverviewManhattan.css';

const Y_AXIS_WIDTH = 50;
const PLOT_HEIGHT = 400; // Fixed plot height
const SIG_THRESHOLD = 2.5e-6; // Gene burden significance threshold

export interface GeneAssociationResult {
  gene_id: string;
  gene_symbol: string;
  contig: string;
  gene_start_position: number;
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

interface PlottedGene {
  gene: GeneAssociationResult;
  x: number;
  y: number;
}

/**
 * Gene Burden Manhattan Plot Component.
 *
 * Renders gene burden association data as an interactive canvas-based Manhattan plot
 * with direct gene labels next to points.
 */
export const GeneBurdenManhattan: React.FC<GeneBurdenManhattanProps> = ({
  analysisId,
  geneData,
  selectedGeneIds,
  customLabelMode = false,
  onGeneClick,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [dimensions, setDimensions] = useState({ width: 0, height: PLOT_HEIGHT });
  const [hoveredGene, setHoveredGene] = useState<GeneAssociationResult | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [plottedGenes, setPlottedGenes] = useState<PlottedGene[]>([]);

  // Determine which genes should be labeled
  const genesToLabel = useMemo(() => {
    if (customLabelMode && selectedGeneIds && selectedGeneIds.size > 0) {
      return selectedGeneIds;
    }
    // Default: top 25 by p-value
    const top25 = [...geneData]
      .filter((g) => g.pvalue != null)
      .sort((a, b) => (a.pvalue ?? Infinity) - (b.pvalue ?? Infinity))
      .slice(0, 25)
      .map((g) => g.gene_id);
    return new Set(top25);
  }, [geneData, selectedGeneIds, customLabelMode]);

  // Track container width for responsive canvas resizing
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry && entry.contentRect.width > 0) {
        setDimensions({ width: entry.contentRect.width, height: PLOT_HEIGHT });
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Draw points and labels on HTML5 Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || dimensions.width === 0 || geneData.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = dimensions.width * dpr;
    canvas.height = dimensions.height * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, dimensions.width, dimensions.height);

    const layout = getChromosomeLayout('all');
    const yScale = getYScale();

    // Standard AoU colors for Manhattan plot points
    const colors = ['#262262', '#71797E'];

    // First pass: draw all points and collect positions
    const plotted: PlottedGene[] = [];

    geneData.forEach((g) => {
      if (!g.contig || g.gene_start_position == null || g.pvalue == null) return;

      const xNorm = layout.getX(g.contig, g.gene_start_position);
      const yNorm = yScale.getY(g.pvalue);

      if (xNorm === null) return;

      const x = xNorm * dimensions.width;
      const y = yNorm * dimensions.height;

      let chrStr = g.contig.replace('chr', '');
      let chrNum = parseInt(chrStr, 10);
      if (isNaN(chrNum)) chrNum = chrStr === 'X' ? 23 : 24;

      ctx.fillStyle = colors[chrNum % 2];
      ctx.beginPath();
      ctx.arc(x, y, 2.5, 0, 2 * Math.PI);
      ctx.fill();

      plotted.push({ gene: g, x, y });
    });

    setPlottedGenes(plotted);

    // Second pass: draw labels for selected genes
    ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textBaseline = 'middle';

    // Collect label positions to avoid overlaps
    const labelPositions: Array<{ x: number; y: number; width: number; height: number }> = [];

    // Sort by p-value so most significant get labeled first (and get priority for position)
    const genesToDraw = plotted
      .filter((p) => genesToLabel.has(p.gene.gene_id))
      .sort((a, b) => (a.gene.pvalue ?? Infinity) - (b.gene.pvalue ?? Infinity));

    genesToDraw.forEach((p) => {
      const label = p.gene.gene_symbol;
      const textWidth = ctx.measureText(label).width;
      const labelHeight = 12;
      const padding = 2;

      // Try positions: right, left, above, below
      const positions = [
        { x: p.x + 6, y: p.y, align: 'left' as const },
        { x: p.x - 6 - textWidth, y: p.y, align: 'left' as const },
        { x: p.x - textWidth / 2, y: p.y - 10, align: 'left' as const },
        { x: p.x - textWidth / 2, y: p.y + 10, align: 'left' as const },
      ];

      let bestPos = positions[0];
      let found = false;

      for (const pos of positions) {
        const rect = {
          x: pos.x - padding,
          y: pos.y - labelHeight / 2 - padding,
          width: textWidth + padding * 2,
          height: labelHeight + padding * 2,
        };

        // Check bounds
        if (rect.x < 0 || rect.x + rect.width > dimensions.width) continue;
        if (rect.y < 0 || rect.y + rect.height > dimensions.height) continue;

        // Check overlap with existing labels
        const overlaps = labelPositions.some(
          (existing) =>
            rect.x < existing.x + existing.width &&
            rect.x + rect.width > existing.x &&
            rect.y < existing.y + existing.height &&
            rect.y + rect.height > existing.y
        );

        if (!overlaps) {
          bestPos = pos;
          found = true;
          labelPositions.push(rect);
          break;
        }
      }

      // Draw label with background
      const isSignificant = p.gene.pvalue != null && p.gene.pvalue < SIG_THRESHOLD;

      // Semi-transparent background
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.fillRect(bestPos.x - 1, bestPos.y - 6, textWidth + 2, 12);

      // Text
      ctx.fillStyle = isSignificant ? '#c62828' : '#333';
      ctx.textAlign = 'left';
      ctx.fillText(label, bestPos.x, bestPos.y);
    });
  }, [geneData, dimensions, genesToLabel]);

  // Handle mouse move for hover detection
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      setMousePos({ x: e.clientX, y: e.clientY });

      // Find nearest gene within 10px
      let nearest: GeneAssociationResult | null = null;
      let minDist = 10;

      for (const p of plottedGenes) {
        const dist = Math.sqrt((p.x - x) ** 2 + (p.y - y) ** 2);
        if (dist < minDist) {
          minDist = dist;
          nearest = p.gene;
        }
      }

      setHoveredGene(nearest);
    },
    [plottedGenes]
  );

  const handleMouseLeave = useCallback(() => {
    setHoveredGene(null);
  }, []);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (hoveredGene && onGeneClick) {
        onGeneClick(hoveredGene.gene_id);
      }
    },
    [hoveredGene, onGeneClick]
  );

  return (
    <div className="manhattan-container">
      <div className="manhattan-plot-row" style={{ display: 'flex' }}>
        {/* Y-Axis */}
        <div
          style={{
            width: Y_AXIS_WIDTH,
            flexShrink: 0,
            position: 'relative',
          }}
        >
          <YAxis height={dimensions.height} width={Y_AXIS_WIDTH} />
        </div>

        <div
          className="manhattan-image-wrapper"
          ref={containerRef}
          style={{ flex: 1, position: 'relative' }}
        >
          {/* Canvas plot */}
          <canvas
            ref={canvasRef}
            style={{
              display: 'block',
              width: '100%',
              height: PLOT_HEIGHT,
              cursor: hoveredGene ? 'pointer' : 'default',
            }}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onClick={handleClick}
          />

          {/* Tooltip on hover */}
          {hoveredGene && (
            <div
              style={{
                position: 'fixed',
                left: mousePos.x + 10,
                top: mousePos.y - 10,
                background: 'white',
                border: '1px solid #ccc',
                borderRadius: 4,
                padding: '6px 10px',
                fontSize: 12,
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                zIndex: 1000,
                pointerEvents: 'none',
              }}
            >
              <div style={{ fontWeight: 600 }}>{hoveredGene.gene_symbol}</div>
              <div style={{ color: '#666', fontSize: 11 }}>{hoveredGene.gene_id}</div>
              <div style={{ marginTop: 4 }}>
                <span style={{ color: '#666' }}>P-value: </span>
                <span style={{ fontFamily: 'monospace' }}>
                  {hoveredGene.pvalue?.toExponential(2) ?? '—'}
                </span>
              </div>
              {hoveredGene.pvalue_burden != null && (
                <div>
                  <span style={{ color: '#666' }}>Burden: </span>
                  <span style={{ fontFamily: 'monospace' }}>
                    {hoveredGene.pvalue_burden.toExponential(2)}
                  </span>
                </div>
              )}
              {hoveredGene.pvalue_skat != null && (
                <div>
                  <span style={{ color: '#666' }}>SKAT: </span>
                  <span style={{ fontFamily: 'monospace' }}>
                    {hoveredGene.pvalue_skat.toExponential(2)}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Chromosome labels */}
      {dimensions.width > 0 && (
        <div style={{ marginLeft: Y_AXIS_WIDTH }}>
          <ChromosomeLabels width={dimensions.width} contig="all" />
        </div>
      )}

      {/* Stats bar */}
      <div className="manhattan-stats" style={{ marginLeft: Y_AXIS_WIDTH }}>
        <div className="manhattan-stats-item">
          <span className="manhattan-stats-label">Genes:</span>
          <span className="manhattan-stats-value">{geneData.length.toLocaleString()}</span>
        </div>
        <div className="manhattan-stats-item">
          <span className="manhattan-stats-label">Labeled:</span>
          <span className="manhattan-stats-value">{genesToLabel.size}</span>
        </div>
        <div className="manhattan-stats-item">
          <span className="manhattan-stats-label">Threshold:</span>
          <span className="manhattan-stats-value">P &lt; 2.5e-6</span>
        </div>
      </div>
    </div>
  );
};

export default GeneBurdenManhattan;
