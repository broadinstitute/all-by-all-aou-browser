import { useQuery } from '@karaogram/kgui';
import styled from 'styled-components';

import { useRecoilValue } from 'recoil';
import GeneResultsPage from '../GeneResults/GeneResultsPage';
import { axaouDevUrl, cacheEnabled, pouchDbName } from '../Query';
import { analysisIdAtom, ancestryGroupAtom } from '../sharedState';
import { AnalysisMetadata } from '../types';
import { AttributeCards, AttributeList, AttributeListItem, DocumentTitle, HalfPage, Spinner, StatusMessage, TitleWithScrollButtons } from '../UserInterface';
import { getAnalysisDisplayTitle } from '../utils';
import VariantResultsPage from '../VariantResults/VariantResultsPage';
import { preparePhenotypeText } from './phenotypeUtils';

const PhenotypeInfoStyles = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  min-width: 97%;
  max-width: 97%;
  align-items: center;
  height: 100%;
  gap: 10px;
  position: relative;
  padding-top: 25px;
`;



const InfoSection = styled.div`
  width: 100%;
`;

interface PhenotypeProps {
  phenotype: AnalysisMetadata;
}

const PhenotypeInfo = ({ phenotype }: PhenotypeProps) => {
  const p = phenotype as AnalysisMetadata;

  return (
    <InfoSection>
      <DocumentTitle title={`${getAnalysisDisplayTitle(p)} | All by All Browser` || "All by All Browser"} />
      <h3 className='app-section-title pheno-info-title'>
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
    </InfoSection>
  );
}

interface Size {
  width: number;
  height: number;
}

interface PhenotypeInfoContainerProps {
  size: Size;
}

export const PhenotypeInfoContainer: React.FC<PhenotypeInfoContainerProps> = ({ size }) => {
  const ancestryGroup = useRecoilValue(ancestryGroupAtom);

  interface Data {
    analysisMetadata: AnalysisMetadata[] | null;
  }

  const analysisId = useRecoilValue(analysisIdAtom);

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

  const analysisMetadataPrepared =
    queryStates.analysisMetadata.data &&
    (preparePhenotypeText(queryStates.analysisMetadata.data[0]) as AnalysisMetadata);

  if (!analysisMetadataPrepared) {
    throw new Error('Failed to prepare phenotype text');
  }

  const analysisDisplayTitle = getAnalysisDisplayTitle(analysisMetadataPrepared)


  return (
    <PhenotypeInfoStyles>
      <PhenotypeInfo phenotype={analysisMetadataPrepared} />
      <GeneResultsPage size={size} />
      <VariantResultsPage />
      <TitleWithScrollButtons
        title={analysisDisplayTitle}
        buttons={[
          {
            targetSelector: '.pheno-info-title',
            containerSelector: '.resizable-inner-container',
            label: 'Phenotype Info',
          },
          {
            targetSelector: '.gene-results-title',
            containerSelector: '.resizable-inner-container',
            label: 'Gene Manhattan',
          },
          {
            targetSelector: '.variant-manhattan-title',
            containerSelector: '.resizable-inner-container',
            label: 'Variant Manhattan',
          },
        ]}
        width={size.width}
      />
    </PhenotypeInfoStyles>
  );
};

export default PhenotypeInfoContainer;

