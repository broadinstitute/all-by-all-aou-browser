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
  AttributeCards,
  AttributeList,
  AttributeListItem,
  ColorMarker,
  DocumentTitle,
  HalfPage,
  ScrollButton,
  ScrollButtonContainer,
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




const VariantInfoStyles = styled.div`
  .variant-info

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

interface VariantInfoProps {
  variantData: VariantAnnotations & MissingVariantFieldsGenePage
}

const VariantInfo: React.FC<VariantInfoProps> = ({ variantData }) => {
  return (
    <VariantInfoStyles>
      <AttributeCards>
        <AttributeList labelWidth={120}>
          <h4> Variant info</h4>
          <AttributeListItem label="Consequence">
            {variantData.consequence}
          </AttributeListItem>
          {variantData.hgvsp && (
            <AttributeListItem label="HGVSp">
              {(variantData.hgvsp || '').split(':')[1]}
            </AttributeListItem>
          )}
          <AttributeListItem label="HGVSc">
            {(variantData.hgvsc || '').split(':')[1]}
          </AttributeListItem>
          <AttributeListItem label="Gene Symbol">
            {variantData.gene_symbol}
          </AttributeListItem>
          <AttributeListItem label="Gene ID">
            {variantData.gene_id}
          </AttributeListItem>
          <AttributeListItem label="Allele Count">
            {variantData.allele_count}
          </AttributeListItem>
          <AttributeListItem label="Allele Frequency">
            {variantData.allele_frequency}
          </AttributeListItem>
          <AttributeListItem label="PolyPhen">
            {variantData.polyphen2}
          </AttributeListItem>
          <AttributeListItem label="Ancestry Group">
            {variantData.ancestry_group}
          </AttributeListItem>
          <AttributeListItem label="Sequencing Type">
            {variantData.sequencing_type}
          </AttributeListItem>
          <AttributeListItem label="Position">
            {variantData.locus.position}
          </AttributeListItem>
        </AttributeList>
      </AttributeCards>
    </VariantInfoStyles>
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
        url: `${axaouDevUrl}/variants/associations/phewas/chr${variantId}?ancestryGroup=${ancestryGroup}`,
        name: 'variantAssociations',
      },
      {
        url: `${axaouDevUrl}/variants/annotations/chr${variantId}?ancestry_group=${ancestryGroup}`,
        name: 'variantAnnotations',
      },
      { url: `${axaouDevUrl}/analyses?ancestry_group=${ancestryGroup}`, name: 'analysesMetadata' },
      { url: `${axaouDevUrl}/categories`, name: 'categories' },
    ],
    deps: [variantId, ancestryGroup, sequencingType],
    cacheEnabled,
  })

  return (
    <Container>
      <h1>
        Variant Page Coming Soon.{' '}
        <a
          style={{ color: 'blue', cursor: 'pointer' }}
          onClick={() => setVariantId(null)}
        >
          Go back..
        </a>
      </h1>
    </Container>
  );

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

  const variantAnnotationsWithId = addVariantIdsToList(queryStates.variantAnnotations?.data ?? []);
  const associationsWithId = addVariantIdsToList(queryStates.variantAssociations?.data ?? []);

  console.log(queryStates)

  let variantData = variantAnnotationsWithId[0]

  if (!variantData) return <p>lksjdf</p>

  variantData = annotateWorstConsequence(variantData)

  const uniquePhenotypes = variantAssociations.data
    .map((variantAssociation) => {
      const analysisMeta = analysesMetadata.data!.find(
        (analysis) => analysis.analysis_id === variantAssociation.analysis_id // TODO: fixme should be phenoname?
      )
      console.log(analysisMeta)
      if (analysisMeta) {
        return {
          ...variantAssociation,
          ...analysisMeta,
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
    const setGeneId = useSetRecoilState(geneIdAtom)
    const setAnalysisId = useSetRecoilState(analysisIdAtom)
    const setVariantId = useSetRecoilState(variantIdAtom)
    const setRegionId = useSetRecoilState(regionIdAtom)

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
      <ScrollButtonContainer>
        <h3>Variant: {variantId}</h3>
        <ScrollButton
          targetSelector=".variant-info"
          containerSelector=".resizable-inner-container"
          label="Variant Info"
        />
        <ScrollButton
          targetSelector=".variant-phewas"
          containerSelector=".resizable-inner-container"
          label="Single Variant Associations (PheWAS)"
        />
      </ScrollButtonContainer>

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
