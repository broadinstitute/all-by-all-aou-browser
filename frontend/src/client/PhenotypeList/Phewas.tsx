/* eslint-disable one-var */
/* eslint-disable no-extra-boolean-cast */
/* eslint-disable no-restricted-syntax */
/* eslint-disable prefer-destructuring */
/* eslint-disable no-else-return */
/* eslint-disable no-shadow */
/* eslint-disable camelcase */
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
import { Button } from '@gnomad/ui'
import {
  pValueTypeToPValueKeyName,
  P_VALUE_BURDEN,
  P_VALUE_SKAT,
  P_VALUE_SKAT_O,
  geneYellowThreshold,
} from './Utils'

import { GeneAssociations } from '../types'
import filterPhenotypes from './filterPhenotypes'
import { ShowControlsButton } from '../UserInterface'

const RootContainerGene = styled.div`
  display: flex;
  flex-direction: row;
  width: 100%;
  min-height: 1300px;
  max-width: 100%;
  min-width: 0;

  .data-container {
    display: flex;
    width: 100%;
    flex-direction: column;
    padding-right: 10px;
    min-width: 0;
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
  width: 100%;
  flex-shrink: 0;
  min-width: 0;
  min-height: 0;
`

const DragHandle = styled.div`
  height: 12px;
  background: var(--theme-surface-alt, #f0f0f0);
  border-top: 1px solid var(--theme-border, #e0e0e0);
  border-bottom: 1px solid var(--theme-border, #e0e0e0);
  cursor: ns-resize;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  z-index: 10;
  flex-shrink: 0;

  &:hover {
    background: var(--theme-primary, #428bca);
  }

  &::after {
    content: '';
    width: 60px;
    height: 4px;
    background: var(--theme-border, #ccc);
    border-radius: 2px;
  }

  &:hover::after {
    background: white;
  }
`

const RootContainerVariant = styled(RootContainerGene)``

const TableContainer = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  overflow: hidden;
  min-width: 0;
  min-height: 0;
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
  // Log-log scale is always enabled

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

  // Plot height state for draggable resizing (total plot area height)
  const [totalPlotHeight, setTotalPlotHeight] = useState(450)
  const [isDragging, setIsDragging] = useState(false)

  // Simple category state - Set of selected category names
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(() => {
    return new Set(categories.map((c: Category) => c.category))
  })

  // State for draggable labels
  const [labeledPhenoIds, setLabeledPhenoIds] = useState<Set<string>>(new Set())
  const [pvalLabelOverrides, setPvalLabelOverrides] = useState<Record<string, {x: number, y: number}>>({})
  const [betaLabelOverrides, setBetaLabelOverrides] = useState<Record<string, {x: number, y: number}>>({})
  const [hasInitializedLabels, setHasInitializedLabels] = useState(false)

  // Generate unique row ID - for topHit mode, combine gene_id and analysis_id
  const getRowId = React.useCallback((row: any) => {
    if (phewasType === 'topHit' && row.gene_id) {
      return `${row.gene_id}:${row.analysis_id}`
    }
    return row.analysis_id
  }, [phewasType])

  // Initialize default label
  React.useEffect(() => {
    if (!hasInitializedLabels && uniquePhenotypes && uniquePhenotypes.length > 0) {
      const initials = new Set<string>()
      if (phewasType === 'topHit') {
        // For top results page: only label the single top hit
        const topHit = [...uniquePhenotypes].sort((a: any, b: any) => a.pvalue - b.pvalue)[0]
        if (topHit) initials.add(getRowId(topHit))
      } else {
        // For other pages: label the current/primary phenotype
        uniquePhenotypes.forEach((p: any) => {
          if (p.analysis_id === analysisId) {
            initials.add(getRowId(p))
          }
        })
      }
      setLabeledPhenoIds(initials)
      setHasInitializedLabels(true)
    }
  }, [uniquePhenotypes, hasInitializedLabels, getRowId, analysisId, phewasType])

  // Update label when active/primary phenotype changes (via "show" button)
  // For topHit mode: clear all labels (user can manually add via checkbox)
  // For other modes: add the active phenotype to existing labels
  React.useEffect(() => {
    if (!uniquePhenotypes || uniquePhenotypes.length === 0) return
    if (phewasType === 'topHit') {
      // For topHit, clear labels when switching phenotypes
      // (table click only updates analysisId, not geneId, so we can't reliably match)
      setLabeledPhenoIds(new Set())
    } else {
      // For other modes, add to existing labels
      setLabeledPhenoIds((prev) => {
        const next = new Set(prev)
        uniquePhenotypes.forEach((p: any) => {
          if (p.analysis_id === analysisId) {
            next.add(getRowId(p))
          }
        })
        return next
      })
    }
  }, [analysisId, uniquePhenotypes, getRowId, phewasType])

  const handlePvalDragEnd = React.useCallback((id: string, x: number, y: number) => {
    setPvalLabelOverrides((prev) => ({ ...prev, [id]: { x, y } }))
  }, [])

  const handleBetaDragEnd = React.useCallback((id: string, x: number, y: number) => {
    setBetaLabelOverrides((prev) => ({ ...prev, [id]: { x, y } }))
  }, [])

  const toggleLabel = React.useCallback((id: string) => {
    setLabeledPhenoIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

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

  const [plotType, setPlotType] = useState('Both')
  const [useDirectionalShapes, setUseDirectionalShapes] = useState(false)

  // Calculate individual plot heights based on total and plot type
  const pValuePlotHeight = plotType === 'Both' ? Math.floor(totalPlotHeight * 0.55) : totalPlotHeight
  const betaPlotHeight = plotType === 'Both' ? totalPlotHeight - pValuePlotHeight : totalPlotHeight

  const columns = useMemo(() => {
    const processed = originalColumns.map((originalColumn: any) => {
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

    // Prepend Label checkbox column
    processed.unshift({
      key: 'label',
      displayId: 'label',
      heading: 'Label',
      minWidth: 50,
      grow: 0,
      render: (row: any) => (
        <input
          type="checkbox"
          checked={labeledPhenoIds.has(getRowId(row))}
          onChange={() => toggleLabel(getRowId(row))}
          onClick={(e) => e.stopPropagation()}
          style={{ cursor: 'pointer', margin: '0 auto', display: 'block' }}
        />
      ),
    })

    return processed
  }, [originalColumns, showFilteredAnalyses, pValueType, ancestryGroup, labeledPhenoIds, toggleLabel, getRowId])

  const phenotypesWithPreparedText = preparePhenotypesText(phenotypesWithColor)

  const filteredByOtherCriteria = filterPhenotypes({
    phenotypes: phenotypesWithPreparedText,
    searchText,
    pValueType,
    showFilteredAnalyses: isGenePhewas ? showFilteredAnalyses : true,
    phewasType,
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

  // Drag handler for resizing plot area vs table
  const handlePlotDragStart = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
    const startY = e.clientY
    const startHeight = totalPlotHeight

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - startY
      const newHeight = Math.max(150, Math.min(600, startHeight + deltaY))
      setTotalPlotHeight(newHeight)
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
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
    // Account for plot height when calculating available table space
    // Base offset includes header, controls, and other UI elements
    const baseOffset = 280
    const availableHeight = windowSize.height - baseOffset - totalPlotHeight
    numRowsRendered = Math.floor(availableHeight / 25) // 25px per row
  }

  if (numRowsRendered < 10) {
    numRowsRendered = 10
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
            plotType={plotType}
            setPlotType={setPlotType}
            plotSortKey={plotSortKey}
            onTogglePvalueOrder={handlePvalueOrder}
            useDirectionalShapes={useDirectionalShapes}
            onToggleDirectionalShapes={() => setUseDirectionalShapes(!useDirectionalShapes)}
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--theme-surface-alt, #f5f5f5)', borderRadius: '4px', marginBottom: '8px', fontSize: '12px' }}>
            <div>
              <span style={{ color: 'var(--theme-text)' }}><strong>{labeledPhenoIds.size}</strong> phenotypes labeled</span>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {labeledPhenoIds.size > 0 && (
                <Button onClick={() => setLabeledPhenoIds(new Set())} style={{ padding: '4px 8px', fontSize: '11px' }}>
                  Clear labels
                </Button>
              )}
              {(Object.keys(pvalLabelOverrides).length > 0 || Object.keys(betaLabelOverrides).length > 0) && (
                <Button onClick={() => { setPvalLabelOverrides({}); setBetaLabelOverrides({}); }} style={{ padding: '4px 8px', fontSize: '11px' }}>
                  Reset layout
                </Button>
              )}
            </div>
          </div>
          <PlotContainer style={{ minHeight: totalPlotHeight }}>
            {plotType === 'Both' && (
              <>
                <PhewasPvaluePlot
                  analyses={displayPlotPhenotypes}
                  activeAnalyses={activeAnalyses}
                  activeGene={geneIdOrName}
                  primaryAnalysisId={analysisId}
                  onClickPoint={onPointClick}
                  pValueType={pValueType}
                  pointColor={analysisPointColor}
                  logLogEnabled={true}
                  pointRadius={pointRadius}
                  showStroke={showStroke}
                  pointLabel={pointLabel}
                  height={pValuePlotHeight}
                  phewasType={phewasType}
                  labeledPhenoIds={labeledPhenoIds}
                  labelOverrides={pvalLabelOverrides}
                  onLabelDragEnd={handlePvalDragEnd}
                  useDirectionalShapes={useDirectionalShapes}
                />
                <PhewasBetaPlot
                  analyses={displayPlotPhenotypes}
                  activeAnalyses={activeAnalyses}
                  activeGene={geneIdOrName}
                  primaryAnalysisId={analysisId}
                  onClickPoint={onPointClick}
                  pointColor={analysisPointColor}
                  pointRadius={pointRadius}
                  showStroke={showStroke}
                  pointLabel={pointLabel}
                  height={betaPlotHeight}
                  phewasType={phewasType}
                  labeledPhenoIds={labeledPhenoIds}
                  labelOverrides={betaLabelOverrides}
                  onLabelDragEnd={handleBetaDragEnd}
                />
              </>
            )}
            {plotType === 'P-value' && (
              <PhewasPvaluePlot
                analyses={plotPhenotypes}
                activeAnalyses={selected}
                activeGene={geneIdOrName}
                primaryAnalysisId={analysisId}
                onClickPoint={onPointClick}
                pValueType={pValueType}
                logLogEnabled={true}
                pointRadius={pointRadius}
                showStroke={showStroke}
                pointLabel={pointLabel}
                height={totalPlotHeight}
                phewasType={phewasType}
                labeledPhenoIds={labeledPhenoIds}
                labelOverrides={pvalLabelOverrides}
                onLabelDragEnd={handlePvalDragEnd}
                useDirectionalShapes={useDirectionalShapes}
              />
            )}
            {plotType === 'Beta' && (
              <PhewasBetaPlot
                analyses={plotPhenotypes}
                activeAnalyses={selected}
                activeGene={geneIdOrName}
                primaryAnalysisId={analysisId}
                onClickPoint={onPointClick}
                pointRadius={pointRadius}
                showStroke={showStroke}
                pointLabel={pointLabel}
                height={totalPlotHeight}
                phewasType={phewasType}
                labeledPhenoIds={labeledPhenoIds}
                labelOverrides={betaLabelOverrides}
                onLabelDragEnd={handleBetaDragEnd}
              />
            )}
          </PlotContainer>
          <DragHandle
            onMouseDown={handlePlotDragStart}
            style={{ cursor: isDragging ? 'ns-resize' : 'ns-resize' }}
            title="Drag to resize plot area"
          />
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
