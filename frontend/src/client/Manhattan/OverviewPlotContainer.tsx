import React, { useState, useCallback } from 'react';
import { useQuery } from '@axaou/ui';
import { useRecoilValue } from 'recoil';
import styled from 'styled-components';

import { OverviewManhattan } from './OverviewManhattan';
import { UnifiedLocusTable } from './UnifiedLocusTable';
import type { UnifiedOverviewResponse } from './types';
import { axaouDevUrl, pouchDbName, cacheEnabled } from '../Query';
import { ancestryGroupAtom } from '../sharedState';

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
        url: `${axaouDevUrl}/phenotype/${analysisId}/overview?ancestry=${ancestryGroup}`,
        name: 'overviewData',
      },
    ],
    deps: [analysisId, ancestryGroup],
    cacheEnabled,
  });

  // Stable callbacks for peak selection
  const togglePeak = useCallback((peakId: string) => {
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
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedPeakIds(new Set());
  }, []);

  const resetToDefault = useCallback(() => {
    setSelectedPeakIds(new Set());
    setCustomLabelMode(false);
  }, []);

  const selectAllFiltered = useCallback((ids: Set<string>) => {
    setCustomLabelMode(true);
    setSelectedPeakIds(ids);
  }, []);

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

  // Hide entirely while loading (avoids layout shift)
  if (anyLoading()) {
    return null;
  }

  // Show message if data isn't available
  if (queryStates.overviewData?.error || !queryStates.overviewData?.data) {
    return (
      <Container>
        <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
          <p>Overview data is not available for this phenotype.</p>
        </div>
      </Container>
    );
  }

  const data = queryStates.overviewData.data;

  // Construct full image URLs
  const genomeImageUrl = data.genome_image_url.startsWith('/')
    ? `${axaouDevUrl.replace('/api', '')}${data.genome_image_url}`
    : data.genome_image_url;

  const exomeImageUrl = data.exome_image_url.startsWith('/')
    ? `${axaouDevUrl.replace('/api', '')}${data.exome_image_url}`
    : data.exome_image_url;

  return (
    <Container>
      <OverviewManhattan
        genomeImageUrl={genomeImageUrl}
        exomeImageUrl={exomeImageUrl}
        unifiedLoci={data.unified_loci}
        selectedPeakIds={selectedPeakIds}
        customLabelMode={customLabelMode}
        onPeakClick={handlePeakClick}
        showYAxis={true}
      />

      {data.unified_loci.length > 0 && (
        <div style={{ marginLeft: Y_AXIS_WIDTH }}>
          <UnifiedLocusTable
            unifiedLoci={data.unified_loci}
            onLocusClick={handleLocusClick}
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
