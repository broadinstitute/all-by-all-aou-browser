import React, { useState, useCallback, useMemo } from 'react';
import { useQuery } from '@axaou/ui';
import { useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil';
import styled from 'styled-components';

import { OverviewManhattan } from './OverviewManhattan';
import { UnifiedLocusTable } from './UnifiedLocusTable';
import type { UnifiedOverviewResponse, UnifiedLocus } from './types';
import { axaouDevUrl, pouchDbName, cacheEnabled } from '../Query';
import { ancestryGroupAtom, selectedContigAtom, geneIdAtom, resultLayoutAtom } from '../sharedState';
import { configQuery } from '../queryStates';

const Container = styled.div`
  width: 100%;
  margin-top: 20px;
`;

const Y_AXIS_WIDTH = 50;

export interface OverviewPlotContainerProps {
  analysisId: string;
  /** Callback when a locus is clicked (for zoom navigation) */
  onLocusClick?: (contig: string, position: number) => void;
}

/**
 * Container component that fetches unified overview data and renders
 * the OverviewManhattan and UnifiedLocusTable components.
 */
export const OverviewPlotContainer: React.FC<OverviewPlotContainerProps> = ({
  analysisId,
  onLocusClick,
}) => {
  const ancestryGroup = useRecoilValue(ancestryGroupAtom);
  const [selectedContig, setSelectedContig] = useRecoilState(selectedContigAtom);
  const setGeneId = useSetRecoilState(geneIdAtom);
  const setResultLayout = useSetRecoilState(resultLayoutAtom);
  const configState = useRecoilValue(configQuery);
  const dataVersion = configState.data?.data_version || '';

  // State for peak selection (shared between plot and table)
  const [selectedPeakIds, setSelectedPeakIds] = useState<Set<string>>(new Set());
  const [customLabelMode, setCustomLabelMode] = useState(false);

  interface Data {
    overviewData: UnifiedOverviewResponse | null;
  }

  const { queryStates, anyLoading } = useQuery<Data>({
    dbName: pouchDbName,
    queries: [
      {
        url: `${axaouDevUrl}/phenotype/${analysisId}/overview?ancestry=${ancestryGroup}&v=${dataVersion}`,
        name: 'overviewData',
      },
    ],
    deps: [analysisId, ancestryGroup, dataVersion],
    cacheEnabled,
  });

  // Stable callbacks for peak selection
  const togglePeak = useCallback((peakId: string, allFilteredLoci?: UnifiedLocus[]) => {
    // If entering custom mode for the first time, initialize with top 10 peaks
    if (!customLabelMode && allFilteredLoci) {
      const sortedLoci = [...allFilteredLoci].sort((a, b) => {
        const bestA = Math.min(a.pvalue_genome ?? Infinity, a.pvalue_exome ?? Infinity);
        const bestB = Math.min(b.pvalue_genome ?? Infinity, b.pvalue_exome ?? Infinity);
        return bestA - bestB;
      });
      const top10Ids = new Set(sortedLoci.slice(0, 10).map((l) => `${l.contig}-${l.position}`));
      // Apply the toggle to the initialized set
      if (top10Ids.has(peakId)) {
        top10Ids.delete(peakId);
      } else {
        top10Ids.add(peakId);
      }
      setSelectedPeakIds(top10Ids);
      setCustomLabelMode(true);
      return;
    }

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
  }, [customLabelMode]);

  const clearSelection = useCallback(() => {
    setSelectedPeakIds(new Set());
    setCustomLabelMode(true);
  }, []);

  const resetToDefault = useCallback(() => {
    setSelectedPeakIds(new Set());
    setCustomLabelMode(false);
  }, []);

  const selectAllFiltered = useCallback((ids: Set<string>) => {
    setCustomLabelMode(true);
    setSelectedPeakIds(ids);
  }, []);

  const handleGeneClick = useCallback((geneId: string) => {
    setGeneId(geneId);
    setResultLayout('half');
  }, [setGeneId, setResultLayout]);

  const handlePeakClick = useCallback(
    (node: any) => {
      if (onLocusClick && node.peak) {
        onLocusClick(node.peak.contig, node.peak.position);
      }
    },
    [onLocusClick]
  );

  const handleLocusClick = useCallback(
    (contig: string, position: number) => {
      onLocusClick?.(contig, position);
    },
    [onLocusClick]
  );

  // Get data reference (may be null during loading)
  const data = queryStates.overviewData?.data ?? null;

  // Filter loci by selected chromosome (must be called unconditionally for hooks rules)
  const filteredLoci = useMemo(() => {
    if (!data) return [];
    if (selectedContig === 'all') return data.unified_loci;
    // Normalize to match backend format which generally uses 'chrN'
    const targetContig = selectedContig.startsWith('chr')
      ? selectedContig
      : `chr${selectedContig}`;
    return data.unified_loci.filter((l) => l.contig === targetContig);
  }, [data, selectedContig]);

  // Construct full image URLs with optional contig parameter and data version for cache-busting
  const contigParam = selectedContig !== 'all' ? `&contig=${selectedContig}` : '';
  const versionParam = `&v=${dataVersion}`;

  const genomeImageUrl = useMemo(() => {
    if (!data) return '';
    const separator = data.genome_image_url.includes('?') ? '' : '?';
    const baseUrl = data.genome_image_url.startsWith('/')
      ? `${axaouDevUrl.replace('/api', '')}${data.genome_image_url}`
      : data.genome_image_url;
    return `${baseUrl}${separator}${contigParam}${versionParam}`;
  }, [data, contigParam, dataVersion]);

  const exomeImageUrl = useMemo(() => {
    if (!data) return '';
    const separator = data.exome_image_url.includes('?') ? '' : '?';
    const baseUrl = data.exome_image_url.startsWith('/')
      ? `${axaouDevUrl.replace('/api', '')}${data.exome_image_url}`
      : data.exome_image_url;
    return `${baseUrl}${separator}${contigParam}${versionParam}`;
  }, [data, contigParam, dataVersion]);

  // Hide entirely while loading (avoids layout shift)
  if (anyLoading()) {
    return null;
  }

  // Show message if data isn't available
  if (queryStates.overviewData?.error || !data) {
    return (
      <Container>
        <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
          <p>Overview data is not available for this phenotype.</p>
        </div>
      </Container>
    );
  }

  return (
    <Container>
      <OverviewManhattan
        genomeImageUrl={genomeImageUrl}
        exomeImageUrl={exomeImageUrl}
        unifiedLoci={filteredLoci}
        selectedPeakIds={selectedPeakIds}
        customLabelMode={customLabelMode}
        onPeakClick={handlePeakClick}
        showYAxis={true}
        contig={selectedContig}
        onResetContig={() => setSelectedContig('all')}
        onContigClick={setSelectedContig}
      />

      {filteredLoci.length > 0 && (
        <div style={{ marginLeft: Y_AXIS_WIDTH }}>
          <UnifiedLocusTable
            unifiedLoci={filteredLoci}
            onLocusClick={handleLocusClick}
            onGeneClick={handleGeneClick}
            selectedPeakIds={selectedPeakIds}
            onTogglePeak={togglePeak}
            customLabelMode={customLabelMode}
            onClearSelection={clearSelection}
            onResetToDefault={resetToDefault}
            onSelectAllFiltered={selectAllFiltered}
          />
        </div>
      )}
    </Container>
  );
};

export default OverviewPlotContainer;
