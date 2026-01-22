import React, { useContext } from 'react'

import { RegionViewerContext } from '@axaou/ui'
import {
  ScaleDiverging,
  scaleDiverging,
  scaleLog,
  ScaleLogarithmic,
  scaleSequential,
} from 'd3-scale'

import { LocusPvaluePlot, LeftPanel } from './LocusPvaluePlot'
import { VariantJoined } from '../types'
import { getCategoryFromConsequence } from '../vepConsequences'
import {
  GwasCatalogOption,
  gwasCatalogOptionsAtom,
  hoveredVariantAtom,
  multiAnalysisColorByAtom,
  multiAnalysisTransparencyAtom,
} from '../variantState'
import { useRecoilValue, useSetRecoilState } from 'recoil'
import styled from 'styled-components'
import {
  regionIdAtom,
  resultIndexAtom,
  selectedAnalysesColorsSelector,
  variantIdAtom,
} from '../sharedState'

import { interpolateRdBu, interpolateGreens } from 'd3-scale-chromatic'
import { variantGreenThreshold } from '../PhenotypeList/Utils'
import { createLogLogScaleY } from './logLogScale'

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

export const LocusPagePlots = ({ variantDatasets }: AssociationsInGeneProps) => {
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

  const setVariantId = useSetRecoilState(variantIdAtom)
  const setResultsIndex = useSetRecoilState(resultIndexAtom)

  const onClickVariant = (variant: VariantJoined) => {
    setVariantId(variant.variant_id)
    setResultsIndex('variant-phewas')
  }

  let genePageVariantPvaluePlotHeight = 200
  let axisTicks = [0, 2, 4, 6, 8, 10, 18, 30, 50]

  if (variantId || variantDatasets.length === 1) {
    genePageVariantPvaluePlotHeight = 300
    axisTicks = [0, 2, 4, 6, 8, 10, 25, 50]
  }

  if (regionId) {
    genePageVariantPvaluePlotHeight = 350
    axisTicks = [0, 2, 4, 6, 8, 10, 25, 50]
  }

  const variantsAll = variantDatasets.flatMap((v) => v)

  const betaExtent = [-1, 1]

  const betaScale = scaleDiverging(interpolateRdBu).domain([betaExtent[0], 0, betaExtent[1]])

  const logLogScale = createLogLogScaleY({
    variants: variantsAll,
    margin: { top: 30, bottom: 40 },
    height: 400,
  })

  return (
    <React.Fragment>
      <LocusPagePlotStyles>
        <div className='left-panel'>
          <LeftPanel
            variantDatasets={variantDatasets}
            height={genePageVariantPvaluePlotHeight}
            width={leftPanelWidth}
            axisTicks={axisTicks}
          />
        </div>
        <LocusPvaluePlot
          variantDatasets={variantDatasets}
          activeAnalysis={undefined}
          activeVariant={hoveredVariant}
          betaScale={betaScale}
          alleleFrequencyScale={alleleFrequencyScale}
          transparency={transparency}
          height={genePageVariantPvaluePlotHeight}
          scalePosition={scalePosition}
          width={centerPanelWidth}
          leftPanelWidth={0}
          rightPanelWidth={rightPanelWidth}
          pointColor={variantColor(multiAnalysisColorBy, logLogScale, analysesColors)}
          applyStroke={false}
          onClickPoint={onClickVariant}
          thresholds={[{ color: 'gainsboro', value: variantGreenThreshold, label: '' }]}
          pointLabel={onVariantHoverLabel({
            showAnalysisDescription: variantDatasets.length === 1 ? false : true,
          })}
          gwasCatalogOption={gwasCatalogOption}
        />
      </LocusPagePlotStyles>
    </React.Fragment>
  )
}
