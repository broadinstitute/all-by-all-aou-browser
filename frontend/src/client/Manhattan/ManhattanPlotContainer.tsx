import React from 'react';
import { useQuery } from '@axaou/ui';
import { useRecoilValue } from 'recoil';
import styled from 'styled-components';

import { ManhattanViewer } from './ManhattanViewer';
import type { ManhattanOverlay, SignificantHit } from './types';
import { axaouDevUrl, pouchDbName, cacheEnabled } from '../Query';
import { ancestryGroupAtom } from '../sharedState';

const Container = styled.div`
  width: 100%;
  margin-top: 20px;
`;

/** Supported plot types */
export type PlotType = 'genome_manhattan' | 'exome_manhattan' | 'gene_manhattan';

interface ManhattanPlotContainerProps {
  analysisId: string;
  /** Type of Manhattan plot to display */
  plotType?: PlotType;
  /** Callback when a significant hit is clicked */
  onHitClick?: (hit: SignificantHit) => void;
}

interface ManhattanApiResponse {
  image_url: string;
  overlay: ManhattanOverlay | null;
  has_overlay: boolean;
}

/**
 * Container component that fetches Manhattan plot data and renders the viewer.
 * Handles loading/error states and passes data to ManhattanViewer.
 * Returns null (hides entirely) when data is unavailable.
 * Supports gene, exome, and genome Manhattan plot types.
 */
export const ManhattanPlotContainer: React.FC<ManhattanPlotContainerProps> = ({
  analysisId,
  plotType = 'genome_manhattan',
  onHitClick,
}) => {
  const ancestryGroup = useRecoilValue(ancestryGroupAtom);

  interface Data {
    manhattanData: ManhattanApiResponse | null;
  }

  const { queryStates, anyLoading } = useQuery<Data>({
    dbName: pouchDbName,
    queries: [
      {
        url: `${axaouDevUrl}/phenotype/${analysisId}/manhattan?ancestry=${ancestryGroup}&plot_type=${plotType}`,
        name: 'manhattanData',
      },
    ],
    deps: [analysisId, ancestryGroup, plotType],
    cacheEnabled,
  });

  // Hide entirely while loading (avoids layout shift)
  if (anyLoading()) {
    return null;
  }

  // Hide entirely if there's an error (plot not available)
  if (queryStates.manhattanData?.error) {
    return null;
  }

  const data = queryStates.manhattanData?.data;

  // Hide entirely if no data
  if (!data) {
    return null;
  }

  // Construct the full image URL
  // The API returns a relative URL like "/api/phenotype/{id}/manhattan/image"
  // We need to make it absolute
  const imageUrl = data.image_url.startsWith('/')
    ? `${axaouDevUrl.replace('/api', '')}${data.image_url}`
    : data.image_url;

  // Create a minimal overlay if none exists (image-only mode)
  const overlay: ManhattanOverlay = data.overlay ?? {
    significant_hits: [],
    hit_count: 0,
  };

  return (
    <Container>
      <ManhattanViewer
        imageUrl={imageUrl}
        overlay={overlay}
        onHitClick={onHitClick}
        showStats={data.has_overlay}
      />
    </Container>
  );
};

export default ManhattanPlotContainer;
