/* eslint-disable one-var */
/* eslint-disable no-extra-boolean-cast */
/* eslint-disable no-restricted-syntax */
/* eslint-disable prefer-destructuring */
/* eslint-disable no-else-return */
/* eslint-disable no-shadow */
/* eslint-disable camelcase */
import { max, min } from 'd3-array'
import sortBy from 'lodash/sortBy'
import React, { useMemo, useState } from 'react'
import { useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil'
import styled from 'styled-components'
import { TooltipHint as TooltipHintBase, TooltipAnchor } from '@gnomad/ui'
// @ts-expect-error ts-migrate(2307) FIXME: Cannot find module '@fortawesome/fontawesome-free/... Remove this comment to see the full error message
import Warning from '@fortawesome/fontawesome-free/svgs/solid/exclamation-triangle.svg'
import ExportDataButton from '../ExportDataButton'
import {
  analysisIdAtom,
  ancestryGroupAtom,
  AncestryGroupCodes,
  burdenSetAtom,
  geneIdAtom,
  phewasOptsAtom,
  pValueTypeAtom,
  selectedAnalyses,
  selectedAnalysesColorsSelector,
  showFilteredAnalysesAtom,
  showSelectAnalysesOnlyAtom,
  useSetManySelectedAnalyses,
  windowSizeAtom,
} from '../sharedState'
import sortItems from '../sortItems'
import PhenotypeTable from './PhenotypeTable'
import { preparePhenotypesText } from './phenotypeUtils'
import PhewasBetaPlot from './PhewasBetaPlot'
import PhewasPvaluePlot from './PhewasPvaluePlot'
import PhewasControls from './PhewasControls'
import {
  pValueTypeToPValueKeyName,
  P_VALUE_BURDEN,
  P_VALUE_SKAT,
  P_VALUE_SKAT_O,
  geneYellowThreshold,
} from './Utils'

import { GeneAssociations } from '../types'
import filterPhenotypes from './filterPhenotypes'

const RootContainerGene = styled.div`
  display: flex;
  flex-direction: row;
  width: 100%;
  min-height: 1200px;
  max-width: 100%;

  .data-container {
    display: flex;
    width: 100%;
    flex-direction: column;
    padding-right: 10px;
  }

  .filter-warnings {
    border: 1px solid blue;
  }

  .buttons {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    width: 100%;
  }
`

const PhenotypeTableInnerContainer = styled.div`
  position: absolute;
  width: 100%;
  height: 100%;
`

const TooltipHint = styled(TooltipHintBase)`
  background-image: none;
`

const PlotContainer = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 200px;
  width: 100%;
`

const RootContainerVariant = styled(RootContainerGene)``

const TableContainer = styled.div`
  position: relative;
  grid-column: 2 / 3;
  grid-row: 2 / 3;
  display: flex;
  flex-direction: column;
  min-width: 100%;
  height: 100%;
`

const Warnings = styled.div`
  display: flex;
  flex-direction: column;
  margin-top: 15px;
  fill: grey;
  justify-content: center;

  * {
    margin-right: 5px;
  }
`

const ShowControlsButton = styled.button`
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  writing-mode: vertical-rl;
  text-orientation: mixed;
  padding: 12px 6px;
  background: #f5f5f5;
  border: 1px solid #e0e0e0;
  border-left: none;
  border-radius: 0 4px 4px 0;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  color: #333;
  z-index: 10;

  &:hover {
    background: #e8e8e8;
  }
`

const pValueSliderStep = 1

interface Category {
  category: string
  color: string
  analysisCount: number
}

const Phewas = ({
  columns: originalColumns,
  onPointClick,
  uniquePhenotypes,
  categories,
  exportFileName,
  availableAncestries = ['afr', 'amr', 'eas', 'eur', 'mid', 'sas', 'meta'] as AncestryGroupCodes[],
  onHoverAnalysis,
  size,
  phewasType = 'gene', // "variant", "topHit", "gene", "locus"
}: any) => {
  const isGenePhewas = phewasType === 'gene' || phewasType === 'topHit'

  const [searchText, updateSearchText] = useState('')

  const [sortKey, updateSortKey] = useState('pvalue')

  const [plotSortKey, setPlotSortKey] = useState('pvalue')
  const [logLogEnabled, setLogLogEnabled] = useState(false)

  const [sortDirection, updateSortAscending] = useState('ascending')

  const [pvalPlotSelectionBoundary, internalSetPvalPlotSelectionBoundary] = useState(undefined)
  const [betaPlotSelectionBoundary, internalSetBetaPlotSelectionBoundary] = useState(undefined)

  const [showPhewasControls, setShowPhewasControls] = useRecoilState(phewasOptsAtom)

  const analyses = useRecoilValue(selectedAnalyses)

  const analysisId = useRecoilValue(analysisIdAtom)
  const geneIdOrName = useRecoilValue(geneIdAtom)

  if (!analysisId || !geneIdOrName) {
    throw new Error('Both analysisId and geneIdOrName must be defined.')
  }

  const setSelectedAnalyses = useSetManySelectedAnalyses()

  const [showSelectAnalysesOnly, setShowSelectAnalysesOnly] = useRecoilState(
    showSelectAnalysesOnlyAtom
  )

  const [showFilteredAnalyses, setShowFilteredAnalyses] = useRecoilState(showFilteredAnalysesAtom)

  const [burdenSet, setBurdenSet] = useRecoilState(burdenSetAtom)

  // MAF filter state for gene burden results
  const [selectedMaf, setSelectedMaf] = useState<number>(0.001)

  // Simple category state - Set of selected category names
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(() => {
    return new Set(categories.map((c: Category) => c.category))
  })

  // Filter phenotypes by MAF (for gene phewas)
  const mafFilteredPhenotypes = useMemo(() => {
    if (!isGenePhewas) {
      return uniquePhenotypes
    }
    return uniquePhenotypes.filter((p: any) => p.max_maf === selectedMaf)
  }, [uniquePhenotypes, selectedMaf, isGenePhewas])

  // Filter phenotypes by selected categories
  const categoryFilteredPhenotypes = useMemo(() => {
    return mafFilteredPhenotypes.filter((p: any) => {
      const phenotypeCategory = p.category || 'Unknown'
      return selectedCategories.has(phenotypeCategory)
    })
  }, [mafFilteredPhenotypes, selectedCategories])

  // Add color to phenotypes based on category
  const phenotypesWithColor = useMemo(() => {
    const categoryColorMap = new Map<string, string>()
    categories.forEach((c: Category) => {
      categoryColorMap.set(c.category, c.color)
    })

    return categoryFilteredPhenotypes.map((p: any) => ({
      ...p,
      color: categoryColorMap.get(p.category || 'Unknown') || '#999999',
      group: p.category || 'Unknown',
    }))
  }, [categoryFilteredPhenotypes, categories])

  const windowSize = useRecoilValue(windowSizeAtom)

  const analysesColors = useRecoilValue(selectedAnalysesColorsSelector)

  const selected = analyses.length > 0 ? analyses : [analysisId]

  const [pValueType, setPValueType] = useRecoilState(pValueTypeAtom)

  const [ancestryGroup, setAncestryGroup] = useRecoilState(ancestryGroupAtom)

  const [plotType, setPlotType] = useState('P-value')

  const columns = useMemo(() => {
    return originalColumns.map((originalColumn: any) => {
      if (originalColumn.displayId === 'pvalue') {
        const column = { ...originalColumn }
        column.key = 'pvalue'
        column.sortKey = pValueType
        let columnHeading
        if (pValueType === P_VALUE_BURDEN) {
          columnHeading = 'P-Value (Burden)'
        } else if (pValueType === P_VALUE_SKAT) {
          columnHeading = 'P-Value (SKAT)'
        } else {
          columnHeading = 'P-Value (SKAT-O)'
        }
        column.heading = columnHeading
        return column
      } else {
        return originalColumn
      }
    })
  }, [originalColumns, showFilteredAnalyses, pValueType, ancestryGroup])

  const pValueKeyName = !isGenePhewas ? 'pvalue' : pValueTypeToPValueKeyName[pValueType]

  const {
    betaIntervalMin,
    betaIntervalMax,
    pIntervalMin,
    pIntervalMax,
    initialBetaIntervalMin,
    initialBetaIntervalMax,
  } = useMemo(() => {
    const betaIntervalMin = min(uniquePhenotypes.map((p: any) => p.BETA))
    const betaIntervalMax = max(uniquePhenotypes.map((p: any) => p.BETA))
    const nonZeroPValues = uniquePhenotypes.filter((p: any) => p[pValueKeyName] > 0)
    const pIntervalMin = min(nonZeroPValues.map((p: any) => -Math.log10(p[pValueKeyName])))
    const pIntervalMax = max(nonZeroPValues.map((p: any) => -Math.log10(p[pValueKeyName])))
    const initialBetaIntervalMin = betaIntervalMin
    const initialBetaIntervalMax = betaIntervalMax
    return {
      // @ts-expect-error ts-migrate(2532) FIXME: Object is possibly 'undefined'.
      pIntervalMin: pIntervalMin <= 0 ? 0 : Math.floor(pIntervalMin),
      // @ts-expect-error ts-migrate(2345) FIXME: Argument of type 'string | undefined' is not assig... Remove this comment to see the full error message
      pIntervalMax: Math.ceil(pIntervalMax),
      betaIntervalMin,
      betaIntervalMax,
      initialBetaIntervalMin,
      initialBetaIntervalMax,
    }
  }, [uniquePhenotypes, pValueKeyName])
  const [pValueInterval, setPvalueInterval] = useState<[number, number]>([0, pIntervalMax])
  const [betaInterval, setBetaInterval] = useState([initialBetaIntervalMin, initialBetaIntervalMax])

  const phenotypesWithPreparedText = preparePhenotypesText(phenotypesWithColor)

  const filteredByOtherCriteria = filterPhenotypes({
    phenotypes: phenotypesWithPreparedText,
    searchText,
    pValueType,
    showFilteredAnalyses: isGenePhewas ? showFilteredAnalyses : true,
    phewasType,
    maxValues: {
      minBeta: betaInterval[0],
      maxBeta: betaInterval[1],
      minLogPValue: pValueInterval[0],
      maxLogPvalue: pValueInterval[1],
    },
  })

  const numHiddenPhenotypes = uniquePhenotypes.length - filteredByOtherCriteria.length

  let testMismatchWarningLabel
  if (pValueType === P_VALUE_SKAT_O) {
    testMismatchWarningLabel = 'SKAT-O'
  } else if (pValueType === P_VALUE_SKAT) {
    testMismatchWarningLabel = 'SKAT'
  }

  const betaPlotWarningElem =
    (!isGenePhewas || pValueType === P_VALUE_BURDEN) ? null : (
      <div>
        Note: the displayed pvalues and betas are derived from distinct statistical tests (
        {testMismatchWarningLabel} and Burden, respectively)
      </div>
    )

  const renderedPhenotypes = sortItems(filteredByOtherCriteria, {
    sortKey,
    sortOrder: sortDirection,
  })

  const phenotypesOrderedByGroup = sortBy(renderedPhenotypes, ({ group }) => group).map((item) => ({
    ...item,
    visible: true,
  }))

  const tablePhenotypes = useMemo(() => {
    if (pvalPlotSelectionBoundary === undefined && betaPlotSelectionBoundary === undefined) {
      return sortItems(phenotypesOrderedByGroup, { sortKey, sortOrder: sortDirection })
    } else {
      let firstPhenotypeId, lastPhenotypeId, yLowerLimit, yUpperLimit
      if (pvalPlotSelectionBoundary !== undefined) {
        // @ts-expect-error ts-migrate(2532) FIXME: Object is possibly 'undefined'.
        firstPhenotypeId = pvalPlotSelectionBoundary.firstPhenotypeId
        // @ts-expect-error ts-migrate(2532) FIXME: Object is possibly 'undefined'.
        lastPhenotypeId = pvalPlotSelectionBoundary.lastPhenotypeId
        // @ts-expect-error ts-migrate(2532) FIXME: Object is possibly 'undefined'.
        yLowerLimit = pvalPlotSelectionBoundary.yLowerLimit
        // @ts-expect-error ts-migrate(2532) FIXME: Object is possibly 'undefined'.
        yUpperLimit = pvalPlotSelectionBoundary.yUpperLimit
      } else if (betaPlotSelectionBoundary !== undefined) {
        // @ts-expect-error ts-migrate(2532) FIXME: Object is possibly 'undefined'.
        firstPhenotypeId = betaPlotSelectionBoundary.firstPhenotypeId
        // @ts-expect-error ts-migrate(2532) FIXME: Object is possibly 'undefined'.
        lastPhenotypeId = betaPlotSelectionBoundary.lastPhenotypeId
        // @ts-expect-error ts-migrate(2532) FIXME: Object is possibly 'undefined'.
        yLowerLimit = betaPlotSelectionBoundary.yLowerLimit
        // @ts-expect-error ts-migrate(2532) FIXME: Object is possibly 'undefined'.
        yUpperLimit = betaPlotSelectionBoundary.yUpperLimit
      }
      if (firstPhenotypeId === undefined || lastPhenotypeId === undefined) {
        return phenotypesOrderedByGroup
      } else {
        const filteredByPhenotype = []
        let hasEncounteredFirstPhenotypeId = false
        for (const item of phenotypesOrderedByGroup) {
          const { phenotype_id } = item
          if (hasEncounteredFirstPhenotypeId === false && phenotype_id === firstPhenotypeId) {
            hasEncounteredFirstPhenotypeId = true
          }
          if (hasEncounteredFirstPhenotypeId === true) {
            filteredByPhenotype.push(item)
          }
          if (phenotype_id === lastPhenotypeId) {
            break
          }
        }
        const unsortedResult = []
        for (const item of filteredByPhenotype) {
          const { pvalue, BETA } = item
          const yValue = pvalPlotSelectionBoundary !== undefined ? -Math.log10(pvalue) : BETA
          if (yValue > yLowerLimit && yValue < yUpperLimit && pvalue !== 0) {
            unsortedResult.push(item)
          }
        }
        return sortItems(unsortedResult, { sortKey, sortOrder: sortDirection })
      }
    }
  }, [
    pvalPlotSelectionBoundary,
    betaPlotSelectionBoundary,
    plotType,
    phenotypesOrderedByGroup,
    sortKey,
    sortDirection,
    ancestryGroup,
  ])

  const plotPhenotypes = sortBy(
    sortItems(tablePhenotypes, { sortKey: plotSortKey, sortOrder: sortDirection }),
    ({ group }) => group
  ).map((item) => ({
    ...item,
    visible: true,
  }))

  const selectPhenotypes = tablePhenotypes.filter((analysis: any) => {
    return analyses.includes(analysis.analysis_id)
  })

  const onSort = (newSortKey: any) => {
    if (newSortKey === sortKey) {
      updateSortAscending(sortDirection === 'ascending' ? 'descending' : 'ascending')
    }
    updateSortKey(newSortKey)
  }

  const onVisibleRowsChange = () => { }

  const handlePvalueOrder = () => {
    if (plotSortKey === 'description') {
      setPlotSortKey('pvalue')
    } else {
      setPlotSortKey('description')
    }
  }

  const handleLogLogEnable = () => {
    setLogLogEnabled(!logLogEnabled)
    setPvalueInterval([pIntervalMin, pIntervalMax])
  }

  const handlePvalueIntervalChange = (range: [number, number]) => {
    setPvalueInterval(range)
  }

  const topAnalyses = (tablePhenotypes as GeneAssociations[])
    .filter((a: any) => a[pValueTypeToPValueKeyName[pValueType]] < geneYellowThreshold)
    .map((a: any) => a.analysis_id)

  // Category toggle handlers
  const handleToggleCategory = (category: string) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(category)) {
        next.delete(category)
      } else {
        next.add(category)
      }
      return next
    })
  }

  const handleSelectAllCategories = () => {
    setSelectedCategories(new Set(categories.map((c: Category) => c.category)))
  }

  const handleSelectNoCategories = () => {
    setSelectedCategories(new Set())
  }

  const displayPlotPhenotypes = showSelectAnalysesOnly ? selectPhenotypes : plotPhenotypes
  const displayTablePhenotypes = showSelectAnalysesOnly ? selectPhenotypes : tablePhenotypes
  let pointRadius = showSelectAnalysesOnly ? 6 : 4

  const analysisPointColor = (analysis: any) => {
    if (showSelectAnalysesOnly) {
      const analysisColor: { analysisId: string; color: string } | undefined = analysesColors.find(
        (a) => a.analysisId === analysis.analysis_id
      )
      return (analysisColor && analysisColor.color) || 'grey'
    }
    return (analysis && analysis.color) || 'white'
  }

  const activeAnalyses = showSelectAnalysesOnly ? undefined : selected

  let numRowsRendered = 20

  if (windowSize.height) {
    numRowsRendered = (windowSize.height - 500) / 30
  }

  if (numRowsRendered < 24) {
    numRowsRendered = 24
  }

  const RootContainer = isGenePhewas ? RootContainerGene : RootContainerVariant

  const pointLabel =
    phewasType === 'topHit'
      ? (d: any) => `${d.description} - ${d.gene_symbol}`
      : (d: any) => d.description || ''

  const pointStyleThreshold = 1000

  pointRadius = displayPlotPhenotypes.length > pointStyleThreshold ? 3.5 : pointRadius

  const showStroke = displayPlotPhenotypes.length < pointStyleThreshold

  return (
    <React.Fragment>
      <RootContainer>
        {showPhewasControls && size.width > 700 && (
          <PhewasControls
            onSearchChange={updateSearchText}
            onClose={() => setShowPhewasControls(false)}
            isGenePhewas={isGenePhewas}
            burdenSet={burdenSet}
            setBurdenSet={setBurdenSet}
            selectedMaf={selectedMaf}
            setSelectedMaf={setSelectedMaf}
            pValueType={pValueType}
            setPValueType={setPValueType}
            pValueInterval={pValueInterval}
            pIntervalMin={pIntervalMin}
            pIntervalMax={pIntervalMax}
            onPvalueIntervalChange={handlePvalueIntervalChange}
            plotType={plotType}
            setPlotType={setPlotType}
            plotSortKey={plotSortKey}
            onTogglePvalueOrder={handlePvalueOrder}
            logLogEnabled={logLogEnabled}
            onToggleLogLog={handleLogLogEnable}
            analysesCount={analyses.length}
            topAnalyses={topAnalyses}
            onSelectTop={() => setSelectedAnalyses(topAnalyses)}
            onClearSelected={() => setSelectedAnalyses([analysisId])}
            showSelectAnalysesOnly={showSelectAnalysesOnly}
            onToggleShowSelectOnly={() => setShowSelectAnalysesOnly(!showSelectAnalysesOnly)}
            phewasType={phewasType}
            categories={categories}
            selectedCategories={selectedCategories}
            onToggleCategory={handleToggleCategory}
            onSelectAllCategories={handleSelectAllCategories}
            onSelectNoCategories={handleSelectNoCategories}
          />
        )}
        {!showPhewasControls && size.width > 700 && (
          <ShowControlsButton onClick={() => setShowPhewasControls(true)}>
            Controls
          </ShowControlsButton>
        )}
        <div className='data-container' style={{ position: 'relative' }}>
          <PlotContainer>
            {plotType === 'Both' && (
              <>
                <PhewasPvaluePlot
                  analyses={displayPlotPhenotypes}
                  activeAnalyses={activeAnalyses}
                  activeGene={geneIdOrName}
                  onClickPoint={onPointClick}
                  pValueType={pValueType}
                  pointColor={analysisPointColor}
                  logLogEnabled={logLogEnabled}
                  yExtent={pValueInterval}
                  pointRadius={pointRadius}
                  showStroke={showStroke}
                  pointLabel={pointLabel}
                  height={130}
                />
                <PhewasBetaPlot
                  analyses={displayPlotPhenotypes}
                  activeAnalyses={activeAnalyses}
                  activeGene={geneIdOrName}
                  onClickPoint={onPointClick}
                  pointColor={analysisPointColor}
                  yExtent={pValueInterval}
                  pointRadius={pointRadius}
                  showStroke={showStroke}
                  pointLabel={pointLabel}
                  height={70}
                />
              </>
            )}
            {plotType === 'P-value' && (
              <PhewasPvaluePlot
                analyses={plotPhenotypes}
                activeAnalyses={selected}
                activeGene={geneIdOrName}
                onClickPoint={onPointClick}
                pValueType={pValueType}
                logLogEnabled={logLogEnabled}
                yExtent={pValueInterval}
                pointRadius={pointRadius}
                showStroke={showStroke}
                pointLabel={pointLabel}
                height={180}
              />
            )}
            {plotType === 'Beta' && (
              <PhewasBetaPlot
                analyses={plotPhenotypes}
                activeAnalyses={selected}
                activeGene={geneIdOrName}
                onClickPoint={onPointClick}
                yExtent={pValueInterval}
                pointRadius={pointRadius}
                showStroke={showStroke}
                pointLabel={pointLabel}
                height={180}
              />
            )}
          </PlotContainer>
          <TableContainer>
            <PhenotypeTableInnerContainer>
              <PhenotypeTable
                columns={columns}
                highlightText={searchText}
                onHoverPhenotype={onHoverAnalysis}
                onRequestSort={onSort}
                onVisibleRowsChange={onVisibleRowsChange}
                sortKey={sortKey}
                sortOrder // TODO
                phenotypes={displayTablePhenotypes}
                numRowsRendered={numRowsRendered}
              />
              <div className='buttons'>
                <ExportDataButton
                  exportFileName={exportFileName}
                  data={renderedPhenotypes}
                  columns={[
                    ...columns,
                    {
                      key: 'analysis_id',
                      heading: 'analysis_id',
                      displayId: 'analysis_id',
                      isRowHeader: true,
                    },
                  ]}
                />
              </div>
              <Warnings>
                {betaPlotWarningElem && (
                  <span>
                    <TooltipAnchor tooltip={betaPlotWarningElem}>
                      <TooltipHint>
                        <Warning height={15} width={15} /> Burden test statistic mismatch
                      </TooltipHint>
                    </TooltipAnchor>
                  </span>
                )}

                {numHiddenPhenotypes > 0 && (
                  <span>
                    <TooltipAnchor
                      tooltip={`Note: ${numHiddenPhenotypes} phenotypes currently hidden based on filtering settings`}
                    >
                      <TooltipHint>
                        <Warning height={15} width={15} /> {numHiddenPhenotypes} phenotypes hidden
                      </TooltipHint>
                    </TooltipAnchor>
                  </span>
                )}
                <span />
              </Warnings>
            </PhenotypeTableInnerContainer>
          </TableContainer>
        </div>
      </RootContainer>
    </React.Fragment>
  )
}

export default Phewas
