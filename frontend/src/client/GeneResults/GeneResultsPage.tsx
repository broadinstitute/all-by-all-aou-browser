/* eslint-disable jsx-a11y/label-has-associated-control */
/* eslint-disable jsx-a11y/label-has-for */
import { SearchInput } from '@gnomad/ui'
import { useQuery } from '@karaogram/kgui'
import React, { useState } from 'react'
import { useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil'
import styled from 'styled-components'
import AnalysisControls from '../AnalysisControls'
import { tableDisplayThreshold } from '../PhenotypeList/Utils'
import { pouchDbName, axaouDevUrl, cacheEnabled } from '../Query'
import { analysisIdAtom, ancestryGroupAtom, burdenSetAtom, geneIdAtom, selectedContigAtom, windowSizeAtom } from '../sharedState'
import { HalfPage, Spinner, StatusMessage } from '../UserInterface'
import getColumns from './geneResultColumns'
import GeneResultsManhattanPlot from './GeneResultsManhattanPlot'
import GeneResultsQQPlot from './GeneResultsQQPlot'
import GeneResultsTable from './GeneResultsTable'
import { AxaouConfig } from '../types'

import { GeneAssociations, AnalysisMetadata } from '../types'
import { processGeneBurden } from '../utils'

const ResultsSection = styled.div`
  width: 100%;
  max-width: calc(100vw - 1.5em);
  height: calc(85vh);
  padding-right: 10px;
  overflow-y: auto;
  padding-right: 10px;

  .gene-results-table-wrapper {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .gene-results-table {
    width: 100%;
  }
`
const Plots = styled.div`
  display: flex;
  flex-direction: row;
  width: 100%;
`
const ControlSection = styled.div`
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  justify-content: space-evenly;
  align-items: center;
  margin-bottom: 10px;
  margin-top: 10px;

  * {
    font-size: 12px;
    align-items: center;
    justify-content: center;
  }

  #gene-manhattan-search-and-filter {
    display: flex;
    flex-direction: row;
    justify-content: space-evenly;
    align-items: center;
    margin-top: 10px;
  }

  #gene-manhattan-filter {
    margin-right: 20px;
  }
  #gene-manhattan-pval {
    label {
      margin-right: 10px;
    }
  }
`


const GeneResultsPage: React.FC<{ size: { width: number; height: number } }> = ({ size }) => {

  const analysisId = useRecoilValue(analysisIdAtom)
  const setGeneId = useSetRecoilState(geneIdAtom)
  const [burdenSet, setBurdenSet] = useRecoilState(burdenSetAtom)
  const [searchText, setSearchText] = useState('')
  const contig = useRecoilValue(selectedContigAtom)

  const windowSize = useRecoilValue(windowSizeAtom)

  const ancestryGroup = useRecoilValue(ancestryGroupAtom)

  interface Data {
    geneManhattan: GeneAssociations[]
    analysisMetadata: AnalysisMetadata[]
    config: AxaouConfig
  }

  const { queryStates, anyLoading } = useQuery<Data>({
    dbName: pouchDbName,
    queries: [
      {
        url: `${axaouDevUrl}/genes/associations?ancestry_group=${ancestryGroup}&annotation=${burdenSet}&analysis_id=${analysisId}`,
        name: 'geneManhattan',
      },
      {
        url: `${axaouDevUrl}/analyses/${analysisId}?ancestry_group=${ancestryGroup}`,
        name: 'analysisMetadata',
      },
      { url: `${axaouDevUrl}/config`, name: 'config' },
    ],
    deps: [burdenSet, analysisId],
    cacheEnabled,
  })

  if (anyLoading()) {
    return <Spinner />
  }

  if (!analysisId) {
    return 'Analysis Id undefined'
  }

  // if (any(state.error) {
  //   return <StatusMessage>An error has occurred {state.error.message}</StatusMessage>
  // }
  //

  if (!queryStates.analysisMetadata.data || !queryStates.geneManhattan.data) {
    return <StatusMessage>No Data Found</StatusMessage>
  }

  const results: GeneAssociations[] = processGeneBurden(
    queryStates.geneManhattan.data.filter((gene) =>
      (gene.gene_symbol || '').includes(searchText)
    )
  ).filter(gene => {
    if (contig !== "all") {
      return `chr${gene.contig}` == contig
    }
    return true
  })
  // .filter((gene) => geneInTestConfig(gene, queryStates.config.data))

  const onGeneClick = (d: any) => {
    setGeneId(d.gene_id)
  }


  const geneIsBelowThreshold = (gene: GeneAssociations): boolean => {
    if (gene.pvalue && gene.pvalue < tableDisplayThreshold) return true
    if (gene.pvalue_burden && gene.pvalue_burden < tableDisplayThreshold) return true
    if (gene.pvalue_skat && gene.pvalue_skat < tableDisplayThreshold) return true
    return false
  }

  const hideGenesBelowThreshold = false

  const tableResults = hideGenesBelowThreshold ? results.filter(geneIsBelowThreshold) : results

  let numRowsRendered = 12

  if (windowSize.height) {
    numRowsRendered = (windowSize.height - 550) / 30
  }

  if (numRowsRendered < 15) {
    numRowsRendered = 15
  }

  const mediumBreakpoint = 500
  const wideBreakpoint = 890

  const width = size.width || 800

  // function xPosition (chrom: , pos) {
  // /*  Genomic position represented as a single number = contig_number * 10**9 + position.
  //     This represents chrom:pos more compactly and allows for easier sorting */

  //   return contigNumber(chrom) * 1_000_000_000 + pos

  // }

  const baseColumns = [
    'gene_name_phenotype_page',
    // 'chrom',
    // 'position',
    'pvalue',
    'beta_burden',
    'show',
  ]

  const mediumColumns = width > mediumBreakpoint ? ['pvalue_skat', 'pvalue_burden'] : []

  const wideColumns = width > wideBreakpoint ? ['gene_id', 'xpos'] : []

  const columns = [...baseColumns, ...mediumColumns, ...wideColumns]

  const csvColumns = [
    ...baseColumns,
    ...mediumColumns,
    ...wideColumns,
    'chrom',
    'position',
    'burden_set',
  ]

  const geneResultsColumns = getColumns({
    columnList: columns,
    onClickGeneId: onGeneClick,
    phenotypeId: analysisId,
    burdenSet,
  })

  const exportColumns = getColumns({
    columnList: csvColumns,
    onClickGeneId: onGeneClick,
    phenotypeId: analysisId,
    burdenSet,
  })

  const analysisName = queryStates.analysisMetadata.data[0].description

  return (
    <HalfPage>
      {/* <DocumentTitle title={`${analysisName} | ${burdenSet}`} /> */}
      <ResultsSection>
        <h3 className='app-section-title left-align gene-results-title'>
          <strong>{burdenSet}</strong> gene burden associations with <strong>{analysisName}</strong>
        </h3>
        <Plots>
          <GeneResultsManhattanPlot
            // @ts-expect-error ts-migrate(2322) FIXME: Type '{ results: any; height: number; onClickPoint... Remove this comment to see the full error message
            results={results}
            height={250}
            onClickPoint={onGeneClick}
          />
          {width > mediumBreakpoint && (
            <GeneResultsQQPlot results={results} height={250} onClickPoint={onGeneClick} />
          )}
        </Plots>
        <ControlSection>
          <div>
            <strong>Burden set</strong>
            <AnalysisControls burdenSet={burdenSet} setBurdenSet={setBurdenSet} />
          </div>
          <div id='gene-manhattan-search-and-filter'>
            <div id='gene-manhattan-filter'>
              <SearchInput
                placeholder='Filter genes'
                onChange={(value: any) => {
                  setSearchText(value.toUpperCase())
                }}
              />
            </div>
          </div>
        </ControlSection>
        <div className='gene-results-table-wrapper'>
          <div className='gene-results-table'>
            <GeneResultsTable
              highlightText={searchText}
              results={tableResults}
              columns={geneResultsColumns}
              exportColumns={exportColumns}
              analysisId={analysisId}
              burdenSet={burdenSet}
              numRowsRendered={numRowsRendered}
            />
          </div>
        </div>
      </ResultsSection>
    </HalfPage>
  )
}
export default GeneResultsPage 
