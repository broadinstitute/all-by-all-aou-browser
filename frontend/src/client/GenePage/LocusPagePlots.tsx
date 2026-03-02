import React, { useContext } from 'react'

import { LocusPlotTrack, RegionViewerContext } from '@axaou/ui'
import type { LocusPlotSidecar, SignificantHit } from '@axaou/ui'
import {
  ScaleDiverging,
  scaleDiverging,
  scaleLog,
  ScaleLogarithmic,
  scaleSequential,
} from 'd3-scale'

import { LocusPvaluePlot, LeftPanel, getConsequencePriority, getTierFromPriority } from './LocusPvaluePlot'
import { VariantJoined, LocusPlotResponse } from '../types'
import { getCategoryFromConsequence } from '../vepConsequences'
import {
  GwasCatalogOption,
  gwasCatalogOptionsAtom,
  hoveredVariantAtom,
  multiAnalysisColorByAtom,
  multiAnalysisTransparencyAtom,
  variantLabelsAtom,
  enableVariantLabelsAtom,
  variantShowLabelAtom,
} from '../variantState'
import { useRecoilValue, useSetRecoilState, useRecoilState } from 'recoil'
import styled from 'styled-components'
import { useState } from 'react'
import {
  regionIdAtom,
  resultIndexAtom,
  selectedAnalysesColorsSelector,
  variantIdAtom,
} from '../sharedState'

import { interpolateRdBu, interpolateGreens } from 'd3-scale-chromatic'
import { variantGreenThreshold } from '../PhenotypeList/Utils'
import { createLogLogScaleY } from './logLogScale'
import { axaouDevUrl } from '../Query'

export const consequenceCategoryColors = {
  lof: 'rgb(255, 88, 63)',
  pLoF: 'rgb(255, 88, 63)',
  "pLoF;missenseLC": 'rgb(255, 88, 63)',
  missense: 'rgb(240, 201, 77)',
  missenseLC: 'rgb(240, 201, 77)',
  // synonymous: 'rgb(0, 128, 0)',
  synonymous: 'grey',
  'non-coding': 'lightgrey',
  // other: 'rgb(117, 117, 117)',
  other: 'lightgrey',
  unknown: 'lightgrey',
}

export const consequenceCategoryColorsMap = new Map([
  ['pLoF', 'rgb(255, 88, 63)'],
  ['pLoF;missenseLC', 'rgb(255, 88, 63)'],
  ['missense', 'rgb(240, 201, 77)'],
  ['missenseLC', 'rgb(240, 201, 77)'],
  ['synonymous', 'grey'],
  ['non-coding', 'lightgrey'],
  ['other', 'lightgrey'],
  ['unknown', 'lightgrey'],
]);

const LocusPagePlotStyles = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  width: 100%;

  .legend {
    width: 100%;
    border: 10px solid red;
  }
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
  width: 100%;

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

export const getAlleleFrequencyScale = (isRegion: boolean) => {
  if (isRegion) {
    return scaleLog().domain([1e-6, 0.1]).range([2, 4])
  }

  return scaleLog().domain([0.00001, 0.01]).range([3, 7])
}

const variantColor =
  (
    colorBy: string,
    logLogPvalScale: any,
    analysesColors: { analysisId: string; color: string }[]
  ) =>
    (variant: VariantJoined, betaScale: any): string | undefined => {
      const pvalueColorScale = scaleSequential(interpolateGreens).domain([0, 50])


      if (colorBy == 'correlation') {
        if (variant.correlation !== undefined) {
          const squaredCorrelation = variant.correlation;
          const correlationThresholds = [0, 0.2, 0.4, 0.6, 0.8, 1];
          const colors = ['blue', 'lightblue', 'lightcoral', 'salmon', 'red', 'darkred'];
          const colorIndex = correlationThresholds.findIndex(threshold => squaredCorrelation <= threshold);
          return colors[colorIndex];
        }
        return 'lightgrey'
      }

      if (colorBy === 'consequence') {
        //@ts-ignore FIXME
        try {
          //@ts-ignore FIXME
          return consequenceCategoryColors[getCategoryFromConsequence(variant.consequence) || 'other']
        } catch (e) {
          return 'black'
        }
      } else if (colorBy === 'homozygote') {
        const isHom = variant.homozygote_count && variant.homozygote_count > 0
        if (isHom) {
          return 'orange'
        } else {
          return 'grey'
        }
      } else if (colorBy === 'analysis') {
        const analysis = analysesColors.find((a) => a.analysisId === variant.analysis_id)
        return (analysis && analysis.color) || 'black'
      } else if (colorBy === 'pvalue') {
        const pvalue = -Math.log10(variant.pvalue) || 0
        const scaledVal = logLogPvalScale(pvalue || 0)
        return pvalueColorScale(scaledVal)
      } else if (colorBy === 'beta') {
        return betaScale(variant.beta || 0)
      } else {
        return 'black'
      }
    }

type PlotThresholdLine = {
  color: string
  label: string
  value: number
}
export interface VariantPlotProps {
  variantDatasets: VariantJoined[][]
  activeAnalysis?: string | null
  activeVariant?: string | null
  transparency: [number, number]
  alleleFrequencyScale: ScaleLogarithmic<number, number>
  getAfField?: (d: VariantJoined) => number
  betaScale: ScaleDiverging<string>
  scalePosition: any
  leftPanelWidth: number
  rightPanelWidth: number
  height?: number
  width?: number
  onClickPoint?: (d: VariantJoined) => void
  pointColor?: (d: VariantJoined, betaScale: any) => string | undefined
  pointLabel?: (d: VariantJoined) => string
  selectedVariant?: VariantJoined | null
  thresholds?: PlotThresholdLine[]
  xLabel?: string
  yLabel?: string
  logLogEnabled?: boolean
  applyStroke?: boolean
  gwasCatalogOption?: GwasCatalogOption
  // sortFunction?: () => sortVar
}

type AssociationsInGeneProps = {
  variantDatasets: VariantJoined[][]
  variantId?: string
  /** Optional locus plot data for PNG-based rendering */
  locusPlotData?: LocusPlotResponse | null
}

const onVariantHoverLabel =
  ({
    showAnalysisDescription = false,
    afLabel = null,
  }: {
    showAnalysisDescription?: boolean
    afLabel?: string | null
  }) =>
    (variant: VariantJoined) => {
      const { variant_id, hgvsp, analysis_description } = variant

      let hgvsDisplay = variant.hgvsc ? variant.hgvsc.split(':')[1] : ''

      if (hgvsp && hgvsp !== '') {
        hgvsDisplay = hgvsp.split(':')[1]
      }

      let analysis_description_text = ''
      if (showAnalysisDescription) {
        analysis_description_text = `- ${analysis_description}`
      }

      if (afLabel && !variant.hasOwnProperty(afLabel)) {
        if (variant.allele_frequency) {
          afLabel = 'allele_frequency'
        } else if (variant.af_cases) {
          afLabel = 'af_cases'
        } else if (variant.association_af) {
          afLabel = 'association_af'
        }
      }

      if (afLabel === undefined || afLabel === null) {
        return variant_id
      }

      return `${variant_id} ${analysis_description_text} - ${hgvsDisplay} - ${afLabel}: ${(
        variant as any
      )[afLabel].toExponential(3)}`
    }

export const LocusPagePlots = ({ variantDatasets, locusPlotData }: AssociationsInGeneProps) => {
  const regionId = useRecoilValue(regionIdAtom)
  const variantId = useRecoilValue(variantIdAtom)

  const isRegion = regionId !== undefined && regionId !== null

  const alleleFrequencyScale = getAlleleFrequencyScale(isRegion)

  const { scalePosition, centerPanelWidth, leftPanelWidth, rightPanelWidth } =
    useContext(RegionViewerContext)

  const hoveredVariant = useRecoilValue(hoveredVariantAtom)
  const multiAnalysisColorBy = useRecoilValue(multiAnalysisColorByAtom)
  const analysesColors = useRecoilValue(selectedAnalysesColorsSelector)
  const transparency = useRecoilValue(multiAnalysisTransparencyAtom)
  const gwasCatalogOption = useRecoilValue(gwasCatalogOptionsAtom)
  const enableVariantLabels = useRecoilValue(enableVariantLabelsAtom)
  const variantLabels = useRecoilValue(variantLabelsAtom)
  const [variantShowLabel, setVariantShowLabel] = useRecoilState(variantShowLabelAtom)

  const setVariantId = useSetRecoilState(variantIdAtom)
  const setResultsIndex = useSetRecoilState(resultIndexAtom)

  const onClickVariant = (variant: VariantJoined) => {
    setVariantId(variant.variant_id)
    setResultsIndex('variant-phewas')
  }

  const [plotHeight, setPlotHeight] = useState(200)
  const [isDragging, setIsDragging] = useState(false)
  const [labelOverrides, setLabelOverrides] = useState<Record<string, {x: number, y: number}>>({})

  const handleLabelDragEnd = (id: string, x: number, y: number) => {
    setLabelOverrides((prev) => ({ ...prev, [id]: { x, y } }))
  }

  const handleResetLayout = () => {
    setLabelOverrides({})
  }

  React.useEffect(() => {
    if (variantId || variantDatasets.length === 1) {
      setPlotHeight(300)
    } else if (regionId) {
      setPlotHeight(350)
    } else {
      setPlotHeight(200)
    }
  }, [variantId, regionId, variantDatasets.length])

  const axisTicks = [0, 2, 4, 6, 8, 10, 20, 50, 100, 200]

  const handlePlotDragStart = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
    const startY = e.clientY
    const startHeight = plotHeight

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - startY
      const newHeight = Math.max(150, Math.min(800, startHeight + deltaY))
      setPlotHeight(newHeight)
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  const variantsAll = variantDatasets.flatMap((v) => v)

  React.useEffect(() => {
    if (!enableVariantLabels) {
      return
    }

    const autoLabeledVariants = variantsAll.filter(v => {
      const isSignificant = v.pvalue && v.pvalue < 1e-4;
      const hasHgvs = v.hgvsp || v.hgvsc;

      return isSignificant && hasHgvs;
    });

    if (autoLabeledVariants.length > 0) {
      setVariantShowLabel(prev => {
        let changed = false;
        const newShowLabel = { ...prev };
        autoLabeledVariants.forEach(v => {
          if (newShowLabel[v.variant_id] === undefined) { // Only set if not previously defined
            newShowLabel[v.variant_id] = true;
            changed = true;
          }
        });
        return changed ? newShowLabel : prev;
      });
    }
  }, [enableVariantLabels, variantDatasets, setVariantShowLabel, variantsAll]);

  const significantVariantsWithLabels = variantsAll.filter(p => {
    const hasCustomLabel = variantLabels && variantLabels[p.variant_id];
    const explicitlySet = variantShowLabel && variantShowLabel[p.variant_id];
    const hasHgvs = p.hgvsp || p.hgvsc;

    // Only show labels for variants that have HGVS data or a custom label
    if (!hasCustomLabel && !hasHgvs) {
      return false;
    }

    if (explicitlySet !== undefined) {
      return explicitlySet || !!hasCustomLabel;
    }

    const isSignificant = p.pvalue && p.pvalue < 1e-4;
    return !!hasCustomLabel || (isSignificant && hasHgvs);
  });

  const hasPLoF = significantVariantsWithLabels.some(v => getTierFromPriority(getConsequencePriority(v.consequence || '')) === 'pLoF');
  const hasMissense = significantVariantsWithLabels.some(v => getTierFromPriority(getConsequencePriority(v.consequence || '')) === 'missense');
  const hasOther = significantVariantsWithLabels.some(v => getTierFromPriority(getConsequencePriority(v.consequence || '')) === 'other');

  let currentY = 30;
  const dynamicTierY: Record<string, number> = {};
  if (hasPLoF) {
    dynamicTierY['pLoF'] = currentY;
    currentY += 35;
  }
  if (hasMissense) {
    dynamicTierY['missense'] = currentY;
    currentY += 35;
  }
  if (hasOther) {
    dynamicTierY['other'] = currentY;
    currentY += 35;
  }

  const dynamicLabelZoneHeight = enableVariantLabels && (hasPLoF || hasMissense || hasOther) ? currentY + 10 : 0;

  const betaExtent = [-1, 1]

  const betaScale = scaleDiverging(interpolateRdBu).domain([betaExtent[0], 0, betaExtent[1]])

  const logLogScale = createLogLogScaleY({
    variants: variantsAll,
    margin: { top: 30, bottom: 40 },
    height: 400,
  })

  // Convert variants to SignificantHit format for PNG overlay
  const significantVariants: SignificantHit[] = variantsAll
    .filter((v) => v.pvalue && v.pvalue < 1e-2) // Only significant variants
    .map((v) => ({
      id: v.variant_id,
      position: v.locus?.position || 0,
      contig: v.locus?.contig || '',
      pvalue: v.pvalue,
      gene_symbol: v.gene_symbol,
      consequence: v.consequence,
      ac: v.ac_cases ?? undefined,
      af: v.allele_frequency ?? (v as any).association_af ?? undefined,
      beta: v.beta,
      se: (v as any).se ?? undefined,
      hgvsp: v.hgvsp,
      hgvsc: v.hgvsc,
    }))

  // Handle click on PNG overlay variant
  const onPngVariantClick = (variant: SignificantHit) => {
    setVariantId(variant.id)
    setResultsIndex('variant-phewas')
  }

  // Disable PNG-based rendering - use canvas-based plot with DB data instead
  const usePngPlot = false // locusPlotData && locusPlotData.image_url

  // Construct full image URL (API returns relative path like /api/...)
  const fullImageUrl = locusPlotData?.image_url
    ? `${axaouDevUrl}${locusPlotData.image_url.replace(/^\/api/, '')}`
    : ''

  return (
    <React.Fragment>
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', position: 'relative' }}>
        {Object.keys(labelOverrides).length > 0 && (
          <button
            onClick={handleResetLayout}
            style={{
              position: 'absolute',
              top: 4,
              right: 20,
              zIndex: 100,
              padding: '4px 8px',
              fontSize: '11px',
              backgroundColor: 'var(--theme-surface, #fff)',
              border: '1px solid var(--theme-border, #ccc)',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Reset Labels
          </button>
        )}
        <LocusPagePlotStyles>
          {usePngPlot ? (
            // PNG-based locus plot with interactive overlay
            <>
              <div className='left-panel'>
                <LeftPanel
                  variantDatasets={variantDatasets}
                  height={plotHeight}
                  width={leftPanelWidth}
                  axisTicks={axisTicks}
                  labelZoneHeight={dynamicLabelZoneHeight}
                  tierY={dynamicTierY}
                />
              </div>
              <LocusPlotTrack
                imageUrl={fullImageUrl}
                sidecar={locusPlotData.sidecar}
                locusStart={locusPlotData.locus_start}
                locusStop={locusPlotData.locus_stop}
                variants={significantVariants}
                height={plotHeight}
                onClickVariant={onPngVariantClick}
              />
            </>
          ) : (
            // Canvas-based fallback rendering
            <>
              <div className='left-panel'>
                <LeftPanel
                  variantDatasets={variantDatasets}
                  height={plotHeight}
                  width={leftPanelWidth}
                  axisTicks={axisTicks}
                  labelZoneHeight={dynamicLabelZoneHeight}
                  tierY={dynamicTierY}
                />
              </div>
              <LocusPvaluePlot
                variantDatasets={variantDatasets}
                activeAnalysis={undefined}
                activeVariant={hoveredVariant}
                betaScale={betaScale}
                alleleFrequencyScale={alleleFrequencyScale}
                transparency={transparency}
                height={plotHeight}
                scalePosition={scalePosition}
                width={centerPanelWidth}
                leftPanelWidth={0}
                rightPanelWidth={rightPanelWidth}
                pointColor={variantColor(multiAnalysisColorBy, logLogScale, analysesColors)}
                applyStroke={!isRegion}
                reverseConsequenceSort={isRegion}
                onClickPoint={onClickVariant}
                thresholds={[{ color: 'gainsboro', value: variantGreenThreshold, label: '' }]}
                pointLabel={onVariantHoverLabel({
                  showAnalysisDescription: variantDatasets.length === 1 ? false : true,
                })}
                gwasCatalogOption={gwasCatalogOption}
                showLollipopLabels={enableVariantLabels}
                variantLabels={variantLabels}
                labelZoneHeight={dynamicLabelZoneHeight}
                tierY={dynamicTierY}
                labelOverrides={labelOverrides}
                onLabelDragEnd={handleLabelDragEnd}
              />
            </>
          )}
        </LocusPagePlotStyles>
        <DragHandle onMouseDown={handlePlotDragStart} style={{ cursor: isDragging ? 'ns-resize' : 'ns-resize' }} title="Drag to resize plot area" />
      </div>
    </React.Fragment>
  )
}
