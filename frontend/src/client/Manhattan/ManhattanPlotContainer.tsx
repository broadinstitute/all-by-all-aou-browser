import React from 'react';
import { useQuery } from '@axaou/ui';
import { useRecoilState, useRecoilValue } from 'recoil';
import styled from 'styled-components';

import { ManhattanViewer } from './ManhattanViewer';
import type { ManhattanOverlay, SignificantHit } from './types';
import { axaouDevUrl, pouchDbName, cacheEnabled } from '../Query';
import { ancestryGroupAtom, selectedContigAtom } from '../sharedState';

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
  /** Callback when a peak label is clicked */
  onPeakClick?: (peak: any) => void;
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
  onPeakClick,
}) => {
  const ancestryGroup = useRecoilValue(ancestryGroupAtom);
  const [contig, setContig] = useRecoilState(selectedContigAtom);

  interface Data {
    manhattanData: ManhattanApiResponse | null;
  }

  const { queryStates, anyLoading } = useQuery<Data>({
    dbName: pouchDbName,
    queries: [
      {
        url: `${axaouDevUrl}/phenotype/${analysisId}/manhattan?ancestry=${ancestryGroup}&plot_type=${plotType}&contig=${contig}`,
        name: 'manhattanData',
      },
    ],
    deps: [analysisId, ancestryGroup, plotType, contig],
    cacheEnabled,
  });

  // Hide entirely while loading (avoids layout shift)
  if (anyLoading()) {
    return null;
  }

  // Show message if per-chromosome data isn't available
  if (queryStates.manhattanData?.error || !queryStates.manhattanData?.data) {
    // If we're viewing a specific chromosome and it failed, show a message with option to go back
    if (contig !== 'all') {
      return (
        <Container>
          <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
            <p>Per-chromosome Manhattan plot for <strong>{contig}</strong> is not available.</p>
            <button
              onClick={() => setContig('all')}
              style={{
                marginTop: '10px',
                padding: '8px 16px',
                cursor: 'pointer',
                borderRadius: '4px',
                border: '1px solid #ccc',
                background: '#fff',
              }}
            >
              &larr; Back to genome-wide view
            </button>
          </div>
        </Container>
      );
    }
    // For genome-wide view errors, hide entirely
    return null;
  }

  const data = queryStates.manhattanData?.data;

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
        onPeakClick={onPeakClick}
        showStats={data.has_overlay}
        contig={contig}
        onContigClick={setContig}
      />
    </Container>
  );
};

export default ManhattanPlotContainer;
