/* eslint-disable no-shadow */
/* eslint-disable camelcase */

import React from 'react'
import { useQuery } from '@axaou/ui'

import { DocumentTitle, Spinner, StatusMessage, TitleWithScrollButtons } from '../UserInterface'
import { Titles as TitlesBase, HalfPage } from '../UserInterface'
import {
  modifyCategoryColor,
  annotateGenePhewasWithAnalysisMetadata,
} from '../PhenotypeList/phenotypeUtils'
import Phewas from '../PhenotypeList/Phewas'
import { getPhenotypeColumns } from '../PhenotypeList/PhenotypeTable'
import { pouchDbName, axaouDevUrl, cacheEnabled } from '../Query'

import {
  selectedAnalyses,
  useToggleSelectedAnalysis,
  hoveredAnalysisAtom,
  selectedAnalysesColorsSelector,
  showSelectAnalysesOnlyAtom,
  pValueTypeAtom,
  ancestryGroupAtom,
  burdenSetAtom,
  resultLayoutAtom,
  phewasOptsAtom,
  geneIdAtom,
  analysisIdAtom,
  resultIndexAtom,
  regionIdAtom,
} from '../sharedState'
import { useRecoilValue, useSetRecoilState } from 'recoil'
import styled from 'styled-components'
import { withSize } from 'react-sizeme'
import { analysisInTestConfig, filterValidAnalyses, geneInTestConfig, getAvailableAnalysisIds } from '../utils'
import {
  AnalysisMetadata,
  AnalysisCategories,
  GeneAssociations,
  GenePhewasAnnotated,
  AxaouConfig,
  LoadedAnalysis,
} from '../types'
import { loadedAnalysesQuery } from '../queryStates'

interface Data {
  geneAssociations: GeneAssociations[]
  analysesMetadata: AnalysisMetadata[]
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
  topHitPhenotypes: GenePhewasAnnotated[] | null
  categories: AnalysisCategories[]
  onPointClick: any
  size: { width: number; height: number }
}

const TopHitPhewasLayout = withSize()(
  ({ topHitPhenotypes, categories, onPointClick, size }: GenePhewasLayoutProps) => {
    const burdenSet = useRecoilValue(burdenSetAtom)
    const pValueType = useRecoilValue(pValueTypeAtom)
    const analyses = useRecoilValue(selectedAnalyses)
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

    const baseColumns = [
      'description_with_link',
      'info',
      'gene_name_top_hits',
      'pvalue',
      'BETA',
      'show_top_hits',
    ]

    const mediumColumns = size.width > mediumBreakpoint ? ['n_cases', 'n_controls'] : []

    const wideColumns =
      resultLayout === 'full' ? ['phenotype', 'trait_type', 'sex', 'category'] : []

    const columns = [...baseColumns, ...mediumColumns, ...wideColumns]

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

    return (
      <>
        <DocumentTitle title={`Top ${burdenSet} hits`} />
        <Titles>
          <h3 className='app-section-title top-hit-phewas' style={{ width: '100%', marginTop: 20 }}>
            <strong>Top {burdenSet} gene burden associations</strong> (P-value &#60; 1e-6)
          </h3>
        </Titles>
        <Phewas
          uniquePhenotypes={topHitPhenotypes}
          categories={categories}
          columns={phenotypesInGeneColumns}
          onPointClick={onPointClick}
          exportFileName={`gene-phewas-exomes_top-hits`}
          showPlotTypeControls
          showAnalysisGroups
          showBurdenTestControls
          onHoverAnalysis={onHoverAnalysis}
          size={size}
          phewasType='topHit'
        />
        <TitleWithScrollButtons
          title={"Top Gene Associations"}
          buttons={[
            {
              targetSelector: '.top-hit-phewas',
              containerSelector: '.resizable-inner-container',
              label: 'Gene Burden (PheWAS)',
            },
          ]}
          width={size.width}
        />
      </>
    )
  }
)

interface Props { }

const TopHitPhewas: React.FC<Props> = () => {
  const ancestryGroup = useRecoilValue(ancestryGroupAtom)
  const burdenSet = useRecoilValue(burdenSetAtom)

  const setGeneId = useSetRecoilState(geneIdAtom)
  const setAnalysisId = useSetRecoilState(analysisIdAtom)
  const setResultIndex = useSetRecoilState(resultIndexAtom)
  const setRegionId = useSetRecoilState(regionIdAtom)
  const setResultLayout = useSetRecoilState(resultLayoutAtom)


  const { queryStates, anyLoading } = useQuery<Data>({
    dbName: pouchDbName,
    queries: [
      { url: `${axaouDevUrl}/analyses?ancestry_group=${ancestryGroup}`, name: 'analysesMetadata' },
      { url: `${axaouDevUrl}/categories`, name: 'categories' },
      {
        url: `${axaouDevUrl}/genes/top-associations?ancestry=${ancestryGroup}&annotation=${burdenSet}&limit=5000`,
        name: 'geneAssociations',
      },
      { url: `${axaouDevUrl}/config`, name: 'config' },
      {
        url: `${axaouDevUrl}/analyses-loaded`,
        name: 'availableAnalyses',
      }

    ],
    deps: [burdenSet, ancestryGroup],
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

  const { analysesMetadata, geneAssociations, categories, config } = queryStates

  if (!geneAssociations.data || !analysesMetadata.data || !categories.data) {
    return (
      <Container>
        <StatusMessage>No PheWAS Data Found</StatusMessage>
      </Container>
    )
  }

  const availableAnalysesState = queryStates.availableAnalyses;

  const uniquePhenotypes =
    analysesMetadata &&
    filterValidAnalyses(
      annotateGenePhewasWithAnalysisMetadata(
        geneAssociations.data,
        analysesMetadata.data
      ),
      getAvailableAnalysisIds(availableAnalysesState?.data)
    );

  const onPointClick = ({ gene_id, analysis_id }: GenePhewasAnnotated) => {
    setGeneId(gene_id)
    setAnalysisId(analysis_id)
    setRegionId(null)
    setResultIndex('gene-phewas')
    setResultLayout('half')
  }

  const categoriesPrepared = categories.data.map(modifyCategoryColor)

  return (
    <Container>
      <TopHitPhewasLayout
        topHitPhenotypes={uniquePhenotypes || []}
        categories={categoriesPrepared || []}
        onPointClick={onPointClick}
      />
    </Container>
  )
}

export default TopHitPhewas
