/* eslint-disable no-shadow */
/* eslint-disable camelcase */
//
import { Button } from '@gnomad/ui'
import { useQuery } from '@axaou/ui'
import React from 'react'
import { withSize } from 'react-sizeme'
import { useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil'
import styled from 'styled-components'
import { getPhenotypeColumns } from '../PhenotypeList/PhenotypeTable'
import { modifyCategoryColor } from '../PhenotypeList/phenotypeUtils'
import Phewas from '../PhenotypeList/Phewas'
import { axaouDevUrl, cacheEnabled, pouchDbName } from '../Query'
import {
  analysisIdAtom,
  ancestryGroupAtom,
  AncestryGroupCodes,
  burdenSetAtom,
  geneIdAtom,
  hoveredAnalysisAtom,
  phewasOptsAtom,
  regionIdAtom,
  resultLayoutAtom,
  selectedAnalyses,
  selectedAnalysesColorsSelector,
  sequencingTypeAtom,
  showSelectAnalysesOnlyAtom,
  useToggleSelectedAnalysis,
  variantIdAtom,
} from '../sharedState'
import { AnalysisCategories, AnalysisMetadata, MissingVariantFieldsGenePage, VariantAnnotations, VariantAssociations, VariantJoined } from '../types'
import {
  ColorMarker,
  DocumentTitle,
  HalfPage,
  Spinner,
  StatusMessage
} from '../UserInterface'
import { addVariantIdsToList, annotateWorstConsequence, genericMerge } from '../utils'
import { getConsequenceColor } from '../VariantList/variantTableColumns'
import { hoveredVariantAtom } from '../variantState'

const Container = styled(HalfPage)`
  h3 {
    width: 100%;
  }
`




const VariantInfoWrapper = styled.div`
  width: 100%;
  margin-top: 4px;
  margin-bottom: 12px;
`;

const CompactHeader = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px 20px;
  font-size: 14px;
`;

const InfoItem = styled.span`
  color: ${(props) => props.theme.textMuted};

  strong {
    color: ${(props) => props.theme.text};
    font-weight: 500;
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
    min-width: 90px;
    flex-shrink: 0;
  }

  .value {
    color: ${(props) => props.theme.text};
    font-weight: 500;
    font-family: monospace;
    font-size: 12px;
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

interface VariantInfoProps {
  variantData: VariantAnnotations & MissingVariantFieldsGenePage
}

const VariantInfo: React.FC<VariantInfoProps> = ({ variantData }) => {
  const [showDetails, setShowDetails] = React.useState(false);
  const consequenceColor = getConsequenceColor(variantData.consequence);

  return (
    <VariantInfoWrapper>
      <CompactHeader>
        <InfoItem><strong>{variantData.gene_symbol}</strong></InfoItem>
        {variantData.consequence && (
          <InfoItem style={{ display: 'inline-flex', alignItems: 'baseline' }}>
            <ColorMarker color={consequenceColor} style={{ position: 'relative', top: '1px' }} />
            {variantData.consequence.replace(/_/g, ' ')}
          </InfoItem>
        )}
        {variantData.hgvsp && (
          <InfoItem style={{ fontFamily: 'monospace', fontSize: 13 }}>
            {(variantData.hgvsp || '').split(':')[1]}
          </InfoItem>
        )}
        <InfoItem>
          {variantData.locus?.contig || ''}:{variantData.locus?.position?.toLocaleString()}
        </InfoItem>
        <DetailsToggle onClick={() => setShowDetails(!showDetails)}>
          {showDetails ? 'Hide details' : 'More details'}
        </DetailsToggle>
      </CompactHeader>

      {showDetails && (
        <DetailsPanel>
          <DetailsGrid>
            {variantData.hgvsc && (
              <DetailItem>
                <span className="label">HGVSc</span>
                <span className="value">{(variantData.hgvsc || '').split(':')[1]}</span>
              </DetailItem>
            )}
            <DetailItem>
              <span className="label">Gene ID</span>
              <span className="value">{variantData.gene_id}</span>
            </DetailItem>
            <DetailItem>
              <span className="label">AC / AN</span>
              <span className="value">
                {variantData.allele_count?.toLocaleString() ?? '—'} / {variantData.allele_number?.toLocaleString() ?? '—'}
              </span>
            </DetailItem>
            <DetailItem>
              <span className="label">Allele Freq</span>
              <span className="value">
                {variantData.allele_frequency != null
                  ? Number(variantData.allele_frequency).toExponential(3)
                  : '—'}
              </span>
            </DetailItem>
            <DetailItem>
              <span className="label">Hom Count</span>
              <span className="value">{variantData.homozygote_count?.toLocaleString() ?? '—'}</span>
            </DetailItem>
            <DetailItem>
              <span className="label">Ancestry</span>
              <span className="value">{variantData.ancestry_group?.toUpperCase() || '—'}</span>
            </DetailItem>
            {variantData.polyphen2 && (
              <DetailItem>
                <span className="label">PolyPhen</span>
                <span className="value">{variantData.polyphen2}</span>
              </DetailItem>
            )}
            {variantData.lof && (
              <DetailItem>
                <span className="label">LOFTEE</span>
                <span className="value">{variantData.lof}</span>
              </DetailItem>
            )}
          </DetailsGrid>
          <LinksRow>
            <LinkChip
              href={`https://gnomad.broadinstitute.org/variant/${variantData.variant_id}?dataset=gnomad_r4`}
              target="_blank"
              rel="noopener noreferrer"
            >
              gnomAD
            </LinkChip>
            <LinkChip
              href={`https://genome.ucsc.edu/cgi-bin/hgTracks?db=hg38&position=chr${variantData.locus?.contig}%3A${variantData.locus?.position}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              UCSC
            </LinkChip>
            <LinkChip
              href={`https://databrowser.researchallofus.org/snvindel-variants/${variantData.gene_symbol}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              AoU Data Browser
            </LinkChip>
          </LinksRow>
        </DetailsPanel>
      )}
    </VariantInfoWrapper>
  );
};


const ConnectedVariantPhewas = ({ size }: any) => {
  const { width } = size

  const analyses = useRecoilValue(selectedAnalyses)
  const [variantId, setVariantId] = useRecoilState(variantIdAtom)
  const [burdenSet, setBurdenSet] = useRecoilState(burdenSetAtom)
  const toggleSelectedAnalysis = useToggleSelectedAnalysis()
  const resultLayout = useRecoilValue(resultLayoutAtom)
  const showPhewasControls = useRecoilValue(phewasOptsAtom)
  const analysesColors = useRecoilValue(selectedAnalysesColorsSelector)
  const showSelectAnalysesOnly = useRecoilValue(showSelectAnalysesOnlyAtom)
  const [ancestryGroup, setAncestryGroup] = useRecoilState(ancestryGroupAtom)
  const sequencingType = useRecoilValue(sequencingTypeAtom)
  const setHoveredVariant = useSetRecoilState(hoveredVariantAtom)
  const setHoveredAnalysis = useSetRecoilState(hoveredAnalysisAtom)
  const setGeneId = useSetRecoilState(geneIdAtom)
  const setAnalysisId = useSetRecoilState(analysisIdAtom)
  const setRegionId = useSetRecoilState(regionIdAtom)

  interface Data {
    variantAssociations: VariantAssociations[]
    variantAnnotations: VariantAnnotations[]
    analysesMetadata: AnalysisMetadata[]
    categories: AnalysisCategories[]
  }

  if (!variantId) {
    throw Error('Variant ID not defined')
  }

  const { queryStates, anyLoading } = useQuery<Data>({
    dbName: pouchDbName,
    queries: [
      {
        url: `${axaouDevUrl}/variants/associations/phewas/${variantId}`,
        name: 'variantAssociations',
      },
      {
        url: `${axaouDevUrl}/variants/annotations/${variantId}?extended=true`,
        name: 'variantAnnotations',
      },
      { url: `${axaouDevUrl}/analyses?ancestry_group=${ancestryGroup}`, name: 'analysesMetadata' },
      { url: `${axaouDevUrl}/categories`, name: 'categories' },
    ],
    deps: [variantId, ancestryGroup, sequencingType],
    cacheEnabled,
  })

  if (anyLoading()) {
    return (
      <Container>
        <Spinner />
      </Container>
    )
  }

  if (queryStates.variantAssociations.error) {
    const variantPhewasError = queryStates.variantAssociations.error
    if (
      variantPhewasError.status == 404 &&
      variantPhewasError.response &&
      variantPhewasError.response.detail
    ) {
      const detailMatch = variantPhewasError.response.detail.match(/ancestries: \[(.*?)\]/)
      const ancestries: AncestryGroupCodes[] = detailMatch
        ? detailMatch[1].split(', ').map((a: string) => a.replace(/'/g, ''))
        : []

      return (
        <Container>
          <StatusMessage>
            <strong>{variantId}</strong> not found in ancestry group:{' '}
            <strong>{ancestryGroup.toUpperCase()}</strong>
          </StatusMessage>
          {ancestries.length > 0 && (
            <div>
              <strong>Select an ancestry group where this variant is found:</strong>
              {ancestries.map((ancestry) => (
                <Button key={ancestry} onClick={() => setAncestryGroup(ancestry)}>
                  {ancestry.toUpperCase()}
                </Button>
              ))}
            </div>
          )}
        </Container>
      )
    }
    return (
      <Container>
        <StatusMessage>An error has occurred {variantPhewasError.message}</StatusMessage>
      </Container>
    )
  }

  const { variantAnnotations, variantAssociations, analysesMetadata, categories } = queryStates

  if (
    !variantAnnotations.data ||
    !variantAssociations.data ||
    !analysesMetadata.data ||
    !categories.data
  ) {
    return (
      <Container>
        <StatusMessage>No Data Found</StatusMessage>
      </Container>
    )
  }

  const rawAnnotation = queryStates.variantAnnotations?.data;
  const annotationArray = Array.isArray(rawAnnotation) ? rawAnnotation : (rawAnnotation ? [rawAnnotation] : []);
  const variantAnnotationsWithId = addVariantIdsToList(annotationArray);
  const associationsWithId = addVariantIdsToList(queryStates.variantAssociations?.data ?? []);

  console.log(queryStates)

  let variantData = variantAnnotationsWithId[0]

  if (!variantData) return <p>lksjdf</p>

  variantData = annotateWorstConsequence(variantData)

  const uniquePhenotypes = variantAssociations.data
    .map((variantAssociation) => {
      // Backend maps phenotype to 'phenotype', fall back to 'analysis_id' just in case
      const assocAnalysisId = (variantAssociation as any).phenotype || variantAssociation.analysis_id;
      const analysisMeta = analysesMetadata.data!.find(
        (analysis) => analysis.analysis_id === assocAnalysisId
      )

      if (analysisMeta) {
        return {
          ...variantAssociation,
          ...analysisMeta,
          analysis_id: analysisMeta.analysis_id,
          phenocode: analysisMeta.analysis_id,
          BETA: variantAssociation.beta,
          pvalue: variantAssociation.pvalue,
        }
      }
      return null
    })
    .filter((item: any): item is any => item !== null)

  console.log(uniquePhenotypes)

  const categoriesPrepared = categories.data.map(modifyCategoryColor)

  const [chrom, pos, ref, alt] = variantData.variant_id.split('-')

  const start = Number(pos) - 300000
  const stop = Number(pos) + 300000

  const mediumBreakpointMinWidth = 500
  const mediumBreakpoint = showPhewasControls
    ? mediumBreakpointMinWidth + 350
    : mediumBreakpointMinWidth

  const baseColumns = [
    'description_with_link',
    'info',
    'pval_variant',
    'select',
    'show_phewas_variant_exome',
  ]

  const mediumColumns =
    // resultLayout === 'full-phewas' || resultLayout === 'expanded-phewas'
    size.width > mediumBreakpoint ? ['BETA', 'n_cases', 'n_controls'] : []

  const wideColumns = resultLayout === 'full' ? ['phenotype', 'trait_type', 'sex', 'category'] : []

  const columns = [...baseColumns, ...mediumColumns, ...wideColumns]

  const phenotypesInVariantColumns = getPhenotypeColumns({
    columns,
    gene: { gene: { gene_id: variantData.gene_id } },
    region: { chrom, start, stop, ref, alt },
    variantId,
    width,
    history,
    selectedAnalyses: analyses,
    toggleSelectedAnalysis,
    analysesColors,
    showSelectAnalysesOnly,
  })
  const onPointClick = (phenotype: any) => {
    setGeneId(variantData.gene_id)
    setAnalysisId(phenotype.analysis_id)
    setVariantId(variantId)
    setRegionId(null)
  }

  const onHoverAnalysis = (analysisId: string) => {
    setHoveredAnalysis(analysisId)
    setHoveredVariant(variantId)
  }

  return (
    <Container>
      <DocumentTitle title={variantId} />
      <h3>Variant: {variantId}</h3>
      <VariantInfo variantData={variantData} />

      <h3 className='app-section-title .variant-phewas'>
        {uniquePhenotypes && uniquePhenotypes.length} single variant associations with{' '}
        <strong>{variantData.variant_id}</strong>
      </h3>
      <Phewas
        uniquePhenotypes={uniquePhenotypes}
        categories={categoriesPrepared}
        burdenSet={burdenSet}
        setBurdenSet={setBurdenSet}
        availableAncestries={[]}
        columns={phenotypesInVariantColumns}
        onPointClick={onPointClick}
        onHoverAnalysis={onHoverAnalysis}
        exportFileName={`variant-phewas-exomes_${variantId}`}
        phewasType='variant'
        size={size}
      />
      {/* {warnings} */}
    </Container>
  )
}
export default withSize()(ConnectedVariantPhewas) as React.FC
