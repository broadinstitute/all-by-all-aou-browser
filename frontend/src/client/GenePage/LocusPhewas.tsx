/* eslint-disable no-shadow */
/* eslint-disable camelcase */
//
import { Button } from '@gnomad/ui'
import { useQuery } from '@karaogram/kgui'
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
import { AnalysisCategories, AnalysisMetadata, VariantAssociations } from '../types'
import {
  DocumentTitle,
  HalfPage,
  ScrollButton,
  ScrollButtonContainer,
  Spinner,
  StatusMessage,
  Titles
} from '../UserInterface'
import { hoveredVariantAtom } from '../variantState'

const Container = styled(HalfPage)`
  h3 {
    width: 100%;
  }
`

const LocusPhewasData = ({ size }: any) => {
  const { width } = size

  const analyses = useRecoilValue(selectedAnalyses)
  const regionId = useRecoilValue(regionIdAtom)
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
  const setAnalysisId = useSetRecoilState(analysisIdAtom)

  interface Data {
    variantAssociations: VariantAssociations[]
    analysesMetadata: AnalysisMetadata[]
    categories: AnalysisCategories[]
  }


  const { queryStates, anyLoading } = useQuery<Data>({
    dbName: pouchDbName,
    queries: [
      {
        url: `${axaouDevUrl}/variants/associations/phewas/interval/${regionId}?ancestry_group=${ancestryGroup}`,
        name: 'variantAssociations',
      },
      { url: `${axaouDevUrl}/analyses?ancestry_group=${ancestryGroup}&ancestry_group=${ancestryGroup}`, name: 'analysesMetadata' },
      { url: `${axaouDevUrl}/categories`, name: 'categories' },
    ],
    deps: [regionId, ancestryGroup, sequencingType],
    cacheEnabled,
  })

  if (anyLoading()) {
    return (
      <Container>
        <Spinner />
      </Container>
    )
  }

  const { variantAssociations, analysesMetadata, categories } = queryStates

  if (
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

  const availableAncestries: AncestryGroupCodes[] = []

  const variantPhewasForAncestry = variantAssociations.data.find(
    (phewas) => phewas.ancestry_group === ancestryGroup
  )

  // if (!variantPhewasForAncestry) {
  //   return (
  //     <Container>
  //       <StatusMessage>
  //         Variant Phewas not found for 
  //       </StatusMessage>
  //       <div>
  //         <strong>Select an ancestry group where this variant is found:</strong>
  //         {availableAncestries.map((ancestry) => (
  //           <Button key={ancestry} onClick={() => setAncestryGroup(ancestry)}>
  //             {ancestry.toUpperCase()}
  //           </Button>
  //         ))}
  //       </div>
  //     </Container>
  //   )
  // }

  const uniquePhenotypes = Object.values(
    variantAssociations.data.reduce((acc, variantAssociation) => {
      const analysisMeta = analysesMetadata.data!.find(
        (analysis) => analysis.analysis_id === variantAssociation.analysis_id
      );
      if (analysisMeta) {
        const { analysis_id } = variantAssociation;
        if (!acc[analysis_id]) {
          acc[analysis_id] = {
            ...variantAssociation,
            ...analysisMeta,
            phenocode: analysisMeta.analysis_id,
            pvalue: variantAssociation.pvalue,
            beta: null,
            variant_count: 1,
          };
        } else {
          acc[analysis_id].variant_count += 1;
          acc[analysis_id].pvalue = Math.min(acc[analysis_id].pvalue, variantAssociation.pvalue);
        }
      }
      return acc;
    }, {} as Record<string, any>)
  ).filter((item: any) => item !== null);

  const categoriesPrepared = categories.data.map(modifyCategoryColor)


  const mediumBreakpointMinWidth = 500
  const mediumBreakpoint = showPhewasControls
    ? mediumBreakpointMinWidth + 350
    : mediumBreakpointMinWidth

  const baseColumns = [
    'description_with_link',
    'info',
    'variant_count',
    'pval_variant_min',
    'select',
    'show_phewas_locus',
  ]

  const mediumColumns =
    // resultLayout === 'full-phewas' || resultLayout === 'expanded-phewas'
    size.width > mediumBreakpoint ? ['n_cases', 'n_controls'] : []

  const wideColumns = resultLayout === 'full' ? ['phenotype', 'trait_type', 'sex', 'category'] : []

  const columns = [...baseColumns, ...mediumColumns, ...wideColumns]

  const phenotypesInVariantColumns = getPhenotypeColumns({
    columns,
    width,
    history,
    selectedAnalyses: analyses,
    toggleSelectedAnalysis,
    analysesColors,
    showSelectAnalysesOnly,
  })
  const onPointClick = (phewasItem: VariantAssociations & AnalysisMetadata) => {
    setAnalysisId(phewasItem.analysis_id)
  }

  const onHoverAnalysis = (analysisId: string) => {
    setHoveredAnalysis(analysisId)
  }

  return (
    <Container>
      <ScrollButtonContainer>
        <h3>Region: {regionId}</h3>
        <ScrollButton
          targetSelector=".region-phewas"
          containerSelector=".resizable-inner-container"
          label="Top Single Variant Associations In Region"
        />
      </ScrollButtonContainer>
      <DocumentTitle title={`${regionId} phewas`} />
      <h3 className='app-section-title region-phewas' style={{ marginTop: 25 }}>
        {uniquePhenotypes && uniquePhenotypes.length} phenotypes that have variant associations (p-value &lt; -1e-2) in locus {' '}
        <strong>{regionId}</strong>
      </h3>

      <Phewas
        uniquePhenotypes={uniquePhenotypes}
        categories={categoriesPrepared}
        burdenSet={burdenSet}
        setBurdenSet={setBurdenSet}
        availableAncestries={availableAncestries}
        columns={phenotypesInVariantColumns}
        onPointClick={onPointClick}
        onHoverAnalysis={onHoverAnalysis}
        exportFileName={`region-phewas-${sequencingType}-{regionId}`}
        phewasType='locus'
        size={size}
      />
    </Container>
  )
}
export default withSize()(LocusPhewasData) as React.FC

