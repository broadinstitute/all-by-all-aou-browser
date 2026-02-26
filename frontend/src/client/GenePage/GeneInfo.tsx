import React, { useState } from 'react';
import styled from 'styled-components';
import {
  AttributeList,
  AttributeListItem,
} from '../UserInterface';
import { GeneConstraintTable } from './GeneConstraint';
import { GeneModels } from '../types';
import { ExternalLink } from '@gnomad/ui';

const GeneInfoStyles = styled.div`
  margin-top: 10px;
  width: 100%;
`;

const TabContainer = styled.div`
  display: flex;
  border-bottom: 1px solid #ddd;
  margin-bottom: 10px;
`;

const Tab = styled.button<{ $active: boolean }>`
  padding: 8px 16px;
  border: none;
  background: ${({ $active }) => ($active ? '#fff' : '#f5f5f5')};
  border-bottom: ${({ $active }) => ($active ? '2px solid #262262' : '2px solid transparent')};
  cursor: pointer;
  font-size: 14px;
  font-weight: ${({ $active }) => ($active ? 'bold' : 'normal')};
  color: ${({ $active }) => ($active ? '#262262' : '#666')};

  &:hover {
    background: #fff;
  }
`;

const TabContent = styled.div`
  padding: 10px 0;
`;

const LinksList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 15px;
`;

interface GeneInfoProps {
  geneIdentifier: string;
  geneModel: GeneModels;
}

type TabType = 'identifiers' | 'constraint' | 'links';

export const GeneInfo: React.FC<GeneInfoProps> = ({ geneIdentifier, geneModel }) => {
  const [activeTab, setActiveTab] = useState<TabType>('identifiers');

  return (
    <GeneInfoStyles className="gene-info">
      <h3 className="app-section-title" style={{ marginBottom: 10 }}>
        Gene: <strong>{geneIdentifier}</strong>
      </h3>
      <TabContainer>
        <Tab $active={activeTab === 'identifiers'} onClick={() => setActiveTab('identifiers')}>
          Identifiers
        </Tab>
        {geneModel.gnomad_constraint && (
          <Tab $active={activeTab === 'constraint'} onClick={() => setActiveTab('constraint')}>
            Constraint
          </Tab>
        )}
        <Tab $active={activeTab === 'links'} onClick={() => setActiveTab('links')}>
          Links
        </Tab>
      </TabContainer>

      <TabContent>
        {activeTab === 'identifiers' && (
          <AttributeList labelWidth={120}>
            {geneModel.reference_genome && (
              <AttributeListItem label="Reference">
                {geneModel.reference_genome}
              </AttributeListItem>
            )}
            {geneModel.gene_id && (
              <AttributeListItem label="Gene ID">
                {geneModel.gene_id}
              </AttributeListItem>
            )}
            {(() => {
              const transcript =
                geneModel.mane_select_transcript ||
                geneModel.preferred_transcript_id ||
                geneModel.canonical_transcript_id;

              return transcript ? (
                <AttributeListItem label="Transcript ID">
                  {geneModel.mane_select_transcript ? (
                    <>
                      {geneModel.mane_select_transcript.ensembl_id}.
                      {geneModel.mane_select_transcript.ensembl_version} /
                      {geneModel.mane_select_transcript.refseq_id}.
                      {geneModel.mane_select_transcript.refseq_version} (MANE)
                    </>
                  ) : (
                    <>{transcript} (canonical)</>
                  )}
                </AttributeListItem>
              ) : null;
            })()}
            {geneModel.gencode_symbol && (
              <AttributeListItem label="Symbol">
                {geneModel.gencode_symbol}
              </AttributeListItem>
            )}
            {geneModel.chrom && geneModel?.start && geneModel?.stop && geneModel?.strand && (
              <AttributeListItem label="Region">
                {`${geneModel.chrom}:${geneModel.start}-${geneModel.stop} (${geneModel.strand})`}
              </AttributeListItem>
            )}
            {geneModel.hgnc_id && (
              <AttributeListItem label="HGNC ID">
                {geneModel.hgnc_id}
              </AttributeListItem>
            )}
            {geneModel.omim_id && (
              <AttributeListItem label="OMIM ID">
                {geneModel.omim_id}
              </AttributeListItem>
            )}
          </AttributeList>
        )}

        {activeTab === 'constraint' && geneModel.gnomad_constraint && (
          <GeneConstraintTable gnomadConstraint={geneModel.gnomad_constraint} />
        )}

        {activeTab === 'links' && (
          <LinksList>
            <ExternalLink
              href={`https://databrowser.researchallofus.org/snvindel-variants/${geneModel.symbol}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              AoU Data Browser
            </ExternalLink>
            <ExternalLink
              href={`https://gnomad.broadinstitute.org/gene/${geneModel.gene_id}?dataset=gnomad_r4`}
              target="_blank"
              rel="noopener noreferrer"
            >
              gnomAD
            </ExternalLink>
            <ExternalLink
              href={`https://app.genebass.org/gene/${geneModel.gene_id}/`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Genebass/UKBB
            </ExternalLink>
            <ExternalLink
              href={`https://genome.ucsc.edu/cgi-bin/hgTracks?db=hg38&position=${geneModel.chrom}%3A${geneModel?.start}-${geneModel?.stop}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              UCSC
            </ExternalLink>
          </LinksList>
        )}
      </TabContent>
    </GeneInfoStyles>
  );
};



