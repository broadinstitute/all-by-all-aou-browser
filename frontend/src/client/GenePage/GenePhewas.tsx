/* eslint-disable no-shadow */
/* eslint-disable camelcase */

import { useQuery } from '@axaou/ui'
import React from 'react'

import { getPhenotypeColumns } from '../PhenotypeList/PhenotypeTable'
import Phewas from '../PhenotypeList/Phewas'
import { axaouDevUrl, cacheEnabled, pouchDbName } from '../Query'
import { DocumentTitle, HalfPage, ScrollButton, ScrollButtonContainer, Spinner, StatusMessage, Titles as TitlesBase, TitleWithScrollButtons } from '../UserInterface'

import { useRecoilValue, useSetRecoilState } from 'recoil'
import styled from 'styled-components'
import {
  analysisIdAtom,
  ancestryGroupAtom,
  AncestryGroupCodes,
  burdenSetAtom,
  geneIdAtom,
  hoveredAnalysisAtom,
  phewasOptsAtom,
  pValueTypeAtom,
  resultLayoutAtom,
  selectedAnalyses,
  selectedAnalysesColorsSelector,
  showSelectAnalysesOnlyAtom,
  useToggleSelectedAnalysis,
} from '../sharedState'

import { annotateGenePhewasWithAnalysisMetadata } from '../PhenotypeList/phenotypeUtils'
import {
  AnalysisCategories,
  AnalysisMetadata,
  AxaouConfig,
  GeneAssociations,
  GeneModels,
  GenePhewasDataItem,
  LoadedAnalysis,
} from '../types'
import { filterValidAnalyses, getAvailableAnalysisIds, processGeneBurden } from '../utils'
import { GeneInfo } from './GeneInfo'

const hasGeneAssociationPvalues = (phenotype: GenePhewasDataItem & AnalysisMetadata): boolean => {
  return (
    phenotype.pvalue !== null || phenotype.pvalue_skat !== null || phenotype.pvalue_burden !== null
  )
}

interface Data {
  geneAssociations: GeneAssociations[]
  analysesMetadata: AnalysisMetadata[]
  geneModel: GeneModels[]
  categories: AnalysisCategories[]
  config: AxaouConfig
  availableAnalyses: LoadedAnalysis[];
}

const Titles = styled(TitlesBase)`
  align-items: flex-start;

  .side-nav-button {
    display: inline-block;
    padding: 0.35em 1.2em;
    border: 0.1em solid black;
    margin: 0 0.3em 0.3em 0;
    border-radius: 0.12em;
    box-sizing: border-box;
    text-decoration: none;
    font-family: 'Roboto', sans-serif;
    background-color: none;
    font-weight: 300;
    text-align: center;
    transition: all 0.2s;
    height: 3em;
    width: 3em;
  }
`

interface GenePhewasLayoutProps {
  uniquePhenotypes: (GenePhewasDataItem & AnalysisMetadata)[]
  categories: AnalysisCategories[]
  geneModel?: GeneModels
  ancestryGroup: AncestryGroupCodes
  onPointClick: any
  availableAncestries: AncestryGroupCodes[]
  size: { width: number; height: number }
}

const GenePhewasLayout = ({
  uniquePhenotypes,
  categories = [],
  geneModel,
  ancestryGroup,
  availableAncestries,
  onPointClick,
  size,
}: GenePhewasLayoutProps) => {
  const burdenSet = useRecoilValue(burdenSetAtom)
  const pValueType = useRecoilValue(pValueTypeAtom)
  const analysisId = useRecoilValue(analysisIdAtom)
  const geneId = useRecoilValue(geneIdAtom)
  const selectedAnalysesList = useRecoilValue(selectedAnalyses)
  const toggleSelectedAnalysis = useToggleSelectedAnalysis()
  const setHoveredAnalysis = useSetRecoilState(hoveredAnalysisAtom)
  const analysesColors = useRecoilValue(selectedAnalysesColorsSelector)
  const showSelectAnalysesOnly = useRecoilValue(showSelectAnalysesOnlyAtom)
  const resultLayout = useRecoilValue(resultLayoutAtom)
  const showPhewasControls = useRecoilValue(phewasOptsAtom)

  const mediumBreakpointMinWidth = 500
  const mediumBreakpoint = showPhewasControls
    ? mediumBreakpointMinWidth + 350
    : mediumBreakpointMinWidth

  const baseColumns = ['description_with_link', 'info', 'pvalue', 'select', 'show']

  const mediumColumns = size.width > mediumBreakpoint ? ['BETA', 'n_cases', 'n_controls'] : []

  const wideColumns =
    resultLayout === 'full' ? ['phenotype', 'trait_type', 'sex', 'category'] : []

  const columns = [...baseColumns, ...mediumColumns, ...wideColumns]

  const analyses = selectedAnalysesList.length === 0 ? [analysisId] : selectedAnalysesList

  const phenotypesInGeneColumns = getPhenotypeColumns({
    columns,
    analysisGroup: burdenSet,
    history,
    selectedAnalyses: analyses,
    toggleSelectedAnalysis,
    analysesColors,
    pValueType,
    showSelectAnalysesOnly,
  })

  const onHoverAnalysis = (analysisId: string) => {
    setHoveredAnalysis(analysisId)
  }

  const geneSymbol = geneModel?.symbol || geneId

  return (
    <>
      <TitleWithScrollButtons
        title={`${geneSymbol} (${geneId})`}
        buttons={[
          {
            targetSelector: ".gene-info",
            containerSelector: ".resizable-inner-container",
            label: "Gene Info",
          },
          {
            targetSelector: ".gene-burden-phewas",
            containerSelector: ".resizable-inner-container",
            label: "Gene Burden (PheWAS)",
          },
        ]}
        width={size.width} // Ensure this is set to the correct width
      />
      {geneModel && <GeneInfo geneIdentifier={geneSymbol || geneId || "Gene"} geneModel={geneModel} />}
      <DocumentTitle title={`${geneSymbol} | ${burdenSet} | All by All Browser`} />
      <Titles>
        <h3
          className="app-section-title gene-burden-phewas"
          style={{ width: "100%" }}
        >
          {uniquePhenotypes && uniquePhenotypes.length}{" "}
          <strong>{burdenSet}</strong> gene burden associations with{" "}
          <strong>{geneSymbol}</strong>
        </h3>
      </Titles>
      <Phewas
        uniquePhenotypes={uniquePhenotypes}
        categories={categories}
        columns={phenotypesInGeneColumns}
        onPointClick={onPointClick}
        exportFileName={`gene-phewas-exomes_${geneSymbol}`}
        showPlotTypeControls
        showAnalysisGroups
        showBurdenTestControls
        onHoverAnalysis={onHoverAnalysis}
        phewasType="gene"
        availableAncestries={availableAncestries}
        size={size}
      />
    </>
  )
}

interface Props { size: { width: number; height: number } }

const GenePhewasData: React.FC<Props> = ({ size }) => {
  const ancestryGroup = useRecoilValue(ancestryGroupAtom)
  const burdenSet = useRecoilValue(burdenSetAtom)
  const geneId = useRecoilValue(geneIdAtom)
  const setAnalysisId = useSetRecoilState(analysisIdAtom)

  const geneIdOrName = geneId

  const { queryStates, anyLoading } = useQuery<Data>({
    dbName: pouchDbName,
    queries: [
      {
        url: `${axaouDevUrl}/genes/phewas/${geneIdOrName}?annotation=${burdenSet}`,
        name: 'geneAssociations',
      },
      { url: `${axaouDevUrl}/analyses?ancestry_group=${ancestryGroup}`, name: 'analysesMetadata' },
      {
        url: `${axaouDevUrl}/genes/model/${geneIdOrName}`,
        name: 'geneModel',
      },
      { url: `${axaouDevUrl}/categories`, name: 'categories' },
      { url: `${axaouDevUrl}/config`, name: 'config' },
      {
        url: `${axaouDevUrl}/analyses-loaded`,
        name: 'availableAnalyses',
      }
    ],
    deps: [burdenSet, geneIdOrName],
    cacheEnabled,
  })

  const Container = HalfPage

  if (anyLoading()) {
    return (
      <Container>
        <Spinner />
      </Container>
    )
  }

  if (anyLoading()) {
    return (
      <Container>
        <Spinner />
      </Container>
    )
  }

  if (!queryStates) {
    return (
      <Container>
        <StatusMessage>No Data Found</StatusMessage>
      </Container>
    )
  }

  const { analysesMetadata, geneModel, categories, geneAssociations } = queryStates

  const availableAncestries: AncestryGroupCodes[] =
    (geneAssociations.data &&
      Array.from(
        new Set(geneAssociations.data.map((gene) => gene.ancestry_group as AncestryGroupCodes))
      )) ||
    []

  const geneAssociationsForAncestry = processGeneBurden(
    (geneAssociations.data &&
      geneAssociations.data.filter((g) => g.ancestry_group === ancestryGroup)) ||
    []
  )

  // if (!geneAssociationsForAncestry) {
  //   throw new Error(`Gene Phewas not found for ancestry group: ${ancestryGroup.toUpperCase()}`)
  // }

  const availableAnalysesState = queryStates.availableAnalyses;

  const uniquePhenotypes = filterValidAnalyses(
    annotateGenePhewasWithAnalysisMetadata(
      geneAssociationsForAncestry,
      analysesMetadata.data
    ),
    getAvailableAnalysisIds(availableAnalysesState!.data!)
  ).filter(hasGeneAssociationPvalues)


  const onPointClick = ({ analysis_id }: GenePhewasDataItem) => {
    setAnalysisId(analysis_id)
  }

  return (
    <Container>
      {/* @ts-ignore */}
      <GenePhewasLayout
        uniquePhenotypes={uniquePhenotypes}
        categories={categories.data || []}
        geneModel={geneModel && geneModel.data && geneModel.data[0] || undefined}
        ancestryGroup={ancestryGroup}
        availableAncestries={availableAncestries}
        onPointClick={onPointClick}
        size={size}
      />
    </Container>
  )
}

export default GenePhewasData
