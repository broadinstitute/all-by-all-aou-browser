import React from 'react';
import styled from 'styled-components';
import {
  AttributeCards,
  AttributeList,
  AttributeListItem,
} from '../UserInterface';
import { GeneConstraintTable } from './GeneConstraint';
import { GeneModels } from '../types';
import { ExternalLink } from '@gnomad/ui';

const GeneInfoStyles = styled.div`
  margin-top: 25px;
  width: 100%;
`;

interface GeneInfoProps {
  geneIdentifier: string;
  geneModel: GeneModels;
}

export const GeneInfo: React.FC<GeneInfoProps> = ({ geneIdentifier, geneModel }) => {
  return (
    <GeneInfoStyles className="gene-info">
      <h3 className="app-section-title">
        Gene Information: <strong>{geneIdentifier}</strong>
      </h3>
      <AttributeCards>
        <AttributeList labelWidth={120}>
          <h4>Gene Identifiers</h4>
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
        <AttributeList labelWidth={120}>
          {geneModel.gnomad_constraint && (
            <>
              <h4>Gene Constraint (gnomAD)</h4>
              <GeneConstraintTable gnomadConstraint={geneModel.gnomad_constraint} />
            </>
          )}
          <h4>Links</h4>
          <AttributeListItem label="AoU Data Browser">
            <ExternalLink
              href={`https://databrowser.researchallofus.org/snvindel-variants/${geneModel.symbol}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              AoU Data Browser
            </ExternalLink>
          </AttributeListItem>
          <AttributeListItem label="gnomAD">
            <ExternalLink
              href={`https://gnomad.broadinstitute.org/gene/${geneModel.gene_id}?dataset=gnomad_r4`}
              target="_blank"
              rel="noopener noreferrer"
            >
              gnomAD
            </ExternalLink>
          </AttributeListItem>
          <AttributeListItem label="Genebass/UKBB">
            <ExternalLink
              href={`https://app.genebass.org/gene/${geneModel.gene_id}/`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Genebass/UKBB
            </ExternalLink>
          </AttributeListItem>
          <AttributeListItem label="UCSC">
            <ExternalLink
              href={`https://genome.ucsc.edu/cgi-bin/hgTracks?db=hg38&position=${geneModel.chrom}%3A${geneModel?.start}-${geneModel?.stop}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              UCSC
            </ExternalLink>
          </AttributeListItem>
        </AttributeList>
      </AttributeCards>
    </GeneInfoStyles>
  );
};



