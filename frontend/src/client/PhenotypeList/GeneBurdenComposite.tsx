import React, { useMemo, useState, useCallback } from 'react';
import { useQuery } from '@axaou/ui';
import { useRecoilValue, useRecoilState } from 'recoil';
import styled from 'styled-components';
import { axaouDevUrl, pouchDbName, cacheEnabled } from '../Query';
import { ancestryGroupAtom, geneIdAtom, resultLayoutAtom } from '../sharedState';

const Container = styled.div`
  width: 100%;
`;

const LoadingMessage = styled.div`
  padding: 40px;
  text-align: center;
  color: var(--theme-text-muted, #666);
`;

const HeatmapContainer = styled.div`
  overflow-x: auto;
  margin-top: 8px;
`;

const HeatmapTable = styled.table`
  border-collapse: collapse;
  font-size: 12px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
`;

const HeaderRow = styled.tr`
  height: 80px;
`;

const ColumnHeader = styled.th<{ $color: string }>`
  position: relative;
  vertical-align: bottom;
  padding: 0 2px 4px 2px;
  width: 50px;
  min-width: 50px;
  border-bottom: 3px solid ${({ $color }) => $color};

  & > div {
    transform: rotate(-45deg);
    transform-origin: left bottom;
    white-space: nowrap;
    position: absolute;
    bottom: 8px;
    left: 50%;
    font-size: 10px;
    font-weight: 500;
    color: var(--theme-text, #333);
  }
`;

const GeneCell = styled.td<{ $significant: boolean }>`
  padding: 2px 8px 2px 4px;
  text-align: right;
  font-weight: ${({ $significant }) => ($significant ? 600 : 400)};
  color: ${({ $significant }) => ($significant ? '#ef5350' : 'var(--theme-text, #333)')};
  cursor: pointer;
  white-space: nowrap;

  &:hover {
    text-decoration: underline;
  }
`;

const DataCell = styled.td<{ $intensity: number; $significant: boolean; $color: string }>`
  width: 50px;
  min-width: 50px;
  height: 18px;
  text-align: center;
  font-size: 10px;
  cursor: pointer;
  position: relative;
  background-color: ${({ $intensity, $color }) => {
    if ($intensity === 0) return 'transparent';
    // Parse the hex color and use alpha channel so theme background shows through
    const hex = $color.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${$intensity})`;
  }};

  &:hover {
    outline: 2px solid var(--theme-text, #333);
    outline-offset: -2px;
    z-index: 1;
  }

  ${({ $significant }) =>
    $significant &&
    `
    &::after {
      content: '*';
      font-weight: bold;
      font-size: 12px;
      color: var(--theme-text, #000);
    }
  `}
`;

const Legend = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 12px;
  font-size: 11px;
  color: var(--theme-text-muted, #666);
`;

const GradientBar = styled.div`
  width: 80px;
  height: 12px;
  background: linear-gradient(to right, transparent, #ffcdd2, #ef5350, #c62828);
  border: 1px solid var(--theme-border, #ddd);
  border-radius: 2px;
`;

const Tooltip = styled.div`
  position: fixed;
  background: var(--theme-surface, white);
  color: var(--theme-text, #333);
  border: 1px solid var(--theme-border, #ccc);
  border-radius: 4px;
  padding: 8px 12px;
  font-size: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  pointer-events: none;
`;

const SummaryBar = styled.div`
  display: flex;
  gap: 24px;
  padding: 12px;
  background: var(--theme-surface-alt, #f5f5f5);
  border-radius: 4px;
  margin-bottom: 16px;
  font-size: 13px;
  color: var(--theme-text, #333);
`;

const SummaryStat = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;

  & > span:first-child {
    color: var(--theme-text-muted, #666);
  }

  & > span:last-child {
    font-weight: 600;
  }
`;

const ColorDot = styled.span<{ $color: string }>`
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: ${({ $color }) => $color};
`;

interface GeneAssociationResult {
  gene_id: string;
  gene_symbol: string;
  annotation: string;
  max_maf: number;
  contig: string;
  gene_start_position: number;
  pvalue: number | null;
  pvalue_burden: number | null;
  pvalue_skat: number | null;
  beta_burden: number | null;
}

const ANNOTATIONS = ['pLoF', 'missenseLC', 'synonymous'] as const;
const MAF_VALUES = [0.01, 0.001, 0.0001] as const;
const MAF_LABELS: Record<number, string> = {
  0.01: '1%',
  0.001: '0.1%',
  0.0001: '0.01%',
};
const ANNOTATION_LABELS: Record<string, string> = {
  pLoF: 'pLoF',
  missenseLC: 'Mis',
  synonymous: 'Syn',
};
const ANNOTATION_COLORS: Record<string, string> = {
  pLoF: '#c62828',      // Red
  missenseLC: '#f57c00', // Orange
  synonymous: '#2e7d32', // Green
};
const SIG_THRESHOLD = 2.5e-6;

interface Props {
  analysisId: string;
  maxMaf?: number; // Optional - heatmap shows all MAFs, but could be used for highlighting
}

type ColumnKey = `${typeof ANNOTATIONS[number]}_${typeof MAF_VALUES[number]}`;

interface GeneRow {
  gene_id: string;
  gene_symbol: string;
  contig: string;
  gene_start_position: number;
  values: Record<ColumnKey, number | null>;
  minPvalue: number;
  significantCount: number;
}

interface Column {
  key: ColumnKey;
  annotation: string;
  maf: number;
  label: string;
}

export const GeneBurdenComposite: React.FC<Props> = ({ analysisId }) => {
  const ancestryGroup = useRecoilValue(ancestryGroupAtom);
  const [, setGeneId] = useRecoilState(geneIdAtom);
  const [, setResultLayout] = useRecoilState(resultLayoutAtom);

  const [hoveredCell, setHoveredCell] = useState<{
    gene: GeneRow;
    column: Column;
    x: number;
    y: number;
  } | null>(null);

  // Fetch all annotation/MAF combinations
  interface Data {
    pLoF_001: GeneAssociationResult[] | null;
    pLoF_0001: GeneAssociationResult[] | null;
    pLoF_00001: GeneAssociationResult[] | null;
    missenseLC_001: GeneAssociationResult[] | null;
    missenseLC_0001: GeneAssociationResult[] | null;
    missenseLC_00001: GeneAssociationResult[] | null;
    synonymous_001: GeneAssociationResult[] | null;
    synonymous_0001: GeneAssociationResult[] | null;
    synonymous_00001: GeneAssociationResult[] | null;
  }

  const { queryStates, anyLoading } = useQuery<Data>({
    dbName: pouchDbName,
    queries: [
      { url: `${axaouDevUrl}/phenotype/${analysisId}/genes?ancestry=${ancestryGroup}&annotation=pLoF&max_maf=0.01&limit=50000`, name: 'pLoF_001' },
      { url: `${axaouDevUrl}/phenotype/${analysisId}/genes?ancestry=${ancestryGroup}&annotation=pLoF&max_maf=0.001&limit=50000`, name: 'pLoF_0001' },
      { url: `${axaouDevUrl}/phenotype/${analysisId}/genes?ancestry=${ancestryGroup}&annotation=pLoF&max_maf=0.0001&limit=50000`, name: 'pLoF_00001' },
      { url: `${axaouDevUrl}/phenotype/${analysisId}/genes?ancestry=${ancestryGroup}&annotation=missenseLC&max_maf=0.01&limit=50000`, name: 'missenseLC_001' },
      { url: `${axaouDevUrl}/phenotype/${analysisId}/genes?ancestry=${ancestryGroup}&annotation=missenseLC&max_maf=0.001&limit=50000`, name: 'missenseLC_0001' },
      { url: `${axaouDevUrl}/phenotype/${analysisId}/genes?ancestry=${ancestryGroup}&annotation=missenseLC&max_maf=0.0001&limit=50000`, name: 'missenseLC_00001' },
      { url: `${axaouDevUrl}/phenotype/${analysisId}/genes?ancestry=${ancestryGroup}&annotation=synonymous&max_maf=0.01&limit=50000`, name: 'synonymous_001' },
      { url: `${axaouDevUrl}/phenotype/${analysisId}/genes?ancestry=${ancestryGroup}&annotation=synonymous&max_maf=0.001&limit=50000`, name: 'synonymous_0001' },
      { url: `${axaouDevUrl}/phenotype/${analysisId}/genes?ancestry=${ancestryGroup}&annotation=synonymous&max_maf=0.0001&limit=50000`, name: 'synonymous_00001' },
    ],
    deps: [analysisId, ancestryGroup],
    cacheEnabled,
  });

  // Combine all data into a unified gene matrix
  const { geneRows, columns, summary } = useMemo(() => {
    const geneMap = new Map<string, GeneRow>();

    const cols: Column[] = [];
    for (const ann of ANNOTATIONS) {
      for (const maf of MAF_VALUES) {
        cols.push({
          key: `${ann}_${maf}` as ColumnKey,
          annotation: ann,
          maf,
          label: `${ANNOTATION_LABELS[ann]} ${MAF_LABELS[maf]}`,
        });
      }
    }

    // Process each query result
    const dataKeys = [
      ['pLoF_001', 'pLoF', 0.01],
      ['pLoF_0001', 'pLoF', 0.001],
      ['pLoF_00001', 'pLoF', 0.0001],
      ['missenseLC_001', 'missenseLC', 0.01],
      ['missenseLC_0001', 'missenseLC', 0.001],
      ['missenseLC_00001', 'missenseLC', 0.0001],
      ['synonymous_001', 'synonymous', 0.01],
      ['synonymous_0001', 'synonymous', 0.001],
      ['synonymous_00001', 'synonymous', 0.0001],
    ] as const;

    for (const [queryKey, annotation, maf] of dataKeys) {
      const data = queryStates[queryKey]?.data ?? [];
      const colKey = `${annotation}_${maf}` as ColumnKey;

      for (const gene of data) {
        if (!geneMap.has(gene.gene_id)) {
          geneMap.set(gene.gene_id, {
            gene_id: gene.gene_id,
            gene_symbol: gene.gene_symbol,
            contig: gene.contig,
            gene_start_position: gene.gene_start_position,
            values: {} as Record<ColumnKey, number | null>,
            minPvalue: Infinity,
            significantCount: 0,
          });
        }

        const row = geneMap.get(gene.gene_id)!;
        row.values[colKey] = gene.pvalue;

        if (gene.pvalue != null) {
          row.minPvalue = Math.min(row.minPvalue, gene.pvalue);
          if (gene.pvalue < SIG_THRESHOLD) {
            row.significantCount++;
          }
        }
      }
    }

    // Sort genes by minimum p-value and take top genes
    const sortedGenes = Array.from(geneMap.values())
      .filter((g) => g.minPvalue < 1)
      .sort((a, b) => a.minPvalue - b.minPvalue)
      .slice(0, 50);

    // Compute summary stats
    const sigCounts: Record<string, number> = { pLoF: 0, missenseLC: 0, synonymous: 0 };
    const allSigGenes = new Set<string>();

    for (const gene of geneMap.values()) {
      for (const ann of ANNOTATIONS) {
        for (const maf of MAF_VALUES) {
          const key = `${ann}_${maf}` as ColumnKey;
          const pval = gene.values[key];
          if (pval != null && pval < SIG_THRESHOLD) {
            sigCounts[ann]++;
            allSigGenes.add(gene.gene_id);
            break; // Count gene once per annotation
          }
        }
      }
    }

    return {
      geneRows: sortedGenes,
      columns: cols,
      summary: {
        totalSigGenes: allSigGenes.size,
        pLoF: sigCounts.pLoF,
        missenseLC: sigCounts.missenseLC,
        synonymous: sigCounts.synonymous,
      },
    };
  }, [queryStates]);

  const handleGeneClick = useCallback(
    (geneId: string) => {
      setGeneId(geneId);
      setResultLayout('half');
    },
    [setGeneId, setResultLayout]
  );

  const handleCellHover = useCallback(
    (gene: GeneRow, column: Column, e: React.MouseEvent) => {
      setHoveredCell({ gene, column, x: e.clientX, y: e.clientY });
    },
    []
  );

  const handleCellLeave = useCallback(() => {
    setHoveredCell(null);
  }, []);

  if (anyLoading()) {
    return (
      <Container>
        <LoadingMessage>Loading gene burden data across all annotations and MAF thresholds...</LoadingMessage>
      </Container>
    );
  }

  return (
    <Container>
      {/* Summary Stats */}
      <SummaryBar>
        <SummaryStat>
          <span>Significant genes:</span>
          <span>{summary.totalSigGenes}</span>
        </SummaryStat>
        <SummaryStat>
          <ColorDot $color={ANNOTATION_COLORS.pLoF} />
          <span>pLoF:</span>
          <span>{summary.pLoF}</span>
        </SummaryStat>
        <SummaryStat>
          <ColorDot $color={ANNOTATION_COLORS.missenseLC} />
          <span>Missense:</span>
          <span>{summary.missenseLC}</span>
        </SummaryStat>
        <SummaryStat>
          <ColorDot $color={ANNOTATION_COLORS.synonymous} />
          <span>Synonymous:</span>
          <span>{summary.synonymous}</span>
        </SummaryStat>
      </SummaryBar>

      {/* Heatmap */}
      <HeatmapContainer>
        <HeatmapTable>
          <thead>
            <HeaderRow>
              <th style={{ width: 80 }} />
              {columns.map((col) => (
                <ColumnHeader key={col.key} $color={ANNOTATION_COLORS[col.annotation]}>
                  <div>{col.label}</div>
                </ColumnHeader>
              ))}
            </HeaderRow>
          </thead>
          <tbody>
            {geneRows.map((gene) => (
              <tr key={gene.gene_id}>
                <GeneCell
                  $significant={gene.significantCount > 0}
                  onClick={() => handleGeneClick(gene.gene_id)}
                  title={`${gene.gene_symbol} (${gene.gene_id})`}
                >
                  {gene.gene_symbol}
                </GeneCell>
                {columns.map((col) => {
                  const pvalue = gene.values[col.key];
                  const negLogP = pvalue != null ? -Math.log10(pvalue) : 0;
                  const intensity = Math.min(negLogP / 15, 1);
                  const isSignificant = pvalue != null && pvalue < SIG_THRESHOLD;

                  return (
                    <DataCell
                      key={col.key}
                      $intensity={pvalue != null ? intensity : 0}
                      $significant={isSignificant}
                      $color={ANNOTATION_COLORS[col.annotation]}
                      onClick={() => handleGeneClick(gene.gene_id)}
                      onMouseEnter={(e) => handleCellHover(gene, col, e)}
                      onMouseLeave={handleCellLeave}
                    />
                  );
                })}
              </tr>
            ))}
          </tbody>
        </HeatmapTable>
      </HeatmapContainer>

      {/* Legend */}
      <Legend>
        <span>-log₁₀(p): 0 → 15+</span>
        <div style={{ display: 'flex', gap: 12, marginLeft: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 40, height: 12, background: `linear-gradient(to right, var(--theme-surface, #fff), ${ANNOTATION_COLORS.pLoF})`, border: '1px solid var(--theme-border, #ddd)', borderRadius: 2 }} />
            <span style={{ color: ANNOTATION_COLORS.pLoF }}>pLoF</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 40, height: 12, background: `linear-gradient(to right, var(--theme-surface, #fff), ${ANNOTATION_COLORS.missenseLC})`, border: '1px solid var(--theme-border, #ddd)', borderRadius: 2 }} />
            <span style={{ color: ANNOTATION_COLORS.missenseLC }}>Mis</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 40, height: 12, background: `linear-gradient(to right, var(--theme-surface, #fff), ${ANNOTATION_COLORS.synonymous})`, border: '1px solid var(--theme-border, #ddd)', borderRadius: 2 }} />
            <span style={{ color: ANNOTATION_COLORS.synonymous }}>Syn</span>
          </div>
        </div>
        <span style={{ marginLeft: 16 }}>* = significant (P &lt; 2.5e-6)</span>
      </Legend>

      {/* Tooltip */}
      {hoveredCell && (
        <Tooltip style={{ left: hoveredCell.x + 12, top: hoveredCell.y - 10 }}>
          <div style={{ fontWeight: 600 }}>{hoveredCell.gene.gene_symbol}</div>
          <div style={{ color: 'var(--theme-text-muted, #666)', fontSize: 11, marginBottom: 4 }}>
            {hoveredCell.column.label}
          </div>
          <div>
            <span style={{ color: 'var(--theme-text-muted, #666)' }}>P-value: </span>
            <span style={{ fontFamily: 'monospace' }}>
              {hoveredCell.gene.values[hoveredCell.column.key]?.toExponential(2) ?? 'N/A'}
            </span>
          </div>
        </Tooltip>
      )}
    </Container>
  );
};

export default GeneBurdenComposite;
