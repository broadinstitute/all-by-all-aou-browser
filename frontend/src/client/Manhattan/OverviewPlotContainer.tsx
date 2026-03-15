import React, { useState, useCallback, useMemo } from 'react';
import { useQuery } from '@axaou/ui';
import { useRecoilState, useRecoilValue } from 'recoil';
import styled from 'styled-components';

import { OverviewManhattan } from './OverviewManhattan';
import { UnifiedLocusTable } from './UnifiedLocusTable';
import type { UnifiedOverviewResponse, UnifiedLocus, UnifiedGene } from './types';
import { axaouDevUrl, pouchDbName, cacheEnabled } from '../Query';
import { ancestryGroupAtom, selectedContigAtom } from '../sharedState';
import { useAppNavigation } from '../hooks/useAppNavigation';
import { configQuery } from '../queryStates';

const Container = styled.div`
  width: 100%;
  margin-top: 20px;
`;

const Y_AXIS_WIDTH = 50;

export interface OverviewPlotContainerProps {
  analysisId: string;
  /** Callback when a locus is clicked (for zoom navigation) */
  onLocusClick?: (contig: string, position: number, start?: number, stop?: number) => void;
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
  const { goToGene } = useAppNavigation();
  const configState = useRecoilValue(configQuery);
  // Prefer build-time env var, fall back to runtime config
  const dataVersion = (typeof process !== 'undefined' && process.env?.DATA_VERSION) || configState.data?.data_version || '';

  // State for peak selection (shared between plot and table)
  const [selectedPeakIds, setSelectedPeakIds] = useState<Set<string>>(new Set());
  const [customLabelMode, setCustomLabelMode] = useState(false);
  const [topN, setTopN] = useState(10);

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

  const clearSelection = useCallback(() => {
    setTopN(0);
    setSelectedPeakIds(new Set());
    setCustomLabelMode(false);
  }, []);

  const resetToDefault = useCallback(() => {
    setSelectedPeakIds(new Set());
    setCustomLabelMode(false);
  }, []);

  const handleSetTopN = useCallback((n: number) => {
    setTopN(n);
    setSelectedPeakIds(new Set());
    setCustomLabelMode(false);
  }, []);

  const handleGeneClick = useCallback((geneId: string) => {
    goToGene(geneId, { fromPhenotype: true });
  }, [goToGene]);

  const handlePeakClick = useCallback(
    (node: any) => {
      if (!node.peak) return;

      const peak = node.peak as UnifiedLocus;
      const SIG_THRESHOLD = 2.5e-6;

      // Helper to get best burden p-value for a gene
      const getBestBurdenPvalue = (gene: UnifiedGene): number => {
        if (!gene.burden_results || gene.burden_results.length === 0) return Infinity;
        const pvalues = gene.burden_results.flatMap(br => [
          br.pvalue ?? Infinity,
          br.pvalue_burden ?? Infinity,
          br.pvalue_skat ?? Infinity,
        ]);
        return Math.min(...pvalues);
      };

      // Helper to get coding variant count (lof + missense)
      const getCodingCount = (gene: UnifiedGene): number => {
        const genomeLof = gene.genome_coding_hits?.lof ?? 0;
        const genomeMissense = gene.genome_coding_hits?.missense ?? 0;
        const exomeLof = gene.exome_coding_hits?.lof ?? 0;
        const exomeMissense = gene.exome_coding_hits?.missense ?? 0;
        return genomeLof + genomeMissense + exomeLof + exomeMissense;
      };

      // 1. Find top gene with significant burden result
      const genesWithSigBurden = peak.genes
        .filter(g => getBestBurdenPvalue(g) < SIG_THRESHOLD)
        .sort((a, b) => getBestBurdenPvalue(a) - getBestBurdenPvalue(b));

      if (genesWithSigBurden.length > 0) {
        const topGene = genesWithSigBurden[0];
        goToGene(topGene.gene_id, { fromPhenotype: true });
        return;
      }

      // 2. Find gene with coding (lof/missense) variants
      const genesWithCoding = peak.genes
        .filter(g => getCodingCount(g) > 0)
        .sort((a, b) => getCodingCount(b) - getCodingCount(a));

      if (genesWithCoding.length > 0) {
        const topGene = genesWithCoding[0];
        goToGene(topGene.gene_id, { fromPhenotype: true });
        return;
      }

      // 3. Fall back to locus view
      if (onLocusClick) {
        onLocusClick(peak.contig, peak.position, peak.start, peak.stop);
      }
    },
    [onLocusClick, goToGene]
  );

  const handleLocusClick = useCallback(
    (contig: string, position: number, start?: number, stop?: number) => {
      onLocusClick?.(contig, position, start, stop);
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

  // Compute the default labeled IDs (mirrors the hook's implicated-first sort)
  // Used when transitioning from default→custom mode so the base set matches what's displayed
  const SIG_THRESHOLD = 2.5e-6;
  const defaultLabeledIds = useMemo(() => {
    if (customLabelMode) return selectedPeakIds;
    const isImplicated = (l: UnifiedLocus): boolean =>
      l.genes.some((g) => {
        const hasBurden = g.burden_results?.some((b) =>
          ((b.pvalue ?? Infinity) < SIG_THRESHOLD) ||
          ((b.pvalue_burden ?? Infinity) < SIG_THRESHOLD) ||
          ((b.pvalue_skat ?? Infinity) < SIG_THRESHOLD)
        );
        const hasCoding =
          ((g.genome_coding_hits?.lof ?? 0) + (g.exome_coding_hits?.lof ?? 0)) > 0 ||
          ((g.genome_coding_hits?.missense ?? 0) + (g.exome_coding_hits?.missense ?? 0)) > 0;
        return hasBurden || hasCoding;
      });
    const sorted = [...filteredLoci].sort((a, b) => {
      const aImpl = isImplicated(a);
      const bImpl = isImplicated(b);
      if (aImpl !== bImpl) return aImpl ? -1 : 1;
      const bestA = Math.min(a.pvalue_genome ?? Infinity, a.pvalue_exome ?? Infinity);
      const bestB = Math.min(b.pvalue_genome ?? Infinity, b.pvalue_exome ?? Infinity);
      return bestA - bestB;
    });
    return new Set(sorted.slice(0, topN).map((l) => `${l.contig}-${l.position}`));
  }, [filteredLoci, topN, customLabelMode, selectedPeakIds]);

  // Toggle a peak label on/off. When transitioning from default→custom mode,
  // initializes from currentLabeledIds (from plot nodes) or defaultLabeledIds (for table).
  const togglePeak = useCallback((peakId: string, currentLabeledIds?: Set<string>) => {
    setSelectedPeakIds((prev) => {
      const baseSet = customLabelMode ? prev : (currentLabeledIds ?? defaultLabeledIds);
      const next = new Set(baseSet);
      if (next.has(peakId)) {
        next.delete(peakId);
      } else {
        next.add(peakId);
      }
      return next;
    });
    setCustomLabelMode(true);
  }, [customLabelMode, defaultLabeledIds]);

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
        topN={topN}
        onPeakClick={handlePeakClick}
        onPeakToggle={(peakId, currentLabeledIds) => togglePeak(peakId, currentLabeledIds)}
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
            topN={topN}
            onSetTopN={handleSetTopN}
            onClearSelection={clearSelection}
            onResetToDefault={resetToDefault}
          />
        </div>
      )}
    </Container>
  );
};

export default OverviewPlotContainer;
