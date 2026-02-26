/* eslint-disable one-var */
/* eslint-disable no-extra-boolean-cast */
/* eslint-disable no-restricted-syntax */
/* eslint-disable prefer-destructuring */
/* eslint-disable no-else-return */
/* eslint-disable no-shadow */
/* eslint-disable camelcase */
import ClassificationSelector, {
  ClassificationType,
  useClassificationSelectorState,
} from '@gnomad/classification-selector'
import { Button, Checkbox, SearchInput, SegmentedControl } from '@gnomad/ui'
import { max, min } from 'd3-array'
import sortBy from 'lodash/sortBy'
import React, { useMemo, useRef, useState } from 'react'
import { useRecoilState, useRecoilValue } from 'recoil'
import styled from 'styled-components'
import { TooltipHint as TooltipHintBase, TooltipAnchor } from '@gnomad/ui'
// @ts-expect-error ts-migrate(2307) FIXME: Cannot find module '@fortawesome/fontawesome-free/... Remove this comment to see the full error message
import Warning from '@fortawesome/fontawesome-free/svgs/solid/exclamation-triangle.svg'
import AnalysisControls from '../AnalysisControls'
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
import RangeSlider from './RangeSlider'
import {
  pValueTypeToPValueKeyName,
  P_VALUE_BURDEN,
  P_VALUE_SKAT,
  P_VALUE_SKAT_O,
  greenThresholdColor,
  yellowThresholdColor,
  geneGreenThreshold,
  geneYellowThreshold,
  RoundedNumber,
  variantYellowThreshold,
  variantGreenThreshold,
} from './Utils'

import { ColorMarker } from '../UserInterface'
import { GeneAssociations } from '../types'
import filterPhenotypes from './filterPhenotypes'

const RootContainerGene = styled.div`
  display: flex;
  flex-direction: row;
  width: 100%;
  min-height: 2000px;
  max-width: 100%;

  .data-container {
    display: flex;
    width: 100%;
    flex-direction: column;
    overflow-y: auto;
    max-height: calc(100vh - 12em);
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
const ControlContainer = styled.div`
  max-width: 230px;
  min-width: 230px;

  padding-bottom: 20px;

  max-height: calc(100vh - 12em);
  overflow-y: auto;

  display: grid;
  grid-gap: 1.5em;
  grid-auto-rows: min-content;
  grid-template-columns: 1fr;
  grid-template-areas:
    'filter-analyses'
    'ancestry-group'
    'pvalue-type'
    'pvalue-legend'
    'pvalue-sliders'
    'plot-options'
    'categories';

  .filter-analyses {
    grid-area: filter-analyses;
  }

  .burden-set {
    grid-area: burden-set;
  }

  .plot-options {
    grid-area: plot-options;

    .plot-option-checkboxes {
      margin-top: 5px;
      display: flex;
      flex-direction: column;
      align-items: flex start;
    }

    input {
      margin-right: 1em;
      margin-left: 1em;
    }
  }

  .pvalue-legend {
    grid-area: pvalue-legend;

    display: flex;
    flex-direction: column;
    width: 100%;
    justify-content: flex-start;

    input {
      margin-right: 1em;
      margin-left: 1em;
    }
  }

  .ancestry-group {
    grid-area: ancestry-group;
  }

  .pvalue-type {
    grid-area: pvalue-type;
  }

  .pvalue-sliders {
    grid-area: pvalue-sliders;
    display: flex;
    flex-direction: column;
    max-width: 90%;
  }

  .selection-controls {
    width: 100%;
    grid-area: selection-controls;

    margin-top: 5px;
    margin-bottom: 5px;

    * {
      margin-right: 5px;
    }
  }

  .categories {
    grid-area: categories;
    padding-right: 20px;
    max-height: 300px;
    min-height: 300px;
    overflow-y: scroll;
  }
`

const RootContainerVariant = styled(RootContainerGene)`
  max-height: calc(100vh - 10em);
  grid-template-areas:
    'filter-analyses'
    'pvalue-legend'
    'pvalue-sliders'
    'plot-options'
    'categories';
`

const TableContainer = styled.div`
  position: relative;
  grid-column: 2 / 3;
  grid-row: 2 / 3;
  display: flex;
  flex-direction: column;
  min-width: 100%;
  height: 100%;
`

const AlwaysVisibleControls = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-around;
  align-items: center;
  flex-wrap: wrap;
  max-height: min-content;
  flex-shrink: 0;
  margin-bottom: 10px;

  .analysis-group-small,
  .burden-test-small {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    margin-top: 5px;
    margin-bottom: 5px;

    * {
      margin-right: 5px;
    }
  }

  .selection-controls {
    display: flex;
    flex-direction: column;

    .selection-buttons {
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: center;
      margin-bottom: 3px;
    }

    margin-top: 5px;
    margin-bottom: 5px;

    * {
      margin-right: 5px;
    }
  }
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

// UKBB Path category name for phenotypes whose `category` attribute are falsy (null, empty string etc):
const nullCategoryName = 'Unknown Category'

const pValueSliderStep = 1
const betaSliderStep = 0.01

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
  const searchInput = useRef(null)

  const [sortKey, updateSortKey] = useState('pvalue')

  const [plotSortKey, setPlotSortKey] = useState('pvalue')
  const [logLogEnabled, setLogLogEnabled] = useState(false)

  const [sortDirection, updateSortAscending] = useState('ascending')

  const [pvalPlotSelectionBoundary, internalSetPvalPlotSelectionBoundary] = useState(undefined)
  const [betaPlotSelectionBoundary, internalSetBetaPlotSelectionBoundary] = useState(undefined)

  const showPhewasControls = useRecoilValue(phewasOptsAtom)

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

  const windowSize = useRecoilValue(windowSizeAtom)

  const analysesColors = useRecoilValue(selectedAnalysesColorsSelector)

  const selected = analyses.length > 0 ? analyses : [analysisId]

  const [pValueType, setPValueType] = useRecoilState(pValueTypeAtom)

  const [ancestryGroup, setAncestryGroup] = useRecoilState(ancestryGroupAtom)

  // const clearSelectedAnalyses = useClearSelectedAnalyses()
  //


  // const [plotType, setPlotType] = useState(phewasType === "locus" ? 'P-value' : 'Both')
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

  const pValueKeyName = pValueTypeToPValueKeyName[pValueType]

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

  const plotTypeOptions = [{ value: 'P-value' }, { value: 'Beta' }, { value: 'Both' }]

  const splitCategory = (category: string) => {
    if (typeof category !== 'string') {
      return ['Unknown Category']
    }
    if (!category) {
      return ['Unknown Category']
    }
    if (category.includes('|')) {
      return ['Other', ...category.split(' | ')]
    } else if (category.includes(' > ')) {
      return category.split(' > ')
    }
    return [category]
  }

  const classifications = useMemo(() => {
    const rawNonNullCategories = categories.filter((elem: any) => !!elem.category)
    // const rawNullCategories = categories.filter((elem: any) => !elem.category)
    const processedNonNullCategories = rawNonNullCategories
      .filter((c: any) => c.classification_group === 'axaou_category')
      .map((c: any) => ({
        path: splitCategory(c.category),
        itemCount: c.analysisCount,
        color: c.color,
      }))
    // const processedNullCategory = {
    //   path: [nullCategoryName],
    //   itemCount: sum(rawNullCategories.map((elem: any) => elem.analysisCount)),
    //   color: rawNullCategories[0].color,
    // }

    const axaouCategory = {
      name: 'AxAoU Category',
      type: ClassificationType.Hierarchical,
      categories: [
        ...processedNonNullCategories,
        // processedNullCategory
      ],
      getPathValueOfItem: ({ category }: any) =>
        !!category ? [splitCategory(category)] : [[nullCategoryName]],
    }

    return [axaouCategory]
  }, [uniquePhenotypes, categories])

  // debugger

  const {
    filteredItemsWithColorAndGrouping: filteredPhenotypesWithColorAndGrouping,
    filteredItems,
    ...classificationSelectorInternalState
  } = useClassificationSelectorState({
    // @ts-expect-error ts-migrate(2322) FIXME: Type '{ name: string; type: ClassificationType; ca... Remove this comment to see the full error message
    classifications,
    items: uniquePhenotypes,
    shouldAutoExpandFirstClassification: true,
    expanded: ['']
  })

  // const filteredPhenotypesWithColorAndGroupingDedup = uniqBy(
  //   filteredPhenotypesWithColorAndGrouping,
  //   p => p.phenotype_id
  // )
  //

  const phenotypesWithPreparedText = preparePhenotypesText(filteredPhenotypesWithColorAndGrouping)

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
    pValueType === P_VALUE_BURDEN ? null : (
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

  const analysisGroupControl = isGenePhewas ? (
    <div className='burden-set'>
      <strong>Burden set</strong>
      <div>
        <AnalysisControls burdenSet={burdenSet} setBurdenSet={setBurdenSet} />
      </div>
      {/* <div style={{ marginTop: 3 }}> */}
      {/*   <TooltipAnchor */}
      {/*     tooltip={ */}
      {/*       'Caution is warranted when checked, as list will include filtered phenotypes with lambda GC outside 0.75-1.5 (indicated by dotted circles)' */}
      {/*     } */}
      {/*   > */}
      {/*     <TooltipHint> */}
      {/*       <Checkbox */}
      {/*         label='Include filtered' */}
      {/*         checked={showFilteredAnalyses} */}
      {/*         id='show-filtered-phenotypes' */}
      {/*         disabled={false} */}
      {/*         onChange={() => { */}
      {/*           setShowFilteredAnalyses(!showFilteredAnalyses) */}
      {/*         }} */}
      {/*       /> */}
      {/*     </TooltipHint> */}
      {/*   </TooltipAnchor> */}
      {/* </div> */}
    </div>
  ) : null
  const controlElements = (
    <ControlContainer>
      <div className='filter-analyses'>
        <SearchInput
          ref={searchInput}
          placeholder='Filter phenotypes'
          onChange={(text: any) => {
            updateSearchText(text)
          }}
        />
      </div>
      {/* <div className='ancestry-group'> */}
      {/*   <strong>Ancestry group</strong> */}
      {/*   <div> */}
      {/*     <SegmentedControl */}
      {/*       id='ancestry-group-control2' */}
      {/*       options={['meta', 'afr', 'amr', 'eas'].map((ancestry_code) => ({ */}
      {/*         value: ancestry_code, */}
      {/*         label: ancestry_code.toUpperCase(), */}
      {/*         disabled: !availableAncestries.includes(ancestry_code as AncestryGroupCodes), */}
      {/*       }))} */}
      {/*       value={ancestryGroup} */}
      {/*       onChange={setAncestryGroup} */}
      {/*     /> */}
      {/*   </div> */}
      {/*   <div style={{ paddingTop: '2px' }}> */}
      {/*     <SegmentedControl */}
      {/*       id='ancestry-group-control1' */}
      {/*       options={['eur', 'mid', 'sas'].map((ancestry_code) => ({ */}
      {/*         value: ancestry_code, */}
      {/*         label: ancestry_code.toUpperCase(), */}
      {/*         disabled: !availableAncestries.includes(ancestry_code as AncestryGroupCodes), */}
      {/*       }))} */}
      {/*       value={ancestryGroup} */}
      {/*       onChange={setAncestryGroup} */}
      {/*     /> */}
      {/*   </div> */}
      {/* </div> */}
      {isGenePhewas && (
        <div className='pvalue-type'>
          <strong>Burden test</strong>
          <div>
            <SegmentedControl
              id='pvalue-type-control'
              options={[
                { value: P_VALUE_BURDEN, label: 'Burden' },
                { value: P_VALUE_SKAT, label: 'SKAT' },
                { value: P_VALUE_SKAT_O, label: 'SKAT-O' },
              ]}
              value={pValueType}
              onChange={setPValueType}
            />
          </div>
        </div>
      )}
      <div className='pvalue-legend'>
        <strong>{`${isGenePhewas ? 'Gene' : 'Variant'}`} P-value coloring</strong>
        <span>
          <ColorMarker color='white' />
          1.0 &gt;{' '}
          <RoundedNumber
            num={isGenePhewas ? geneYellowThreshold : variantYellowThreshold}
            highlightColor={yellowThresholdColor}
          />{' '}
          &gt;{' '}
          <RoundedNumber
            num={isGenePhewas ? geneGreenThreshold : variantGreenThreshold}
            highlightColor={greenThresholdColor}
          />
        </span>
      </div>
      <div className='pvalue-sliders'>
        <div>
          <strong>
            <span>-Log</span>
            <sub>10</sub>
            <span>P cutoffs</span>
          </strong>
          <RangeSlider
            presetInterval={[pIntervalMin, pIntervalMax]}
            onIntervalChange={handlePvalueIntervalChange}
            currentValue={pValueInterval}
            step={pValueSliderStep}
          />
        </div>
        {/* <div> */}
        {/*   <strong>Beta cutoffs</strong> */}
        {/*   <RangeSlider */}
        {/*     presetInterval={[betaIntervalMin, betaIntervalMax]} */}
        {/*     onIntervalChange={setBetaInterval} */}
        {/*     step={betaSliderStep} */}
        {/*     initialInterval={[initialBetaIntervalMin, initialBetaIntervalMax]} */}
        {/*   /> */}
        {/* </div> */}
      </div>
      <div className='plot-options'>
        <strong>Plot options</strong>
        <br />
        <SegmentedControl
          id='plot-type'
          options={plotTypeOptions}
          value={plotType}
          onChange={setPlotType}
        />
        <div className='plot-option-checkboxes'>
          <label>
            <input
              type='checkbox'
              checked={plotSortKey === 'pvalue'}
              onChange={handlePvalueOrder}
            />
            P-value ordered
          </label>
          <label>
            <input type='checkbox' checked={logLogEnabled} onChange={handleLogLogEnable} />
            Log Log Plot
          </label>
        </div>
      </div>

      <div className='categories'>
        <strong>Categories</strong>
        <ClassificationSelector
          // @ts-expect-error
          classifications={classifications}
          categoryListMaxHeight='90vh'
          {...classificationSelectorInternalState}
        />
      </div>
    </ControlContainer>
  )

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

  let numRowsRendered = 12

  if (windowSize.height) {
    numRowsRendered = (windowSize.height - 500) / 30
  }

  if (numRowsRendered < 15) {
    numRowsRendered = 15
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
        {showPhewasControls && size.width > 700 && <>{controlElements}</>}
        <div className='data-container'>
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
          <AlwaysVisibleControls>
            {isGenePhewas && <div className='analysis-group-small'>{analysisGroupControl}</div>}
            {phewasType !== 'topHit' && (
              <div className='selection-controls'>
                <strong>Multi-phenotype selection</strong>
                <div className='selection-buttons'>
                  <Button onClick={() => setSelectedAnalyses(topAnalyses)}>Select top</Button>
                  <Button
                    disabled={analyses.length === 1}
                    onClick={() => setSelectedAnalyses([analysisId])}
                  >
                    Clear selected {analyses.length > 1 && <span>({analyses.length})</span>}{' '}
                  </Button>
                </div>
                <Checkbox
                  label='Filter to selected'
                  checked={showSelectAnalysesOnly}
                  id='multi-analysis-filter-traits-to-selected'
                  disabled={false}
                  onChange={() => {
                    setShowSelectAnalysesOnly(!showSelectAnalysesOnly)
                  }}
                />
              </div>
            )}
          </AlwaysVisibleControls>
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
