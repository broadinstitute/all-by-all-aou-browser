import React, { useMemo, useState, useCallback } from 'react';
import { useQuery } from '@axaou/ui';
import { useRecoilState, useRecoilValue } from 'recoil';
import styled from 'styled-components';

import { GeneBurdenManhattan } from '../Manhattan/GeneBurdenManhattan';
import { axaouDevUrl, pouchDbName, cacheEnabled } from '../Query';
import { ancestryGroupAtom, burdenSetAtom, geneIdAtom, resultLayoutAtom } from '../sharedState';

const Container = styled.div`
  width: 100%;
`;

const ToggleGroup = styled.div`
  display: flex;
  gap: 4px;
  margin-bottom: 16px;
`;

const ToggleButton = styled.button<{ $active: boolean }>`
  padding: 8px 16px;
  font-size: 13px;
  font-family: GothamBook, sans-serif;
  background-color: ${({ $active }) => ($active ? '#262262' : '#f5f5f5')};
  color: ${({ $active }) => ($active ? 'white' : '#333')};
  border: 1px solid ${({ $active }) => ($active ? '#262262' : '#ddd')};
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    background-color: ${({ $active }) => ($active ? '#262262' : '#e8e8e8')};
  }
`;

const ControlPanel = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: #f5f5f5;
  border-radius: 4px;
  font-size: 12px;
  margin-bottom: 8px;
`;

const ControlGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
`;

const SmallButton = styled.button`
  font-size: 11px;
  padding: 4px 10px;
  cursor: pointer;
  background: #fff;
  border: 1px solid #ccc;
  border-radius: 3px;

  &:hover {
    background: #f0f0f0;
  }
`;

const TableContainer = styled.div`
  margin-top: 8px;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  max-height: 500px;
  overflow: auto;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;

  th {
    position: sticky;
    top: 0;
    z-index: 1;
    background: #f5f5f5;
    padding: 10px 12px;
    text-align: left;
    font-weight: 600;
    border-bottom: 1px solid #e0e0e0;
    cursor: pointer;
    user-select: none;

    &:hover {
      background: #eaeaea;
    }

    &:first-child {
      cursor: default;
      width: 40px;
      text-align: center;

      &:hover {
        background: #f5f5f5;
      }
    }
  }

  td {
    padding: 8px 12px;
    border-bottom: 1px solid #f0f0f0;
  }

  tbody tr {
    transition: background-color 0.1s ease;
    cursor: pointer;

    &:hover {
      background: #f8f8f8;
    }
  }

  tbody tr.significant {
    background: rgba(76, 175, 80, 0.08);

    &:hover {
      background: rgba(76, 175, 80, 0.15);
    }
  }

  tbody tr.selected {
    background: rgba(25, 118, 210, 0.08);

    &:hover {
      background: rgba(25, 118, 210, 0.12);
    }
  }
`;

const SortIcon = styled.span<{ $active: boolean; $desc: boolean }>`
  margin-left: 4px;
  opacity: ${({ $active }) => ($active ? 1 : 0.3)};
  display: inline-block;
  transform: ${({ $desc }) => ($desc ? 'rotate(180deg)' : 'rotate(0deg)')};
`;

const Pagination = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: #f9f9f9;
  border-top: 1px solid #e0e0e0;
  font-size: 13px;
`;

const PageButton = styled.button`
  padding: 6px 12px;
  font-size: 12px;
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &:hover:not(:disabled) {
    background: #f0f0f0;
  }
`;

interface GeneAssociationResult {
  gene_id: string;
  gene_symbol: string;
  contig: string;
  gene_start_position: number;
  pvalue: number | null;
  pvalue_burden: number | null;
  pvalue_skat: number | null;
  beta_burden: number | null;
  mac: number | null;
}

type SortKey = 'gene_symbol' | 'pvalue' | 'pvalue_burden' | 'pvalue_skat' | 'beta_burden';

const ANNOTATIONS = [
  { key: 'pLoF', label: 'pLoF' },
  { key: 'missenseLC', label: 'Missense' },
  { key: 'synonymous', label: 'Synonymous' },
] as const;

const PAGE_SIZE = 50;
const SIG_THRESHOLD = 2.5e-6;

interface Props {
  analysisId: string;
}

export const PhenotypeGeneBurdenTab: React.FC<Props> = ({ analysisId }) => {
  const ancestryGroup = useRecoilValue(ancestryGroupAtom);
  const [burdenSet, setBurdenSet] = useRecoilState(burdenSetAtom);
  const [, setGeneId] = useRecoilState(geneIdAtom);
  const [, setResultLayout] = useRecoilState(resultLayoutAtom);

  const [sortKey, setSortKey] = useState<SortKey>('pvalue');
  const [sortDesc, setSortDesc] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [showOnlySignificant, setShowOnlySignificant] = useState(false);

  // Max MAF State
  const [maxMaf, setMaxMaf] = useState<number>(0.001);

  // Label selection state
  const [selectedGeneIds, setSelectedGeneIds] = useState<Set<string>>(new Set());
  const [customLabelMode, setCustomLabelMode] = useState(false);

  interface Data {
    geneData: GeneAssociationResult[] | null;
  }

  const MAF_OPTIONS = [
    { value: 0.01, label: '1%' },
    { value: 0.001, label: '0.1%' },
    { value: 0.0001, label: '0.01%' },
  ];

  const { queryStates, anyLoading } = useQuery<Data>({
    dbName: pouchDbName,
    queries: [
      {
        url: `${axaouDevUrl}/phenotype/${analysisId}/genes?ancestry=${ancestryGroup}&annotation=${burdenSet}&max_maf=${maxMaf}&limit=50000`,
        name: 'geneData',
      },
    ],
    deps: [analysisId, ancestryGroup, burdenSet, maxMaf],
    cacheEnabled,
  });

  // Sort and filter data
  const { sortedData, significantCount, totalPages } = useMemo(() => {
    const data = queryStates.geneData?.data ?? [];

    // Count significant genes
    const sigCount = data.filter((g) => g.pvalue != null && g.pvalue < SIG_THRESHOLD).length;

    // Filter if only showing significant
    const filtered = showOnlySignificant
      ? data.filter((g) => g.pvalue != null && g.pvalue < SIG_THRESHOLD)
      : data;

    const sorted = [...filtered].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];

      if (aVal === null) return 1;
      if (bVal === null) return -1;

      if (sortKey === 'gene_symbol') {
        return sortDesc
          ? (bVal as string).localeCompare(aVal as string)
          : (aVal as string).localeCompare(bVal as string);
      }

      return sortDesc ? (bVal as number) - (aVal as number) : (aVal as number) - (bVal as number);
    });

    return {
      sortedData: sorted,
      significantCount: sigCount,
      totalPages: Math.ceil(sorted.length / PAGE_SIZE),
    };
  }, [queryStates.geneData?.data, sortKey, sortDesc, showOnlySignificant]);

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return sortedData.slice(start, start + PAGE_SIZE);
  }, [sortedData, currentPage]);

  // Label selection callbacks
  const toggleGene = useCallback((geneId: string) => {
    setCustomLabelMode(true);
    setSelectedGeneIds((prev) => {
      const next = new Set(prev);
      if (next.has(geneId)) {
        next.delete(geneId);
      } else {
        next.add(geneId);
      }
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedGeneIds(new Set());
  }, []);

  const resetToDefault = useCallback(() => {
    setSelectedGeneIds(new Set());
    setCustomLabelMode(false);
  }, []);

  const selectAllFiltered = useCallback(() => {
    setCustomLabelMode(true);
    const ids = new Set(sortedData.map((g) => g.gene_id));
    setSelectedGeneIds(ids);
  }, [sortedData]);

  const selectSignificant = useCallback(() => {
    setCustomLabelMode(true);
    const allData = queryStates.geneData?.data ?? [];
    const ids = new Set(
      allData.filter((g) => g.pvalue != null && g.pvalue < SIG_THRESHOLD).map((g) => g.gene_id)
    );
    setSelectedGeneIds(ids);
  }, [queryStates.geneData?.data]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDesc(!sortDesc);
    } else {
      setSortKey(key);
      setSortDesc(false);
    }
    setCurrentPage(1);
  };

  const handleGeneClick = (gene: GeneAssociationResult) => {
    setGeneId(gene.gene_id);
    setResultLayout('half');
  };

  const handleGeneClickFromPlot = (geneId: string) => {
    setGeneId(geneId);
    setResultLayout('half');
  };

  const handleAnnotationChange = (annotation: typeof burdenSet) => {
    setBurdenSet(annotation);
    setCurrentPage(1);
    // Reset selection when changing annotation
    setSelectedGeneIds(new Set());
    setCustomLabelMode(false);
  };

  const formatPvalue = (p: number | null) => {
    if (p === null) return '—';
    return p.toExponential(2);
  };

  const formatBeta = (b: number | null) => {
    if (b === null) return '—';
    return b.toFixed(3);
  };

  // Determine which genes have labels (for checkbox state)
  const labeledGeneIds = useMemo(() => {
    if (customLabelMode) {
      return selectedGeneIds;
    }
    // Default: top 25 by p-value
    const allData = queryStates.geneData?.data ?? [];
    const top25 = [...allData]
      .filter((g) => g.pvalue != null)
      .sort((a, b) => (a.pvalue ?? Infinity) - (b.pvalue ?? Infinity))
      .slice(0, 25)
      .map((g) => g.gene_id);
    return new Set(top25);
  }, [customLabelMode, selectedGeneIds, queryStates.geneData?.data]);

  const geneData = queryStates.geneData?.data ?? [];

  return (
    <Container>
      {/* Annotation and MAF Toggles */}
      <div style={{ display: 'flex', gap: '16px' }}>
        <ToggleGroup>
          {ANNOTATIONS.map((ann) => (
            <ToggleButton
              key={ann.key}
              $active={burdenSet === ann.key}
              onClick={() => handleAnnotationChange(ann.key as typeof burdenSet)}
            >
              {ann.label}
            </ToggleButton>
          ))}
        </ToggleGroup>

        <ToggleGroup>
          {MAF_OPTIONS.map((maf) => (
            <ToggleButton
              key={maf.value}
              $active={maxMaf === maf.value}
              onClick={() => {
                setMaxMaf(maf.value);
                setCurrentPage(1);
                setSelectedGeneIds(new Set());
                setCustomLabelMode(false);
              }}
            >
              MAF ≤ {maf.label}
            </ToggleButton>
          ))}
        </ToggleGroup>
      </div>

      {/* Manhattan Plot with Labels */}
      <GeneBurdenManhattan
        analysisId={analysisId}
        geneData={geneData}
        selectedGeneIds={selectedGeneIds}
        customLabelMode={customLabelMode}
        onGeneClick={handleGeneClickFromPlot}
      />

      {/* Control Panel */}
      <ControlPanel>
        <ControlGroup>
          <span style={{ color: '#333' }}>
            <strong>{sortedData.length.toLocaleString()}</strong>
            {showOnlySignificant ? ` / ${(queryStates.geneData?.data ?? []).length.toLocaleString()}` : ''} genes
          </span>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={showOnlySignificant}
              onChange={(e) => {
                setShowOnlySignificant(e.target.checked);
                setCurrentPage(1);
              }}
              style={{ cursor: 'pointer' }}
            />
            <span style={{ fontSize: 11 }}>Significant only ({significantCount})</span>
          </label>
          {customLabelMode ? (
            <span style={{ color: '#1565c0' }}>
              <strong>{selectedGeneIds.size}</strong> labeled
            </span>
          ) : (
            <span style={{ color: '#666', fontSize: 11 }}>Top 25 labeled</span>
          )}
        </ControlGroup>
        <ControlGroup>
          {!customLabelMode && (
            <>
              <SmallButton onClick={selectSignificant} title="Label all significant genes">
                Label significant ({significantCount})
              </SmallButton>
              <SmallButton onClick={selectAllFiltered} title="Label all filtered genes">
                Label all ({sortedData.length})
              </SmallButton>
            </>
          )}
          {customLabelMode && (
            <>
              {selectedGeneIds.size > 0 && (
                <SmallButton onClick={clearSelection}>Clear all</SmallButton>
              )}
              <SmallButton onClick={resetToDefault}>Reset to top 25</SmallButton>
            </>
          )}
        </ControlGroup>
      </ControlPanel>

      {/* Gene Results Table */}
      <TableContainer>
        <Table>
          <thead>
            <tr>
              <th>Label</th>
              <th onClick={() => handleSort('gene_symbol')}>
                Gene
                <SortIcon $active={sortKey === 'gene_symbol'} $desc={sortDesc}>▲</SortIcon>
              </th>
              <th onClick={() => handleSort('pvalue')}>
                P SKAT-O
                <SortIcon $active={sortKey === 'pvalue'} $desc={sortDesc}>▲</SortIcon>
              </th>
              <th onClick={() => handleSort('pvalue_burden')}>
                P Burden
                <SortIcon $active={sortKey === 'pvalue_burden'} $desc={sortDesc}>▲</SortIcon>
              </th>
              <th onClick={() => handleSort('pvalue_skat')}>
                P SKAT
                <SortIcon $active={sortKey === 'pvalue_skat'} $desc={sortDesc}>▲</SortIcon>
              </th>
              <th onClick={() => handleSort('beta_burden')}>
                Beta
                <SortIcon $active={sortKey === 'beta_burden'} $desc={sortDesc}>▲</SortIcon>
              </th>
            </tr>
          </thead>
          <tbody>
            {anyLoading() ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: 20 }}>
                  Loading...
                </td>
              </tr>
            ) : queryStates.geneData?.error ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: 20, color: '#666' }}>
                  Gene burden data not available for this phenotype
                </td>
              </tr>
            ) : paginatedData.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: 20, color: '#666' }}>
                  No gene burden results found
                </td>
              </tr>
            ) : (
              paginatedData.map((gene) => {
                const isSignificant = gene.pvalue !== null && gene.pvalue < SIG_THRESHOLD;
                const hasLabel = labeledGeneIds.has(gene.gene_id);
                const isSelected = selectedGeneIds.has(gene.gene_id);

                let className = '';
                if (isSignificant) className = 'significant';
                if (isSelected) className = 'selected';

                return (
                  <tr key={gene.gene_id} className={className}>
                    <td style={{ width: 40, textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={hasLabel}
                        onChange={() => toggleGene(gene.gene_id)}
                        onClick={(e) => e.stopPropagation()}
                        title={hasLabel ? 'Remove label' : 'Add label'}
                        style={{ cursor: 'pointer' }}
                      />
                    </td>
                    <td
                      style={{ fontWeight: 500, cursor: 'pointer' }}
                      onClick={() => handleGeneClick(gene)}
                    >
                      {gene.gene_symbol}
                    </td>
                    <td onClick={() => handleGeneClick(gene)}>{formatPvalue(gene.pvalue)}</td>
                    <td onClick={() => handleGeneClick(gene)}>{formatPvalue(gene.pvalue_burden)}</td>
                    <td onClick={() => handleGeneClick(gene)}>{formatPvalue(gene.pvalue_skat)}</td>
                    <td onClick={() => handleGeneClick(gene)}>{formatBeta(gene.beta_burden)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </Table>
        {!anyLoading() && sortedData.length > PAGE_SIZE && (
          <Pagination>
            <span>
              Showing {(currentPage - 1) * PAGE_SIZE + 1}–
              {Math.min(currentPage * PAGE_SIZE, sortedData.length)} of{' '}
              {sortedData.length.toLocaleString()} genes
            </span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <PageButton
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(currentPage - 1)}
              >
                ← Previous
              </PageButton>
              <span>
                Page {currentPage} of {totalPages}
              </span>
              <PageButton
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(currentPage + 1)}
              >
                Next →
              </PageButton>
            </div>
          </Pagination>
        )}
      </TableContainer>
    </Container>
  );
};

export default PhenotypeGeneBurdenTab;
