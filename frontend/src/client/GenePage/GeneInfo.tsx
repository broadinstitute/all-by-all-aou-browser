import React, { useState } from 'react';
import styled from 'styled-components';
import { GeneConstraintTable } from './GeneConstraint';
import { GeneModels } from '../types';

const GeneInfoStyles = styled.div`
  margin-top: 10px;
  width: 100%;
`;

const CompactHeader = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px 20px;
  margin-bottom: 8px;
  font-size: 14px;
`;

const GeneTitle = styled.h3`
  margin: 0;
  font-size: 16px;
  font-weight: 600;
`;

const InfoItem = styled.span`
  color: ${(props) => props.theme.textMuted};

  strong {
    color: ${(props) => props.theme.text};
    font-weight: 500;
  }
`;

const RegionText = styled.span`
  color: ${(props) => props.theme.textMuted};
  font-family: monospace;
  font-size: 13px;

  .chrom {
    color: ${(props) => props.theme.text};
    font-weight: 500;
  }

  .strand {
    color: ${(props) => props.theme.textMuted};
    margin-left: 4px;
  }
`;

const DetailsToggle = styled.button`
  background: none;
  border: none;
  color: var(--theme-primary, #262262);
  cursor: pointer;
  font-size: 13px;
  padding: 0;

  &:hover {
    text-decoration: underline;
  }
`;

const DetailsPanel = styled.div`
  background: ${(props) => props.theme.surfaceAlt};
  border: 1px solid ${(props) => props.theme.border};
  border-radius: 4px;
  padding: 12px 16px;
  margin-top: 8px;
  font-size: 13px;
`;

const DetailsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 8px 24px;
`;

const DetailItem = styled.div`
  display: flex;
  align-items: baseline;
  gap: 12px;

  .label {
    color: ${(props) => props.theme.textMuted};
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    min-width: 70px;
    flex-shrink: 0;
  }

  .value {
    color: ${(props) => props.theme.text};
    font-weight: 500;
  }
`;

const TranscriptValue = styled.span`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;

  .id {
    font-family: monospace;
    font-size: 12px;
  }

  .badge {
    background: #e8f5e9;
    color: #2e7d32;
    font-size: 10px;
    font-weight: 600;
    padding: 2px 6px;
    border-radius: 3px;
    text-transform: uppercase;
  }

  .separator {
    color: #ccc;
  }
`;

const LinksRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid ${(props) => props.theme.border};
`;

const LinkChip = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 10px;
  background: ${(props) => props.theme.surface};
  border: 1px solid ${(props) => props.theme.border};
  border-radius: 16px;
  color: var(--theme-primary, #262262);
  font-size: 12px;
  font-weight: 500;
  text-decoration: none;
  transition: all 0.15s ease;

  &:hover {
    background: #e3f2fd;
    border-color: var(--theme-primary, #262262);
    text-decoration: none;
  }

  &::after {
    content: '↗';
    font-size: 10px;
    opacity: 0.7;
  }
`;

interface GeneInfoProps {
  geneIdentifier: string;
  geneModel: GeneModels;
}

export const GeneInfo: React.FC<GeneInfoProps> = ({ geneIdentifier, geneModel }) => {
  const [showDetails, setShowDetails] = useState(false);

  const hasRegion = geneModel.chrom && geneModel.start && geneModel.stop;

  const transcript = geneModel.mane_select_transcript
    ? `${geneModel.mane_select_transcript.ensembl_id}.${geneModel.mane_select_transcript.ensembl_version}`
    : geneModel.canonical_transcript_id;

  return (
    <GeneInfoStyles className="gene-info">
      <CompactHeader>
        <GeneTitle>{geneModel.gencode_symbol || geneIdentifier}</GeneTitle>
        {geneModel.gene_id && (
          <InfoItem><strong>{geneModel.gene_id}</strong></InfoItem>
        )}
        {hasRegion && (
          <RegionText>
            <span className="chrom">{geneModel.chrom}</span>
            :{geneModel.start}-{geneModel.stop}
            <span className="strand">{geneModel.strand}</span>
          </RegionText>
        )}
        <DetailsToggle onClick={() => setShowDetails(!showDetails)}>
          {showDetails ? 'Hide details' : 'More details'}
        </DetailsToggle>
      </CompactHeader>

      {showDetails && (
        <DetailsPanel>
          <DetailsGrid>
            {transcript && (
              <DetailItem>
                <span className="label">Transcript</span>
                <TranscriptValue>
                  {geneModel.mane_select_transcript ? (
                    <>
                      <span className="id">
                        {geneModel.mane_select_transcript.ensembl_id}.{geneModel.mane_select_transcript.ensembl_version}
                      </span>
                      <span className="separator">|</span>
                      <span className="id">
                        {geneModel.mane_select_transcript.refseq_id}.{geneModel.mane_select_transcript.refseq_version}
                      </span>
                      <span className="badge">MANE</span>
                    </>
                  ) : (
                    <span className="id">{transcript}</span>
                  )}
                </TranscriptValue>
              </DetailItem>
            )}
            {geneModel.hgnc_id && (
              <DetailItem>
                <span className="label">HGNC</span>
                <span className="value">{geneModel.hgnc_id}</span>
              </DetailItem>
            )}
            {geneModel.omim_id && (
              <DetailItem>
                <span className="label">OMIM</span>
                <span className="value">{geneModel.omim_id}</span>
              </DetailItem>
            )}
            {geneModel.reference_genome && (
              <DetailItem>
                <span className="label">Reference</span>
                <span className="value">{geneModel.reference_genome}</span>
              </DetailItem>
            )}
          </DetailsGrid>

          {geneModel.gnomad_constraint && (
            <div style={{ marginTop: 12 }}>
              <strong style={{ fontSize: 13, color: '#333' }}>Constraint</strong>
              <GeneConstraintTable gnomadConstraint={geneModel.gnomad_constraint} />
            </div>
          )}

          <LinksRow>
            <LinkChip
              href={`https://databrowser.researchallofus.org/snvindel-variants/${geneModel.symbol}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              AoU Data Browser
            </LinkChip>
            <LinkChip
              href={`https://gnomad.broadinstitute.org/gene/${geneModel.gene_id}?dataset=gnomad_r4`}
              target="_blank"
              rel="noopener noreferrer"
            >
              gnomAD
            </LinkChip>
            <LinkChip
              href={`https://app.genebass.org/gene/${geneModel.gene_id}/`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Genebass
            </LinkChip>
            <LinkChip
              href={`https://genome.ucsc.edu/cgi-bin/hgTracks?db=hg38&position=${geneModel.chrom}%3A${geneModel?.start}-${geneModel?.stop}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              UCSC
            </LinkChip>
          </LinksRow>
        </DetailsPanel>
      )}
    </GeneInfoStyles>
  );
};
