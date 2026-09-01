import React from 'react'
import { useRecoilValue } from 'recoil'

import {
  ContextMenuSection,
  UnifiedContextMenu,
} from '../../components/UnifiedContextMenu'
import { useAppNavigation, type NavMode } from '../../hooks/useAppNavigation'
import { analysisIdAtom } from '../../sharedState'
import {
  getContainingLocusContextMenuActions,
  getContextMenuLocusRegionId,
  getGeneLocusContextMenuActions,
  getLocusContextMenuNavigation,
  type ContextMenuGeneRelationship,
  type LocusContextMenuAction,
} from '../locusNavigationPolicy'

/** Gene info for context menu. */
export interface ContextMenuGene {
  geneId: string
  geneSymbol: string
  /** Optional: burden annotation types (pLoF, missenseLC, etc). */
  burdenTypes?: string[]
  /** Optional: has coding variants. */
  hasCoding?: boolean
  /** How this gene relates to the clicked phenotype locus. */
  relationship?: ContextMenuGeneRelationship
  /** Optional genomic coordinates used by non-locus callers only for display. */
  contig?: string
  start?: number
  stop?: number
}

export interface LocusGeneContextMenuProps {
  x: number
  y: number
  /** The clicked containing locus, whose bounds are authoritative. */
  locus?: {
    contig: string
    position: number
    start?: number
    stop?: number
  }
  gene?: ContextMenuGene
  genes?: ContextMenuGene[]
  onClose: () => void
  /** Retained for caller compatibility; semantic navigation is handled here. */
  onLocusClick?: (
    contig: string,
    position: number,
    start?: number,
    stop?: number
  ) => void
  currentPhenotypeDescription?: string
}

const evidenceSuffix = (gene: ContextMenuGene): string => {
  const indicators: string[] = []
  if (gene.burdenTypes?.includes('pLoF')) indicators.push('● pLoF')
  if (gene.burdenTypes?.includes('missenseLC')) indicators.push('● missense')
  if (gene.hasCoding) indicators.push('(C) coding')
  return indicators.length > 0 ? ` — ${indicators.join(', ')}` : ''
}

const isLocusContextMenuAction = (
  value: unknown
): value is LocusContextMenuAction =>
  typeof value === 'object' &&
  value !== null &&
  'actionId' in value &&
  'analysisPolicy' in value &&
  'destination' in value

/**
 * Context menu for phenotype loci and genes. Every navigation row owns a
 * complete typed payload; no action is later recovered from a duplicate result
 * index or from whichever region happened to be current in Recoil.
 */
export const LocusGeneContextMenu: React.FC<LocusGeneContextMenuProps> = ({
  x,
  y,
  locus,
  gene,
  genes,
  onClose,
  currentPhenotypeDescription,
}) => {
  const currentAnalysisId = useRecoilValue(analysisIdAtom)
  const { navigateToState, openInNewTab } = useAppNavigation()
  const hasCurrentPhenotype = Boolean(currentAnalysisId)
  const regionId = locus ? getContextMenuLocusRegionId(locus) : null
  const allGenes = genes?.length ? genes : gene ? [gene] : []

  const sections: ContextMenuSection[] = allGenes.map((item) => {
    const actions = getGeneLocusContextMenuActions({
      geneId: item.geneId,
      geneSymbol: item.geneSymbol,
      relationship: item.relationship ?? 'unknown',
      containingRegionId: regionId,
      hasCurrentPhenotype,
    })
    return {
      label:
        allGenes.length > 1
          ? `${item.geneSymbol}${evidenceSuffix(item)}`
          : undefined,
      targets: [
        ...actions.map((action) => ({ label: action.label, action })),
        {
          label: `Copy ${item.geneSymbol} gene symbol`,
          icon: '📋',
          onClick: () => {
            navigator.clipboard.writeText(item.geneSymbol)
            onClose()
          },
        },
      ],
    }
  })

  if (regionId) {
    const containingDetailsAlreadyFirst =
      allGenes.length === 1 && allGenes[0].relationship === 'nearby'
    const locusActions = getContainingLocusContextMenuActions({
      containingRegionId: regionId,
      hasCurrentPhenotype,
    }).filter(
      ({ actionId }) =>
        !containingDetailsAlreadyFirst ||
        actionId !== 'containing-locus-details-current-phenotype'
    )
    sections.push({
      label: `Containing locus: ${regionId}`,
      targets: locusActions.map((action) => ({ label: action.label, action })),
    })
  }

  if (currentPhenotypeDescription) {
    const phenotypeAction: LocusContextMenuAction = {
      actionId: 'phenotype-results',
      geneId: null,
      regionId,
      analysisPolicy: 'preserve-current',
      destination: 'results',
      label: `Results for current phenotype: ${currentPhenotypeDescription}`,
      resultIndex: 'pheno-info',
    }
    sections.push({
      label: `Current phenotype: ${currentPhenotypeDescription}`,
      targets: [{ label: phenotypeAction.label, action: phenotypeAction }],
    })
  }

  let title: React.ReactNode = ''
  if (allGenes.length === 1) {
    const item = allGenes[0]
    title = `GENE: ${item.geneSymbol}${evidenceSuffix(item)}`
  } else if (locus) {
    title = `LOCUS: ${locus.contig}:${locus.position.toLocaleString()}`
  } else if (allGenes.length > 1) {
    title = `${allGenes.length} GENES`
  }

  const navigate = (mode: NavMode, value: unknown) => {
    if (!isLocusContextMenuAction(value)) return
    const navigation = getLocusContextMenuNavigation(
      value,
      currentAnalysisId ?? null
    )
    const presentation = { destination: navigation.destination }
    if (mode === 'newTab') {
      openInNewTab(navigation.stateUpdates, presentation)
    } else {
      navigateToState(navigation.stateUpdates, presentation)
    }
    onClose()
  }

  return (
    <UnifiedContextMenu
      x={x}
      y={y}
      title={title}
      sections={sections}
      onNavigate={navigate}
      onClose={onClose}
    />
  )
}

export default LocusGeneContextMenu
