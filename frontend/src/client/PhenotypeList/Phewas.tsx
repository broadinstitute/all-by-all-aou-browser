/* eslint-disable one-var */
/* eslint-disable no-extra-boolean-cast */
/* eslint-disable no-restricted-syntax */
/* eslint-disable prefer-destructuring */
/* eslint-disable no-else-return */
/* eslint-disable no-shadow */
/* eslint-disable camelcase */
import sortBy from 'lodash/sortBy'
import React, { useMemo, useRef, useState } from 'react'
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
import { BurdenDirectionIndicator } from '../BurdenDirectionIndicator'
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
import { mobileControlContract, optionPanelContract } from '../browserUiContracts'
import {
  filterToComparedPhenotypes,
  getPhewasEmptyStateMessage,
  resolvePhewasControlsOpen,
  selectPhewasExportRows,
  shouldShowComparedOnly,
  updateTopHitDetailLabel,
} from './phewasDisplay'
import { getPhewasTableLayoutPolicy, PhewasLayoutMode } from './phewasLayout'

const RootContainerGene = styled.div<{ $layoutMode: PhewasLayoutMode }>`
  display: flex;
  flex-direction: row;
  width: 100%;
  min-height: ${({ $layoutMode }) => ($layoutMode === 'document' ? '0' : '1300px')};
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

const PhenotypeTableInnerContainer = styled.div<{ $layoutMode: PhewasLayoutMode }>`
  position: ${({ $layoutMode }) => ($layoutMode === 'document' ? 'relative' : 'absolute')};
  width: 100%;
  height: ${({ $layoutMode }) => ($layoutMode === 'document' ? 'auto' : '100%')};
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

const TableContainer = styled.div<{ $layoutMode: PhewasLayoutMode }>`
  position: relative;
  display: flex;
  flex-direction: column;
  flex: ${({ $layoutMode }) => ($layoutMode === 'document' ? '0 0 auto' : '1 1 auto')};
  overflow: ${({ $layoutMode }) => ($layoutMode === 'document' ? 'visible' : 'hidden')};
  min-width: 0;
  min-height: 0;
`

const MobileOptionsBackdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: 999;
  background: rgba(0, 0, 0, 0.4);
`

const MobileOptionsButton = styled.button`
  align-self: flex-start;
  min-height: 44px;
  margin: 0 0 8px 12px;
  padding: 8px 12px;
  border: 1px solid var(--theme-border, #e0e0e0);
  border-radius: 4px;
  background: var(--theme-surface-alt, #f5f5f5);
  color: var(--theme-text, #333);
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;

  &:focus-visible {
    outline: 2px solid var(--theme-primary, #4f46e5);
    outline-offset: 2px;
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

interface Category {
  category: string
  color: string
  analysisCount: number
}

type PhewasProps = {
  columns: any[]
  onPointClick: (phenotype: any) => void
  uniquePhenotypes: any[]
  categories: Category[]
  exportFileName: string
  enableExport?: boolean
  availableAncestries?: AncestryGroupCodes[]
  onHoverAnalysis?: (analysisId: string | null) => void
  size: { width: number; height: number }
  phewasType?: 'variant' | 'topHit' | 'gene' | 'locus'
  layoutMode?: PhewasLayoutMode
  burdenSet?: unknown
  setBurdenSet?: unknown
  showPlotTypeControls?: boolean
  showAnalysisGroups?: boolean
  showBurdenTestControls?: boolean
}

const Phewas = ({
  columns: originalColumns,
  onPointClick,
  uniquePhenotypes,
  categories,
  exportFileName,
  enableExport = false,
  availableAncestries = ['afr', 'amr', 'eas', 'eur', 'mid', 'sas', 'meta'] as AncestryGroupCodes[],
  onHoverAnalysis,
  size,
  phewasType = 'gene', // "variant", "topHit", "gene", "locus"
  layoutMode = 'pane',
}: PhewasProps) => {
  const isGenePhewas = phewasType === 'gene' || phewasType === 'topHit'
  const [ancestryGroup, setAncestryGroup] = useRecoilState(ancestryGroupAtom)
  const showEffectEstimate = !isGenePhewas || ancestryGroup !== 'meta'
  const showMetaBurdenDirection = isGenePhewas && ancestryGroup === 'meta'

  const [searchText, updateSearchText] = useState('')

  const [sortKey, updateSortKey] = useState('pvalue')

  const [plotSortKey, setPlotSortKey] = useState('description')
  // Log-log scale is always enabled

  const [sortDirection, updateSortAscending] = useState('ascending')

  const [pvalPlotSelectionBoundary, internalSetPvalPlotSelectionBoundary] = useState(undefined)
  const [betaPlotSelectionBoundary, internalSetBetaPlotSelectionBoundary] = useState(undefined)

  const [showPhewasControls, setShowPhewasControls] = useRecoilState(phewasOptsAtom)
  const [showMobilePhewasControls, setShowMobilePhewasControls] = useState(false)
  const mobileOptionsTriggerRef = useRef<HTMLButtonElement>(null)
  const isMobileOptions =
    size.width > 0 && size.width <= mobileControlContract.phewasOptions.breakpoint
  const controlsOpen = resolvePhewasControlsOpen(
    isMobileOptions,
    showMobilePhewasControls,
    showPhewasControls
  )

  const openPhewasControls = () => {
    if (isMobileOptions) setShowMobilePhewasControls(true)
    else setShowPhewasControls(true)
  }

  const closePhewasControls = () => {
    if (isMobileOptions) {
      setShowMobilePhewasControls(false)
      setTimeout(() => mobileOptionsTriggerRef.current?.focus(), 0)
    } else {
      setShowPhewasControls(false)
    }
  }

  // A narrow drawer is transient UI, not the persisted desktop panel preference.
  React.useEffect(() => {
    if (!isMobileOptions) setShowMobilePhewasControls(false)
  }, [isMobileOptions])

  React.useEffect(() => {
    if (!isMobileOptions || !showMobilePhewasControls) return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isMobileOptions, showMobilePhewasControls])

  const analyses = useRecoilValue(selectedAnalyses)

  const analysisId = useRecoilValue(analysisIdAtom)
  const geneIdOrName = useRecoilValue(geneIdAtom)

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

  // Clear labels when the active analysis changes
  // For topHit mode, don't reset initialization — the update effect handles label changes
  React.useEffect(() => {
    if (phewasType !== 'topHit') {
      setLabeledPhenoIds(new Set())
      setHasInitializedLabels(false)
    }
    setPvalLabelOverrides({})
    setBetaLabelOverrides({})
  }, [analysisId, phewasType])

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
        // For top results page: start with no labels until user clicks an arrow
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

  // Track previous topHit selection so we can swap it out
  const prevTopHitSelectionRef = useRef<string | null>(null)

  // Update label when active/primary phenotype changes (via "show" button)
  // For topHit mode: replace previous selection label with the new one
  // For other modes: add the active phenotype to existing labels
  React.useEffect(() => {
    if (!uniquePhenotypes || uniquePhenotypes.length === 0) return
    setLabeledPhenoIds((prev) => {
      const next = new Set(prev)
      if (phewasType === 'topHit') {
        const update = updateTopHitDetailLabel(
          next,
          prevTopHitSelectionRef.current,
          geneIdOrName,
          analysisId
        )
        prevTopHitSelectionRef.current = update.activeTopHitId
        return update.labeledIds
      } else {
        uniquePhenotypes.forEach((p: any) => {
          if (p.analysis_id === analysisId) {
            next.add(getRowId(p))
          }
        })
      }
      return next
    })
  }, [analysisId, geneIdOrName, uniquePhenotypes, getRowId, phewasType])

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

  const selected = analyses.length > 0 ? analyses : (analysisId ? [analysisId] : [])

  const [pValueType, setPValueType] = useRecoilState(pValueTypeAtom)

  // Keep sort key in sync when the burden test type changes
  const pValueFieldNames = Object.values(pValueTypeToPValueKeyName) as string[]
  React.useEffect(() => {
    const currentPvalField = pValueTypeToPValueKeyName[pValueType]
    if (pValueFieldNames.includes(sortKey)) {
      updateSortKey(currentPvalField)
    }
    if (pValueFieldNames.includes(plotSortKey)) {
      setPlotSortKey(currentPvalField)
    }
  }, [pValueType])

  const [plotType, setPlotType] = useState(
    phewasType === 'topHit' || !showEffectEstimate ? 'P-value' : 'Both'
  )
  const [useDirectionalShapes, setUseDirectionalShapes] = useState(false)

  React.useEffect(() => {
    if (!showEffectEstimate) {
      setPlotType('P-value')
      setUseDirectionalShapes(false)
    }
  }, [showEffectEstimate])

  // Calculate individual plot heights based on total and plot type
  const pValuePlotHeight = plotType === 'Both' ? Math.floor(totalPlotHeight * 0.55) : totalPlotHeight
  const betaPlotHeight = plotType === 'Both' ? totalPlotHeight - pValuePlotHeight : totalPlotHeight

  const columns = useMemo(() => {
    const processed = originalColumns.map((originalColumn: any) => {
      if (originalColumn.displayId === 'pvalue') {
        const column = { ...originalColumn }
        column.key = 'pvalue'
        column.sortKey = pValueTypeToPValueKeyName[pValueType]
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
    (!showEffectEstimate || !isGenePhewas || pValueType === P_VALUE_BURDEN) ? null : (
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

  const comparisonFilterActive = shouldShowComparedOnly(
    showSelectAnalysesOnly,
    phewasType,
    analyses
  )
  const displayPlotPhenotypes = filterToComparedPhenotypes(
    plotPhenotypes,
    analyses,
    comparisonFilterActive
  )
  const displayTablePhenotypes = filterToComparedPhenotypes(
    tablePhenotypes,
    analyses,
    comparisonFilterActive
  )
  const exportPhenotypes = selectPhewasExportRows(displayTablePhenotypes)
  let pointRadius = comparisonFilterActive ? 6 : 4

  // Do not let an empty comparison keep a hidden filter armed. Top-hit mode ignores
  // the shared state without consuming it because it has no comparison controls.
  React.useEffect(() => {
    if (phewasType !== 'topHit' && analyses.length === 0 && showSelectAnalysesOnly) {
      setShowSelectAnalysesOnly(false)
    }
  }, [analyses.length, phewasType, setShowSelectAnalysesOnly, showSelectAnalysesOnly])

  const analysisPointColor = (analysis: any) => {
    if (comparisonFilterActive) {
      const analysisColor: { analysisId: string; color: string } | undefined = analysesColors.find(
        (a) => a.analysisId === analysis.analysis_id
      )
      return (analysisColor && analysisColor.color) || 'grey'
    }
    return (analysis && analysis.color) || 'white'
  }

  const activeAnalyses = comparisonFilterActive ? undefined : selected

  const tableLayoutPolicy = getPhewasTableLayoutPolicy({
    layoutMode,
    rowCount: displayTablePhenotypes.length,
    windowHeight: windowSize.height,
    plotHeight: totalPlotHeight,
  })

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
      <RootContainer $layoutMode={layoutMode} data-phewas-layout={layoutMode}>
        {controlsOpen && isMobileOptions && (
          <MobileOptionsBackdrop aria-hidden="true" onClick={closePhewasControls} />
        )}
        {controlsOpen && (
          <PhewasControls
            onSearchChange={updateSearchText}
            onClose={closePhewasControls}
            isMobile={isMobileOptions}
            isGenePhewas={isGenePhewas}
            showEffectEstimate={showEffectEstimate}
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
            onSelectTop={() =>
              setSelectedAnalyses([...new Set([...analyses, ...topAnalyses])])
            }
            onClearSelected={() => setSelectedAnalyses([])}
            showComparedOnly={comparisonFilterActive}
            onToggleShowComparedOnly={() => setShowSelectAnalysesOnly(!comparisonFilterActive)}
            phewasType={phewasType}
            categories={categories}
            selectedCategories={selectedCategories}
            onToggleCategory={handleToggleCategory}
            onSelectAllCategories={handleSelectAllCategories}
            onSelectNoCategories={handleSelectNoCategories}
          />
        )}
        {!controlsOpen && !isMobileOptions && (
          <ShowControlsButton
            type="button"
            onClick={openPhewasControls}
            title={`Show ${optionPanelContract.phewas.label}`}
            aria-label={`Show ${optionPanelContract.phewas.label}`}
            aria-expanded={false}
            aria-controls={optionPanelContract.phewas.id}
          >
            {optionPanelContract.phewas.label}
          </ShowControlsButton>
        )}
        <div className='data-container' style={{ position: 'relative' }}>
          {!controlsOpen && isMobileOptions && (
            <MobileOptionsButton
              ref={mobileOptionsTriggerRef}
              type="button"
              onClick={openPhewasControls}
              title={`Show ${optionPanelContract.phewas.label}`}
              aria-label={`Show ${optionPanelContract.phewas.label}`}
              aria-expanded={false}
              aria-controls={optionPanelContract.phewas.id}
            >
              {optionPanelContract.phewas.label}
            </MobileOptionsButton>
          )}
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
            {showEffectEstimate && plotType === 'Both' && (
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
                  useDirectionalShapes={showMetaBurdenDirection || (showEffectEstimate && useDirectionalShapes)}
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
                analyses={displayPlotPhenotypes}
                activeAnalyses={activeAnalyses}
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
                useDirectionalShapes={showMetaBurdenDirection || (showEffectEstimate && useDirectionalShapes)}
              />
            )}
            {showEffectEstimate && plotType === 'Beta' && (
              <PhewasBetaPlot
                analyses={displayPlotPhenotypes}
                activeAnalyses={activeAnalyses}
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
          <TableContainer $layoutMode={layoutMode}>
            <PhenotypeTableInnerContainer $layoutMode={layoutMode}>
              <PhenotypeTable
                columns={columns}
                highlightText={searchText}
                onHoverPhenotype={onHoverAnalysis}
                onRequestSort={onSort}
                onVisibleRowsChange={onVisibleRowsChange}
                sortKey={sortKey}
                sortOrder // TODO
                phenotypes={displayTablePhenotypes}
                numRowsRendered={tableLayoutPolicy.numRowsRendered}
                emptyStateHeight={tableLayoutPolicy.emptyStateHeight}
                emptyStateMessage={getPhewasEmptyStateMessage({
                  unfilteredAssociationCount: uniquePhenotypes.length,
                  displayedAssociationCount: displayTablePhenotypes.length,
                  fallbackMessage:
                    layoutMode === 'document' ? 'No associations found' : 'No phenotypes found',
                })}
              />
              <div className='buttons'>
                <ExportDataButton
                  exportFileName={exportFileName}
                  data={exportPhenotypes}
                  columns={[
                    ...columns,
                    ...[
                      { key: 'phenocode', heading: 'Phenotype', displayId: 'phenotype' },
                      { key: 'trait_type', heading: 'Trait type', displayId: 'trait_type' },
                      { key: 'pheno_sex', heading: 'Sex', displayId: 'sex' },
                      { key: 'category', heading: 'Category', displayId: 'category' },
                      {
                        key: 'analysis_id',
                        heading: 'analysis_id',
                        displayId: 'analysis_id',
                        isRowHeader: true,
                      },
                    ].filter(
                      (exportColumn) =>
                        !columns.some((column: any) => column.displayId === exportColumn.displayId)
                    ),
                  ]}
                  enableExport={enableExport}
                />
              </div>
              <Warnings>
                {showMetaBurdenDirection && (
                  <span title="Direction comes from META_Stats_Burden; its magnitude is not shown.">
                    META direction:{' '}
                    <BurdenDirectionIndicator direction="positive" fillCell={false} /> positive ·{' '}
                    <BurdenDirectionIndicator direction="negative" fillCell={false} /> negative ·{' '}
                    <BurdenDirectionIndicator direction="zero" fillCell={false} /> zero ·{' '}
                    <BurdenDirectionIndicator direction={null} fillCell={false} /> unavailable
                  </span>
                )}
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
