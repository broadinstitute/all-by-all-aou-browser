import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery } from '@axaou/ui';
import { useRecoilValue, useRecoilState } from 'recoil';
import styled from 'styled-components';
import { YAxis } from '../Manhattan/components/YAxis';
import { ChromosomeLabels } from '../Manhattan/components/ChromosomeLabels';
import { getChromosomeLayout, getYScale } from '../Manhattan/layout';
import { axaouDevUrl, pouchDbName, cacheEnabled } from '../Query';
import { ancestryGroupAtom, geneIdAtom, resultLayoutAtom } from '../sharedState';

const Container = styled.div`
  width: 100%;
  max-width: 1400px; /* Prevent over-stretching on wide screens */
`;

const ControlBar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: #f5f5f5;
  border-radius: 4px;
  margin-bottom: 8px;
  font-size: 12px;
`;

const LegendGroup = styled.div`
  display: flex;
  gap: 16px;
  align-items: center;
`;

const LegendItem = styled.label`
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
`;

const LegendShape = styled.span<{ $color: string; $shape: 'circle' | 'triangle' | 'square' }>`
  width: 12px;
  height: 12px;
  display: inline-block;
  background: ${({ $color, $shape }) => ($shape === 'circle' ? $color : 'transparent')};
  border-radius: ${({ $shape }) => ($shape === 'circle' ? '50%' : '0')};

  ${({ $shape, $color }) =>
    $shape === 'triangle' &&
    `
    width: 0;
    height: 0;
    border-left: 6px solid transparent;
    border-right: 6px solid transparent;
    border-bottom: 12px solid ${$color};
  `}

  ${({ $shape, $color }) =>
    $shape === 'square' &&
    `
    background: ${$color};
  `}
`;

const StatsGroup = styled.div`
  display: flex;
  gap: 16px;
  font-size: 11px;
  color: #666;
`;

const TestToggleGroup = styled.div`
  display: flex;
  gap: 2px;
  background: #e0e0e0;
  border-radius: 4px;
  padding: 2px;
`;

const TestToggleButton = styled.button<{ $active: boolean }>`
  padding: 4px 10px;
  font-size: 11px;
  background: ${({ $active }) => ($active ? '#fff' : 'transparent')};
  color: ${({ $active }) => ($active ? '#333' : '#666')};
  border: none;
  border-radius: 3px;
  cursor: pointer;
  font-weight: ${({ $active }) => ($active ? 500 : 400)};
  box-shadow: ${({ $active }) => ($active ? '0 1px 2px rgba(0,0,0,0.1)' : 'none')};

  &:hover {
    background: ${({ $active }) => ($active ? '#fff' : 'rgba(255,255,255,0.5)')};
  }
`;

const PlotContainer = styled.div`
  display: flex;
  width: 100%;
`;

const CanvasWrapper = styled.div`
  flex: 1;
  position: relative;
  min-width: 0;
`;

const Tooltip = styled.div`
  position: fixed;
  background: white;
  border: 1px solid #ccc;
  border-radius: 4px;
  padding: 8px 12px;
  font-size: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  pointer-events: none;
`;

const Y_AXIS_WIDTH = 50;
const PLOT_HEIGHT = 400; // Fixed height like GeneBurdenManhattan
const PLOT_PADDING = 8; // Padding at top/bottom so extreme points aren't clipped
const SIG_THRESHOLD = 2.5e-6;

interface GeneAssociationResult {
  gene_id: string;
  gene_symbol: string;
  contig: string;
  gene_start_position: number;
  pvalue: number | null;
  pvalue_burden: number | null;
  pvalue_skat: number | null;
}

type TestType = 'max' | 'skato' | 'burden' | 'skat';

const TEST_OPTIONS: Array<{ key: TestType; label: string }> = [
  { key: 'max', label: 'Best P' },
  { key: 'skato', label: 'SKAT-O' },
  { key: 'burden', label: 'Burden' },
  { key: 'skat', label: 'SKAT' },
];

function getPvalueForTest(gene: GeneAssociationResult, testType: TestType): number | null {
  switch (testType) {
    case 'max':
      const values = [gene.pvalue, gene.pvalue_burden, gene.pvalue_skat].filter(
        (v): v is number => v != null
      );
      return values.length > 0 ? Math.min(...values) : null;
    case 'skato':
      return gene.pvalue;
    case 'burden':
      return gene.pvalue_burden;
    case 'skat':
      return gene.pvalue_skat;
  }
}

interface PlottedPoint {
  gene_id: string;
  gene_symbol: string;
  annotation: string;
  pvalue: number;
  x: number;
  y: number;
}

const ANNOTATIONS = [
  { key: 'pLoF', label: 'pLoF', color: '#c62828', shape: 'circle' as const },        // Red
  { key: 'missenseLC', label: 'Missense', color: '#f57c00', shape: 'triangle' as const }, // Orange
  { key: 'synonymous', label: 'Synonymous', color: '#2e7d32', shape: 'square' as const }, // Green
];

interface Props {
  analysisId: string;
  maxMaf?: number;
}

export const GeneBurdenOverlay: React.FC<Props> = ({ analysisId, maxMaf = 0.001 }) => {
  const ancestryGroup = useRecoilValue(ancestryGroupAtom);
  const [, setGeneId] = useRecoilState(geneIdAtom);
  const [, setResultLayout] = useRecoilState(resultLayoutAtom);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [dimensions, setDimensions] = useState({ width: 800, height: PLOT_HEIGHT }); // Default width, will be updated
  const [hoveredPoint, setHoveredPoint] = useState<PlottedPoint | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [plottedPoints, setPlottedPoints] = useState<PlottedPoint[]>([]);
  const [visibleAnnotations, setVisibleAnnotations] = useState<Set<string>>(
    new Set(['pLoF', 'missenseLC', 'synonymous'])
  );
  const [testType, setTestType] = useState<TestType>('max');

  // Fetch all three annotation types
  interface Data {
    pLoF: GeneAssociationResult[] | null;
    missenseLC: GeneAssociationResult[] | null;
    synonymous: GeneAssociationResult[] | null;
  }

  const { queryStates, anyLoading } = useQuery<Data>({
    dbName: pouchDbName,
    queries: [
      { url: `${axaouDevUrl}/phenotype/${analysisId}/genes?ancestry=${ancestryGroup}&annotation=pLoF&max_maf=${maxMaf}&limit=50000`, name: 'pLoF' },
      { url: `${axaouDevUrl}/phenotype/${analysisId}/genes?ancestry=${ancestryGroup}&annotation=missenseLC&max_maf=${maxMaf}&limit=50000`, name: 'missenseLC' },
      { url: `${axaouDevUrl}/phenotype/${analysisId}/genes?ancestry=${ancestryGroup}&annotation=synonymous&max_maf=${maxMaf}&limit=50000`, name: 'synonymous' },
    ],
    deps: [analysisId, ancestryGroup, maxMaf],
    cacheEnabled,
  });

  // Compute stats
  const stats = useMemo(() => {
    const result: Record<string, { total: number; significant: number }> = {};
    const pLoFData = queryStates.pLoF?.data ?? [];
    const missenseData = queryStates.missenseLC?.data ?? [];
    const synonymousData = queryStates.synonymous?.data ?? [];

    result.pLoF = {
      total: pLoFData.length,
      significant: pLoFData.filter((g: GeneAssociationResult) => {
        const p = getPvalueForTest(g, testType);
        return p != null && p < SIG_THRESHOLD;
      }).length,
    };
    result.missenseLC = {
      total: missenseData.length,
      significant: missenseData.filter((g: GeneAssociationResult) => {
        const p = getPvalueForTest(g, testType);
        return p != null && p < SIG_THRESHOLD;
      }).length,
    };
    result.synonymous = {
      total: synonymousData.length,
      significant: synonymousData.filter((g: GeneAssociationResult) => {
        const p = getPvalueForTest(g, testType);
        return p != null && p < SIG_THRESHOLD;
      }).length,
    };

    return result;
  }, [queryStates, testType]);

  // Track container width (fixed height like GeneBurdenManhattan)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Immediate measurement
    const rect = container.getBoundingClientRect();
    if (rect.width > 0) {
      setDimensions({ width: rect.width, height: PLOT_HEIGHT });
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry && entry.contentRect.width > 0) {
        setDimensions({ width: entry.contentRect.width, height: PLOT_HEIGHT });
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Draw points on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || dimensions.width === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = dimensions.width * dpr;
    canvas.height = dimensions.height * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, dimensions.width, dimensions.height);

    const layout = getChromosomeLayout('all');
    const yScale = getYScale();

    const points: PlottedPoint[] = [];

    // Draw in reverse order so pLoF (most important) is on top
    const annotationsToRender = [...ANNOTATIONS].reverse();

    const dataByAnnotation: Record<string, GeneAssociationResult[]> = {
      pLoF: queryStates.pLoF?.data ?? [],
      missenseLC: queryStates.missenseLC?.data ?? [],
      synonymous: queryStates.synonymous?.data ?? [],
    };

    for (const ann of annotationsToRender) {
      if (!visibleAnnotations.has(ann.key)) continue;

      const data = dataByAnnotation[ann.key];

      for (const gene of data) {
        const pvalue = getPvalueForTest(gene, testType);
        if (!gene.contig || gene.gene_start_position == null || pvalue == null) continue;

        const xNorm = layout.getX(gene.contig, gene.gene_start_position);
        const yNorm = yScale.getY(pvalue);

        if (xNorm === null) continue;

        const x = xNorm * dimensions.width;
        // Apply padding so extreme values aren't clipped
        const plotAreaHeight = dimensions.height - PLOT_PADDING * 2;
        const y = PLOT_PADDING + yNorm * plotAreaHeight;

        // Draw shape based on annotation type
        ctx.fillStyle = ann.color;
        ctx.strokeStyle = ann.color;

        const size = pvalue < SIG_THRESHOLD ? 5 : 3;

        if (ann.shape === 'circle') {
          ctx.beginPath();
          ctx.arc(x, y, size, 0, Math.PI * 2);
          ctx.fill();
        } else if (ann.shape === 'triangle') {
          ctx.beginPath();
          ctx.moveTo(x, y - size);
          ctx.lineTo(x - size, y + size);
          ctx.lineTo(x + size, y + size);
          ctx.closePath();
          ctx.fill();
        } else if (ann.shape === 'square') {
          ctx.fillRect(x - size, y - size, size * 2, size * 2);
        }

        points.push({
          gene_id: gene.gene_id,
          gene_symbol: gene.gene_symbol,
          annotation: ann.key,
          pvalue,
          x,
          y,
        });
      }
    }

    // Draw significance threshold line
    const plotAreaHeight = dimensions.height - PLOT_PADDING * 2;
    const sigY = PLOT_PADDING + yScale.getY(SIG_THRESHOLD) * plotAreaHeight;
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = '#999';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, sigY);
    ctx.lineTo(dimensions.width, sigY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Label the threshold
    ctx.fillStyle = '#999';
    ctx.font = '10px -apple-system, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('P = 2.5e-6', dimensions.width - 4, sigY - 4);

    // Draw labels for top significant genes
    ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textBaseline = 'middle';

    // Get top 25 most significant points to label
    const pointsToLabel = [...points]
      .filter((p) => p.pvalue < SIG_THRESHOLD)
      .sort((a, b) => a.pvalue - b.pvalue)
      .slice(0, 25);

    // Track label positions to avoid overlaps
    const labelRects: Array<{ x: number; y: number; w: number; h: number }> = [];

    for (const p of pointsToLabel) {
      const label = p.gene_symbol;
      const textWidth = ctx.measureText(label).width;
      const labelHeight = 12;
      const pad = 2;

      // Try positions: right, left, above, below
      const positions = [
        { x: p.x + 8, y: p.y },
        { x: p.x - 8 - textWidth, y: p.y },
        { x: p.x - textWidth / 2, y: p.y - 12 },
        { x: p.x - textWidth / 2, y: p.y + 12 },
      ];

      let bestPos = positions[0];

      for (const pos of positions) {
        const rect = {
          x: pos.x - pad,
          y: pos.y - labelHeight / 2 - pad,
          w: textWidth + pad * 2,
          h: labelHeight + pad * 2,
        };

        // Check bounds
        if (rect.x < 0 || rect.x + rect.w > dimensions.width) continue;
        if (rect.y < 0 || rect.y + rect.h > dimensions.height) continue;

        // Check overlap
        const overlaps = labelRects.some(
          (r) =>
            rect.x < r.x + r.w &&
            rect.x + rect.w > r.x &&
            rect.y < r.y + r.h &&
            rect.y + rect.h > r.y
        );

        if (!overlaps) {
          bestPos = pos;
          labelRects.push(rect);
          break;
        }
      }

      // Draw background
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.fillRect(bestPos.x - 1, bestPos.y - 6, textWidth + 2, 12);

      // Draw text with annotation color
      const annColor = ANNOTATIONS.find((a) => a.key === p.annotation)?.color ?? '#333';
      ctx.fillStyle = annColor;
      ctx.textAlign = 'left';
      ctx.fillText(label, bestPos.x, bestPos.y);
    }

    setPlottedPoints(points);
  }, [queryStates, dimensions, visibleAnnotations, testType]);

  // Handle mouse move
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      setMousePos({ x: e.clientX, y: e.clientY });

      // Find nearest point within 8px
      let nearest: PlottedPoint | null = null;
      let minDist = 8;

      for (const p of plottedPoints) {
        if (!visibleAnnotations.has(p.annotation)) continue;
        const dist = Math.sqrt((p.x - x) ** 2 + (p.y - y) ** 2);
        if (dist < minDist) {
          minDist = dist;
          nearest = p;
        }
      }

      setHoveredPoint(nearest);
    },
    [plottedPoints, visibleAnnotations]
  );

  const handleMouseLeave = useCallback(() => {
    setHoveredPoint(null);
  }, []);

  const handleClick = useCallback(() => {
    if (hoveredPoint) {
      setGeneId(hoveredPoint.gene_id);
      setResultLayout('half');
    }
  }, [hoveredPoint, setGeneId, setResultLayout]);

  const toggleAnnotation = useCallback((key: string) => {
    setVisibleAnnotations((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  if (anyLoading()) {
    return (
      <Container>
        <div style={{ padding: 40, textAlign: 'center', color: '#666' }}>
          Loading gene burden data...
        </div>
      </Container>
    );
  }

  return (
    <Container>
      <ControlBar>
        <LegendGroup>
          {ANNOTATIONS.map((ann) => (
            <LegendItem key={ann.key}>
              <input
                type="checkbox"
                checked={visibleAnnotations.has(ann.key)}
                onChange={() => toggleAnnotation(ann.key)}
              />
              <LegendShape $color={ann.color} $shape={ann.shape} />
              <span style={{ color: ann.color, fontWeight: 500 }}>{ann.label}</span>
              <span style={{ color: '#666' }}>
                ({stats[ann.key]?.significant ?? 0} sig)
              </span>
            </LegendItem>
          ))}
        </LegendGroup>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <TestToggleGroup>
            {TEST_OPTIONS.map((opt) => (
              <TestToggleButton
                key={opt.key}
                $active={testType === opt.key}
                onClick={() => setTestType(opt.key)}
              >
                {opt.label}
              </TestToggleButton>
            ))}
          </TestToggleGroup>
          <StatsGroup>
            <span>MAF ≤ {(maxMaf * 100).toFixed(2)}%</span>
          </StatsGroup>
        </div>
      </ControlBar>

      <PlotContainer>
        <div style={{ width: Y_AXIS_WIDTH, flexShrink: 0, position: 'relative', height: PLOT_HEIGHT }}>
          <YAxis height={PLOT_HEIGHT} width={Y_AXIS_WIDTH} />
        </div>

        <CanvasWrapper ref={containerRef}>
          <canvas
            ref={canvasRef}
            style={{
              display: 'block',
              width: '100%',
              height: PLOT_HEIGHT,
              cursor: hoveredPoint ? 'pointer' : 'default',
            }}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onClick={handleClick}
          />
        </CanvasWrapper>
      </PlotContainer>

      {dimensions.width > 0 && (
        <div style={{ marginLeft: Y_AXIS_WIDTH }}>
          <ChromosomeLabels width={dimensions.width} contig="all" />
        </div>
      )}

      {hoveredPoint && (
        <Tooltip style={{ left: mousePos.x + 12, top: mousePos.y - 10 }}>
          <div style={{ fontWeight: 600 }}>{hoveredPoint.gene_symbol}</div>
          <div style={{ color: '#666', fontSize: 11 }}>{hoveredPoint.gene_id}</div>
          <div style={{ marginTop: 4 }}>
            <span
              style={{
                color: ANNOTATIONS.find((a) => a.key === hoveredPoint.annotation)?.color,
                fontWeight: 500,
              }}
            >
              {ANNOTATIONS.find((a) => a.key === hoveredPoint.annotation)?.label}
            </span>
          </div>
          <div>
            <span style={{ color: '#666' }}>P-value: </span>
            <span style={{ fontFamily: 'monospace' }}>
              {hoveredPoint.pvalue.toExponential(2)}
            </span>
          </div>
        </Tooltip>
      )}
    </Container>
  );
};

export default GeneBurdenOverlay;
