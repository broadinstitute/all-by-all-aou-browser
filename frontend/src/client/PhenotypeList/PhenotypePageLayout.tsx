import React, { useState } from 'react';
import { useQuery } from '@axaou/ui';
import styled from 'styled-components';
import { useRecoilValue, useSetRecoilState } from 'recoil';

import { ManhattanPlotContainer } from '../Manhattan';
import type { PlotType } from '../Manhattan/ManhattanPlotContainer';
import type { SignificantHit } from '../Manhattan/types';
import { axaouDevUrl, cacheEnabled, pouchDbName } from '../Query';
import { analysisIdAtom, ancestryGroupAtom, geneIdAtom } from '../sharedState';
import { AnalysisMetadata } from '../types';
import {
  AttributeCards,
  AttributeList,
  AttributeListItem,
  DocumentTitle,
  HalfPage,
  Spinner,
  StatusMessage,
} from '../UserInterface';
import { getAnalysisDisplayTitle } from '../utils';
import { preparePhenotypeText } from './phenotypeUtils';
import GeneResultsTable from '../GeneResults/GeneResultsTable';
import getColumns from '../GeneResults/geneResultColumns';
import { processGeneBurden } from '../utils';

const PageContainer = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  min-width: 97%;
  max-width: 97%;
  align-items: center;
  height: 100%;
  gap: 10px;
  position: relative;
`;

const TabContainer = styled.div`
  display: flex;
  flex-direction: row;
  width: 100%;
  border-bottom: 2px solid #e0e0e0;
  margin-bottom: 20px;
`;

const Tab = styled.button<{ $active: boolean }>`
  padding: 12px 24px;
  font-size: 14px;
  font-family: GothamBook, sans-serif;
  background-color: ${({ $active }) => ($active ? '#262262' : 'transparent')};
  color: ${({ $active }) => ($active ? 'white' : '#262262')};
  border: none;
  border-bottom: ${({ $active }) =>
    $active ? '3px solid #262262' : '3px solid transparent'};
  cursor: pointer;
  transition: all 0.2s ease;
  font-weight: ${({ $active }) => ($active ? 'bold' : 'normal')};

  &:hover {
    background-color: ${({ $active }) => ($active ? '#262262' : '#f0f0f0')};
  }
`;

const HeaderSection = styled.div`
  width: 100%;
  margin-bottom: 10px;
`;

const ContentSection = styled.div`
  width: 100%;
`;

interface PhenotypeHeaderProps {
  phenotype: AnalysisMetadata;
}

const PhenotypeHeader: React.FC<PhenotypeHeaderProps> = ({ phenotype }) => {
  const p = phenotype;

  return (
    <HeaderSection>
      <DocumentTitle
        title={`${getAnalysisDisplayTitle(p)} | All by All Browser` || 'All by All Browser'}
      />
      <h3 className="app-section-title pheno-info-title">
        Phenotype: {p.description}
      </h3>
      <AttributeCards>
        <AttributeList labelWidth={120}>
          <h4>Phenotype Description</h4>
          {p.analysis_id && (
            <AttributeListItem label="Phenotype ID">{p.analysis_id}</AttributeListItem>
          )}
          {p.description && (
            <AttributeListItem label="Description">{p.description}</AttributeListItem>
          )}
          {p.trait_type && (
            <AttributeListItem label="Trait type">{p.trait_type}</AttributeListItem>
          )}
          {p.pheno_sex && (
            <AttributeListItem label="Sexes">{p.pheno_sex}</AttributeListItem>
          )}
          {p.category && (
            <AttributeListItem label="Category">{p.category}</AttributeListItem>
          )}
        </AttributeList>
        <AttributeList labelWidth={120}>
          <h4>Analysis Details</h4>
          {p.n_cases !== null && (
            <AttributeListItem label="N cases">{p.n_cases}</AttributeListItem>
          )}
          {p.n_controls !== null && p.n_controls !== 0 && (
            <AttributeListItem label="N controls">{p.n_controls}</AttributeListItem>
          )}
          {p.lambda_gc_acaf !== null && (
            <AttributeListItem label="Lambda GC Acaf">
              {p.lambda_gc_acaf.toFixed(2)}
            </AttributeListItem>
          )}
          {p.lambda_gc_exome !== null && (
            <AttributeListItem label="Lambda GC Exome">
              {p.lambda_gc_exome.toFixed(2)}
            </AttributeListItem>
          )}
          {p.lambda_gc_gene_burden_001 !== null && (
            <AttributeListItem label="Lambda GC Gene Burden (001)">
              {p.lambda_gc_gene_burden_001.toFixed(2)}
            </AttributeListItem>
          )}
        </AttributeList>
      </AttributeCards>
    </HeaderSection>
  );
};

type TabKey = 'overview' | 'gene-burden' | 'exome-variants' | 'genome-variants';

interface TabConfig {
  key: TabKey;
  label: string;
  plotType?: PlotType;
}

const TABS: TabConfig[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'gene-burden', label: 'Gene Burden', plotType: 'gene_manhattan' },
  { key: 'exome-variants', label: 'Exome Variants', plotType: 'exome_manhattan' },
  { key: 'genome-variants', label: 'Genome Variants', plotType: 'genome_manhattan' },
];

interface Size {
  width: number;
  height: number;
}

interface PhenotypePageLayoutProps {
  size: Size;
}

export const PhenotypePageLayout: React.FC<PhenotypePageLayoutProps> = ({ size }) => {
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const ancestryGroup = useRecoilValue(ancestryGroupAtom);
  const analysisId = useRecoilValue(analysisIdAtom);
  const setGeneId = useSetRecoilState(geneIdAtom);

  interface Data {
    analysisMetadata: AnalysisMetadata[] | null;
  }

  const { queryStates, anyLoading } = useQuery<Data>({
    dbName: pouchDbName,
    queries: [
      {
        url: `${axaouDevUrl}/analyses/${analysisId}?ancestry_group=${ancestryGroup}`,
        name: 'analysisMetadata',
      },
    ],
    deps: [analysisId],
    cacheEnabled,
  });

  if (anyLoading()) {
    return (
      <HalfPage>
        <Spinner />
      </HalfPage>
    );
  }

  if (!queryStates.analysisMetadata.data) {
    return (
      <HalfPage>
        <StatusMessage>No Data Found</StatusMessage>
      </HalfPage>
    );
  }

  const analysisMetadataPrepared = preparePhenotypeText(
    queryStates.analysisMetadata.data[0]
  ) as AnalysisMetadata;

  if (!analysisMetadataPrepared) {
    throw new Error('Failed to prepare phenotype text');
  }

  const handleHitClick = (hit: SignificantHit) => {
    if (hit.hit_type === 'gene' && hit.id) {
      setGeneId(hit.id);
    }
  };

  const renderTabContent = () => {
    const tabConfig = TABS.find((t) => t.key === activeTab);

    if (activeTab === 'overview') {
      return (
        <div>
          <p style={{ padding: '20px', color: '#666' }}>
            Select a tab above to view Manhattan plots and association data for this phenotype.
          </p>
        </div>
      );
    }

    if (tabConfig?.plotType) {
      return (
        <ManhattanPlotContainer
          analysisId={analysisMetadataPrepared.analysis_id}
          plotType={tabConfig.plotType}
          onHitClick={handleHitClick}
        />
      );
    }

    return null;
  };

  return (
    <PageContainer>
      <PhenotypeHeader phenotype={analysisMetadataPrepared} />
      <TabContainer>
        {TABS.map((tab) => (
          <Tab
            key={tab.key}
            $active={activeTab === tab.key}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </Tab>
        ))}
      </TabContainer>
      <ContentSection>{renderTabContent()}</ContentSection>
    </PageContainer>
  );
};

export default PhenotypePageLayout;
